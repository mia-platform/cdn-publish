use crate::{Error, Result};
use bytes::Bytes;
use cdn_publish_cli::{
    url::{UrlDirPath, UrlPath},
    Common,
};
use futures::{Stream, TryFutureExt, TryStreamExt};
use human_format::{Formatter, Scales};
use mime::{APPLICATION_JSON, APPLICATION_OCTET_STREAM};
use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue, ACCEPT, CONTENT_TYPE},
    Body, Client, ClientBuilder, Response, StatusCode, Url,
};
use serde::{de::Visitor, Deserialize, Deserializer};
use std::{
    fmt::{self, Display},
    path::Path,
};
use tabled::Tabled;
use tokio::{fs::File, io::AsyncWriteExt};
use typed_builder::TypedBuilder;

static ACCESS_KEY: &str = "accesskey";

static APP_USER_AGENT: &str = concat!(env!("CARGO_PKG_NAME"), "/", env!("CARGO_PKG_VERSION"),);

fn deserialize_status_code<'de, D>(deserializer: D) -> Result<StatusCode, D::Error>
where
    D: Deserializer<'de>,
{
    struct StatusCodeVisitor;

    impl<'de> Visitor<'de> for StatusCodeVisitor {
        type Value = StatusCode;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("an integer between 0 and 65535")
        }

        fn visit_u8<E>(self, v: u8) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            self.visit_u16(v as u16)
        }

        fn visit_u16<E>(self, v: u16) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            StatusCode::from_u16(v).map_err(|err| <E as serde::de::Error>::custom(err.to_string()))
        }

        fn visit_u32<E>(self, v: u32) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            self.visit_u16(v as u16)
        }

        fn visit_u64<E>(self, v: u64) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            self.visit_u16(v as u16)
        }

        fn visit_str<E>(self, v: &str) -> std::result::Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            let code = v
                .parse::<u16>()
                .map_err(|err| <E as serde::de::Error>::custom(err.to_string()))?;
            StatusCode::from_u16(code)
                .map_err(|err| <E as serde::de::Error>::custom(err.to_string()))
        }
    }

    deserializer.deserialize_any(StatusCodeVisitor)
}

#[derive(Deserialize, Tabled)]
#[serde(rename_all = "PascalCase")]
#[allow(dead_code)]
pub struct Item {
    #[tabled(skip)]
    array_number: u64,
    #[tabled(skip, format("{}", self.checksum.as_deref().unwrap_or("")))]
    checksum: Option<String>,
    #[tabled(skip)]
    content_type: String,
    #[tabled(skip)]
    date_created: String,
    #[tabled(skip)]
    guid: String,
    #[serde(default)]
    #[tabled(skip)]
    is_directory: bool,
    last_changed: String,
    #[tabled(display_with("Self::format_length", self))]
    length: u64,
    #[tabled(order = 0, display_with("Self::format_object_name", self))]
    pub object_name: String,
    #[tabled(skip)]
    path: String,
    #[tabled(skip, format("{}", self.replicated_zones.as_deref().unwrap_or("")))]
    replicated_zones: Option<String>,
    #[tabled(skip)]
    server_id: u64,
    #[tabled(skip)]
    storage_zone_id: u64,
    #[tabled(skip)]
    storage_zone_name: String,
    #[tabled(skip)]
    user_id: String,
}

impl Item {
    fn format_length(&self) -> String {
        if self.is_directory {
            String::new()
        } else {
            Formatter::new()
                .with_scales(Scales::Binary())
                .with_units("B")
                .format(self.length as f64)
        }
    }

    fn format_object_name(&self) -> String {
        format!(
            "{} {}",
            if self.is_directory { "📂" } else { "📄" },
            self.object_name
        )
    }
}

#[derive(Debug, Deserialize, TypedBuilder)]
pub struct ApiMessage {
    #[serde(rename = "HttpCode", deserialize_with = "deserialize_status_code")]
    pub http_code: StatusCode,
    #[serde(rename = "Message")]
    pub message: String,
}

impl std::error::Error for ApiMessage {}

impl Display for ApiMessage {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}

async fn handle_response(res: Response) -> Result<Response> {
    match res.status() {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::NOT_FOUND => {
            let bytes = res.bytes().await.map_err(Error::HttpClient)?;
            let error_message =
                serde_json::from_slice::<ApiMessage>(&bytes).map_err(Error::Serde)?;

            Err(Error::from(error_message))
        }
        StatusCode::OK | StatusCode::CREATED => Ok(res),
        _ => {
            let status = res.status();
            let bytes = res.text().await.map_err(Error::HttpClient)?;
            let error_message = ApiMessage::builder()
                .http_code(status)
                .message(bytes)
                .build();

            Err(Error::from(error_message))
        }
    }
}

async fn collect_stream_of_bytes(res: Response) -> impl Stream<Item = Result<Bytes>> {
    res.bytes_stream().map_err(Error::HttpClient)
}

async fn collect_json<T>(res: Response) -> Result<T>
where
    for<'de> T: Deserialize<'de>,
{
    let content_type: Option<mime::Mime> = res
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|ct| String::from_utf8_lossy(ct.as_ref()).parse().ok());
    match content_type.as_ref().map(|mime| mime.essence_str()) {
        Some("application/json") => {
            let bytes = res.bytes().await?;
            Ok(serde_json::from_slice(&bytes)?)
        }
        _ => Err(Error::Parse(format!(
            "{} header is not 'application/json'",
            CONTENT_TYPE.as_str()
        ))),
    }
}

pub struct BunnyClient {
    base_url: Url,
    inner: Client,
}

impl BunnyClient {
    pub async fn get(&self, path: &UrlPath, output: &Path) -> Result<File> {
        let url: Url = format!("{}/{}", self.base_url, path).parse()?;

        let response = self
            .inner
            .get(url)
            .header(ACCEPT, HeaderValue::from_static("*/*"))
            .send()
            .await?;

        let content = handle_response(response)
            .and_then(|res| async { Ok(collect_stream_of_bytes(res).await) })
            .await?;

        let fd = tokio::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(output)
            .await
            .map_err(Error::from)?;

        content
            .try_fold(fd, |mut file, next| async move {
                file.write_all(&next).await?;
                Ok(file)
            })
            .await
    }

    pub async fn list(&self, path: &UrlDirPath) -> Result<Vec<Item>> {
        let url: Url = format!("{}/{}", self.base_url, path).parse()?;

        let response = self
            .inner
            .get(url)
            .header(ACCEPT, HeaderValue::from_static("*/*"))
            .send()
            .await?;

        handle_response(response).and_then(collect_json).await
    }

    pub async fn upload_file<T>(
        &self,
        path: &UrlPath,
        body: T,
        checksum: Option<&str>,
    ) -> Result<()>
    where
        T: Into<Body>,
    {
        let url: Url = format!("{}/{}", self.base_url, path).parse()?;
        let request_builder = self
            .inner
            .put(url)
            .header(
                ACCEPT,
                HeaderValue::from_static(APPLICATION_JSON.essence_str()),
            )
            .header(
                CONTENT_TYPE,
                HeaderValue::from_static(APPLICATION_OCTET_STREAM.essence_str()),
            );

        let response = if let Some(checksum) = checksum {
            request_builder.header(
                HeaderName::from_static("checksum"),
                HeaderValue::from_str(checksum)?,
            )
        } else {
            request_builder
        }
        .body(body)
        .send()
        .await?;

        handle_response(response).await?;

        Ok(())
    }
}

impl TryFrom<Common> for BunnyClient {
    type Error = Error;

    fn try_from(
        Common {
            storage_api_base_url,
            storage_api_key,
            zone_name,
        }: Common,
    ) -> Result<Self, Self::Error> {
        let base_url = storage_api_base_url.join(zone_name.read())?;
        let headers = HeaderMap::from_iter([(
            HeaderName::from_static(ACCESS_KEY),
            HeaderValue::from_str(storage_api_key.read())?,
        )]);
        Ok(Self {
            base_url,
            inner: ClientBuilder::default()
                .default_headers(headers)
                .user_agent(APP_USER_AGENT)
                .build()?,
        })
    }
}

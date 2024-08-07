use assert_fs::{
    prelude::{FileWriteStr, PathChild},
    TempDir,
};
use cdn_publish::bunny_client::BunnyClient;
use cdn_publish_cli::{
    url::{UrlDirPath, UrlPath},
    Common, DEFAULT_STORAGE_API_URL,
};
use reqwest::Url;
use rstest::{fixture, rstest};
use secret_rs::Secret;
use serde_json::json;
use std::{borrow::Borrow, env};
use uuid::Uuid;

#[fixture]
#[once]
fn remote_dir() -> UrlDirPath {
    let secrets_env_file = env::current_dir()
        .expect("valid current dir")
        .join("tests")
        .join(".secrets")
        .join("tests.env");
    let random = std::fs::read_to_string(&secrets_env_file).unwrap_or(Uuid::new_v4().to_string());
    let url_path: UrlPath = format!("__test/{}", random.trim())
        .parse()
        .expect("must be a valid url segment");
    url_path.borrow().into()
}

#[fixture]
fn json_file_name() -> String {
    format!("{}.json", Uuid::new_v4())
}

#[fixture]
fn client() -> BunnyClient {
    let secrets_env_file = env::current_dir()
        .expect("valid current dir")
        .join("tests")
        .join(".secrets")
        .join("env.json");
    let api_key_secret = json!({
        "type": "file",
        "path": serde_json::Value::String(secrets_env_file.to_string_lossy().to_string()),
        "key": "CDN_STORAGE_API_KEY"
    });
    let api_key_secret =
        serde_json::from_value::<Secret>(api_key_secret).expect("json to be a valid secret");
    let common = Common::builder()
        .storage_api_base_url(DEFAULT_STORAGE_API_URL.parse::<Url>().unwrap())
        .storage_api_key(api_key_secret)
        .zone_name("mia-platform-test")
        .build();
    common.try_into().expect("client to be created")
}

#[rstest]
#[tokio::test]
async fn upload_json_file(client: BunnyClient, remote_dir: &UrlDirPath, json_file_name: String) {
    let temp_dir = TempDir::new().expect("temp dir to be created");
    let json_file = temp_dir.child(&json_file_name);
    json_file
        .write_str(r#"{"key": "value"}"#)
        .expect("content to be written to file");

    let path = json_file_name.parse().expect("file url path to be parsed");
    let content = tokio::fs::read_to_string(json_file.path())
        .await
        .expect("file descriptor to be open");
    let remote_path = remote_dir.join(&path);

    client
        .upload_file(&remote_path, content.clone(), None)
        .await
        .expect("file to be uploaded");
    let items = client
        .list(remote_dir)
        .await
        .expect("folder to be available");
    assert!(items.iter().any(|item| item.object_name == json_file_name));

    let downloaded_file = temp_dir.child(Uuid::new_v4().to_string());
    client
        .get(&remote_path, downloaded_file.path())
        .await
        .expect("file content to be downloaded");

    assert_eq!(
        content,
        tokio::fs::read_to_string(downloaded_file.path())
            .await
            .expect("downloaded file to be readable")
    )
}

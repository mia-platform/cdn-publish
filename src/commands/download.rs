use super::{Initialize, Run};
use crate::{bunny_client::BunnyClient, Error, Result};
use cdn_publish_cli::{
    url::{UrlDirPath, UrlPath},
    Common,
};
use std::{borrow::Borrow, path::PathBuf};
use typed_builder::TypedBuilder;

#[derive(TypedBuilder)]
pub struct Download {
    common: Common,
    output: PathBuf,
    path: UrlPath,
}

enum RemoteOp {
    File(String, UrlPath),
    Dir(UrlDirPath),
}

impl From<&RemoteOp> for UrlPath {
    fn from(value: &RemoteOp) -> Self {
        match value {
            RemoteOp::File(_, path) => path.clone(),
            RemoteOp::Dir(dir_path) => dir_path.clone().into(),
        }
    }
}

pub struct DownloadContext {
    client: BunnyClient,
    output: PathBuf,
    remote_op: RemoteOp,
}

impl Initialize for Download {
    type Output = DownloadContext;

    async fn init(self) -> Result<Self::Output> {
        let Self {
            common,
            output,
            path,
        } = self;
        let client: BunnyClient = common.try_into()?;
        let dir_candidate: UrlDirPath = path.borrow().into();

        // let's check local metadata for the given `output` argument
        // we need to get a folder out of the user input or a path
        // that does not exist
        let output = tokio::fs::metadata(&output)
            .await
            .map(Some)
            .or_else(|err| match err.kind() {
                std::io::ErrorKind::NotFound => Ok(None),
                _ => Err(Error::IO(err)),
            })
            .and_then(|metadata| {
                if metadata.map(|m| m.is_dir()).unwrap_or(true) {
                    Ok(output)
                } else {
                    Err(Error::Parse(format!(
                        "selected output '{}' is a file",
                        String::from_utf8_lossy(output.as_os_str().as_encoded_bytes())
                    )))
                }
            })?;

        // if listing returns empty array then:
        // 1. either `path` is an empty dir
        // 2. it does not exist
        // so we can attempt to fetch the content
        // as if the remote target is a file by removing the trailing slash
        let remote_op = if client.list(&dir_candidate).await?.is_empty() {
            // the user attempted to download a remote content which is a file
            // but the path suggested does not contain a file name
            let file_name = path.file_name().ok_or(Error::Parse(format!(
                "remote resource is a file but input path '{path}' does not represents a file"
            )))?;

            RemoteOp::File(file_name.to_string(), path)
        } else {
            RemoteOp::Dir(dir_candidate)
        };

        Ok(Self::Output {
            client,
            output,
            remote_op,
        })
    }
}

impl Run for DownloadContext {
    type Output = ();

    async fn run(self) -> Result<Self::Output> {
        let Self {
            client,
            output,
            remote_op,
        } = self;

        tokio::fs::create_dir_all(&output).await?;

        match remote_op {
            RemoteOp::File(file_name, path) => {
                let file_path = output.join(file_name);
                client.get(&path, &file_path).await?;
            }
            RemoteOp::Dir(_) => unimplemented!(),
        }

        Ok(())
    }
}

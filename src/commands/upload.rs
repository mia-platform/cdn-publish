use super::{Initialize, Run};
use crate::{
    bunny_client::BunnyClient,
    util::{make_filesystem_path, print_table, Traverse},
    Error, Result,
};
use backon::{ConstantBuilder, Retryable};
use cdn_publish_cli::{url::UrlPath, Common, Concurrent, Retry};
use futures::{stream, StreamExt, TryStreamExt};
use sha2::{Digest, Sha256};
use std::{
    borrow::{Borrow, Cow},
    path::PathBuf,
    sync::Arc,
    time::Duration,
};
use tabled::Tabled;
use tokio::sync::Mutex;
use typed_builder::TypedBuilder;

#[derive(TypedBuilder)]
pub struct Upload {
    checksum: bool,
    common: Common,
    concurrent: Concurrent,
    execute: bool,
    overwrite: bool,
    prefix: UrlPath,
    paths: Vec<PathBuf>,
    retry: Retry,
}

#[derive(Debug, TypedBuilder, Tabled)]
struct LocalResource {
    #[builder(default, setter(strip_option))]
    #[tabled(display_with("Self::checksum_yes_or_no", self))]
    checksum: Option<String>,
    #[tabled(
        order = 0,
        rename = "filename",
        display_with("Self::name_from_path", self)
    )]
    path: PathBuf,
    #[tabled(order = 1, rename = "path", display_with("Self::basepath", self))]
    url: UrlPath,
}

impl LocalResource {
    fn basepath(&self) -> String {
        let basepath = self.url.as_ref();
        let filename = self.name_from_path();
        basepath
            .strip_suffix(&filename)
            .unwrap_or(basepath)
            .to_owned()
    }

    fn checksum_yes_or_no(&self) -> String {
        match self.checksum.as_ref() {
            Some(_) => "👍",
            None => "none",
        }
        .to_string()
    }

    fn name_from_path(&self) -> String {
        let file_name = self
            .path
            .file_name()
            .map(|s| s.as_encoded_bytes())
            .map(String::from_utf8_lossy)
            .unwrap_or(Cow::Borrowed("[none]"));
        file_name.to_string()
    }
}

pub struct UploadContext {
    client: BunnyClient,
    concurrent: Concurrent,
    execute: bool,
    resources: Vec<LocalResource>,
    retry: Retry,
}

impl Initialize for Upload {
    type Output = UploadContext;

    async fn init(self) -> Result<Self::Output> {
        let Self {
            checksum,
            common,
            concurrent,
            execute,
            overwrite,
            prefix,
            paths,
            retry,
        } = self;
        let client: BunnyClient = common.try_into()?;

        let dir_prefix = prefix.borrow().into();
        if !overwrite && !client.list(&dir_prefix).await?.is_empty() {
            return Err(Error::Operations(format!(
                "remote location '{dir_prefix}' currently contains files"
            )));
        }

        let resources = stream::iter(paths)
            .map(Ok::<_, Error>)
            .try_fold(vec![], |mut output, path| async {
                let fs_path = make_filesystem_path(&path)?;
                let file_paths = if tokio::fs::metadata(path).await?.is_dir() {
                    Traverse::from(&fs_path).traverse().await?.files()
                } else {
                    vec![fs_path]
                };

                let resources_iter = file_paths.into_iter().map(|path| {
                    String::from_utf8_lossy(path.as_os_str().as_encoded_bytes())
                        .parse()
                        .map_err(|err| Error::Parse(format!("Invalid uri: {err}")))
                        .map(|url| (path, prefix.join(&url)))
                });

                if checksum {
                    let resources = &Arc::new(Mutex::new(vec![]));
                    stream::iter(resources_iter)
                        .try_for_each_concurrent(None, |(path, url)| async move {
                            let content = tokio::fs::read(&path).await?;
                            let checksum =
                                base16ct::upper::encode_string(&Sha256::digest(&content));

                            resources.lock().await.push(
                                LocalResource::builder()
                                    .checksum(checksum)
                                    .path(path)
                                    .url(url)
                                    .build(),
                            );
                            Ok(())
                        })
                        .await?;

                    let mut lock = resources.lock().await;
                    output.extend(lock.drain(..));
                } else {
                    let resources = resources_iter
                        .map(|resource| {
                            resource.map(|(path, url)| {
                                LocalResource::builder().path(path).url(url).build()
                            })
                        })
                        .collect::<Result<Vec<_>, _>>()?;
                    output.extend(resources);
                }

                Ok(output)
            })
            .await?;

        Ok(Self::Output {
            client,
            concurrent,
            execute,
            resources,
            retry,
        })
    }
}

impl Run for UploadContext {
    type Output = ();

    async fn run(self) -> Result<Self::Output> {
        let Self {
            ref client,
            concurrent: Concurrent { parallel },
            execute,
            resources,
            retry: Retry { attempts, millis },
        } = self;

        if execute {
            stream::iter(resources)
                .map(Ok)
                .try_for_each_concurrent(
                    parallel,
                    |LocalResource {
                         path,
                         url,
                         checksum,
                     }| async move {
                        let upload_fn = || async {
                            let fd = tokio::fs::File::open(&path).await?;
                            client.upload_file(&url, fd, checksum.as_deref()).await
                        };

                        let builder = ConstantBuilder::default()
                            .with_max_times(attempts)
                            .with_delay(Duration::from_millis(millis));
                        upload_fn.retry(&builder).await
                    },
                )
                .await
        } else {
            println!();
            println!("🏃\tupload dry run... {} files to upload", resources.len());
            println!();
            print_table(&resources);
            println!();
            Ok(())
        }
    }
}

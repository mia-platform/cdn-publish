use crate::{Error, Result};
use cdn_publish_cli::url::UrlDirPath;
use futures::{future::BoxFuture, FutureExt, TryFutureExt, TryStreamExt};
use std::path::{Path, PathBuf};
use tabled::{Table, Tabled};
use tokio_stream::wrappers::ReadDirStream;
use typed_builder::TypedBuilder;

pub fn print_table<T>(items: &[T])
where
    T: Tabled,
{
    println!("{}", Table::new(items))
}

pub fn print_items<T>(dir: &UrlDirPath, items: &[T])
where
    T: Tabled,
{
    println!();
    if items.is_empty() {
        println!("🪹\tno items found in folder '{dir}'")
    } else {
        println!("🖨️\tprinting content of folder '{dir}'");
        println!();
        print_table(items);
    }
    println!();
}

pub fn make_filesystem_path(path: &Path) -> Result<PathBuf> {
    let cwd = std::env::current_dir()
        .map_err(|_| Error::FileTraverse("cannot determine current directory".into()))?;
    let canonical_path = cwd.join(path);
    let canonical_path = canonical_path
        .canonicalize()
        .map_err(|_| Error::FileTraverse(format!("cannot resolve path '{}'", path.display())))?;
    // 👇 this guys starts WITHOUT a trailing slash
    Ok(canonical_path
        .strip_prefix(&cwd)
        .map_err(|_| {
            Error::FileTraverse("folder path is outside of current directory".to_string())
        })?
        .to_owned())
}

#[derive(TypedBuilder)]
pub struct Traverse<'a> {
    cwd: PathBuf,
    path: &'a Path,
    #[builder(default, setter(skip))]
    files: Vec<PathBuf>,
}

impl<'a> Traverse<'a> {
    pub fn from(path: &'a Path) -> Self {
        let cwd = std::env::current_dir()
            .map_err(|_| Error::FileTraverse("cannot determine current directory".into()))
            // UNWRAP: panic on absent current directory
            .unwrap();
        Self::builder().cwd(cwd).path(path).build()
    }

    pub fn files(self) -> Vec<PathBuf> {
        let Self { files, .. } = self;
        files
    }

    pub fn strip_prefix(&self, canonical_path: &Path) -> Result<PathBuf> {
        Ok(canonical_path
            .strip_prefix(&self.cwd)
            .map_err(|_| {
                Error::FileTraverse("folder path is outside of current directory".to_string())
            })?
            .to_owned())
    }

    pub fn traverse(mut self) -> BoxFuture<'a, Result<Self>> {
        async move {
            let canonical_path = self.cwd.join(self.path);
            let fd = tokio::fs::File::open(&canonical_path)
                .and_then(|fd| async move { fd.metadata().await })
                .await
                .map_err(|_| {
                    Error::FileTraverse(format!(
                        "cannot open file descriptor at {}",
                        self.path.display()
                    ))
                })?;

            if fd.is_file() {
                self.files.push(self.strip_prefix(&canonical_path)?);
                Ok(self)
            } else {
                ReadDirStream::new(tokio::fs::read_dir(&canonical_path).await.map_err(|_| {
                    Error::FileTraverse(format!(
                        "while reading directory at {}",
                        self.path.display()
                    ))
                })?)
                .map_err(Error::from)
                .and_then(|dir_entry| async move {
                    let path = dir_entry.path();
                    let metadata = dir_entry.metadata().await.map_err(|_| {
                        Error::FileTraverse(format!(
                            "while reading metadata at path {}",
                            path.display()
                        ))
                    })?;
                    Ok((path, metadata))
                })
                .try_fold(
                    self,
                    |mut traverse, (canonical_path, metadata)| async move {
                        if metadata.is_file() {
                            traverse.files.push(traverse.strip_prefix(&canonical_path)?);
                        } else {
                            let Traverse {
                                files: inner_files, ..
                            } = Traverse::from(&canonical_path).traverse().await?;
                            traverse.files.extend(inner_files);
                        }

                        Ok(traverse)
                    },
                )
                .await
                .map_err(|_| {
                    Error::FileTraverse(format!(
                        "while folding directory at {}",
                        canonical_path.display()
                    ))
                })
            }
        }
        .boxed()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use assert_fs::{prelude::*, TempDir};

    #[tokio::test]
    async fn traverse_single_file() {
        let temp = TempDir::new().expect("temp dir to be created");
        let input_file = temp.child("foo.txt");
        input_file.touch().expect("file 'foo.txt' to be created");

        let Traverse { files, .. } = Traverse::from(&input_file)
            .traverse()
            .await
            .expect("traverse to be successful");

        assert_eq!(files, vec![input_file.to_owned()]);
    }

    #[tokio::test]
    async fn traverse_a_directory_with_a_single_file() {
        let temp = TempDir::new().expect("temp dir to be created");
        let input_file = temp.child("foo.txt");
        input_file.touch().expect("file 'foo.txt' to be created");

        let files = Traverse::from(temp.path())
            .traverse()
            .await
            .expect("traverse to be successful")
            .files();

        assert_eq!(files, vec![input_file.to_owned()]);
    }

    #[tokio::test]
    async fn traverse_multiple_nestings() {
        let temp = TempDir::new().expect("temp dir to be created");
        let input_dir = temp.child("dir1");
        let input_file = input_dir.child("foo.txt");
        input_file.touch().expect("file 'foo.txt' to be created");

        let Traverse { files, .. } = Traverse::from(temp.path())
            .traverse()
            .await
            .expect("traverse to be successful");

        assert_eq!(files, vec![input_file.to_owned()]);
    }

    #[tokio::test]
    async fn lots_of_files() {
        let temp = TempDir::new().expect("temp dir to be created");
        let input_dir1 = temp.child("dir1");
        let input_dir2 = temp.child("dir2");
        input_dir2.child("dir3");

        let f1 = input_dir1.child("file1.txt");
        let f2 = input_dir1.child("file2.txt");
        let f3 = input_dir2.child("file.txt");
        input_dir2
            .create_dir_all()
            .expect("directory to be created");

        f1.touch().expect("file 'foo.txt' to be created");
        f2.touch().expect("file 'foo.txt' to be created");
        f3.touch().expect("file 'foo.txt' to be created");

        let Traverse { mut files, .. } = Traverse::from(temp.path())
            .traverse()
            .await
            .expect("traverse to be successful");

        files.sort();
        assert_eq!(files, vec![f1.to_owned(), f2.to_owned(), f3.to_owned()]);
    }
}

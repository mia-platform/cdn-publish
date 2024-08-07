use super::{Initialize, Run};
use crate::{
    bunny_client::{BunnyClient, Item},
    util::print_items,
    Result,
};
use cdn_publish_cli::{
    url::{UrlDirPath, UrlPath},
    Common,
};
use std::borrow::Borrow;
use typed_builder::TypedBuilder;

#[derive(TypedBuilder)]
pub struct List {
    common: Common,
    dir: UrlPath,
}

#[derive(TypedBuilder)]
pub struct ListContext {
    client: BunnyClient,
    dir: UrlPath,
}

impl Initialize for List {
    type Output = ListContext;

    async fn init(self) -> Result<Self::Output> {
        let Self { common, dir } = self;
        Ok(Self::Output {
            client: common.try_into()?,
            dir,
        })
    }
}

impl Run for ListContext {
    type Output = Vec<Item>;

    async fn run(self) -> Result<Self::Output> {
        let ListContext { client, dir } = self;
        let dir: UrlDirPath = dir.borrow().into();

        client
            .list(&dir)
            .await
            .inspect(|items| print_items(&dir, items))
    }
}

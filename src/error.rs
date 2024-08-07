use crate::bunny_client::ApiMessage;
use cdn_publish_cli::url::ParseError;
use reqwest::header::InvalidHeaderValue;
use serde::Serialize;
use std::fmt::Debug;

pub type Result<T, E = Error> = std::prelude::v1::Result<T, E>;

pub trait JsonResponse: Debug + Serialize {}

#[derive(Debug, thiserror::Error)]
#[error(transparent)]
pub enum Error {
    HttpClient(#[from] reqwest::Error),
    #[error("{0}")]
    FileTraverse(String),
    #[error("{0}")]
    Parse(String),
    #[error("{0}")]
    Operations(String),
    Serde(#[from] serde_json::Error),
    #[error("HTTP Client said: {0}")]
    HttpResponse(#[from] ApiMessage),
    IO(#[from] std::io::Error),
}

impl From<ParseError> for Error {
    fn from(value: ParseError) -> Self {
        Self::Parse(format!("Invalid url: {value}"))
    }
}

impl From<InvalidHeaderValue> for Error {
    fn from(value: InvalidHeaderValue) -> Self {
        Self::Parse(format!("Invalid HTTP header value: {value}"))
    }
}

use crate::Result;
pub use download::Download;
pub use list::List;
use std::future::Future;
pub use upload::Upload;

mod download;
mod list;
mod upload;

pub trait Initialize: Sized {
    type Output;

    fn init(self) -> impl Future<Output = Result<Self::Output>> + Send;
}

pub trait Run {
    type Output;

    fn run(self) -> impl Future<Output = Result<Self::Output>> + Send;
}

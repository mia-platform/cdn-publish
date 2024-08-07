use std::path::PathBuf;

pub use clap::Parser;
use clap::{Args, Subcommand};
use secret_rs::Secret;
use typed_builder::TypedBuilder;
use url::{Url, UrlPath};

pub mod url;

pub static DEFAULT_STORAGE_API_URL: &str = "https://storage.bunnycdn.com";

#[derive(Args, TypedBuilder)]
#[builder(field_defaults(setter(into)))]
pub struct Common {
    #[arg(short, long, default_value = DEFAULT_STORAGE_API_URL, env = "CDN_STORAGE_API_BASE_URL")]
    pub storage_api_base_url: Url,
    #[arg(short = 'k', long, env = "CDN_STORAGE_API_KEY")]
    pub storage_api_key: Secret,
    #[arg(short, long, env = "CDN_ZONE_NAME")]
    pub zone_name: Secret,
}

#[derive(Args)]
pub struct Retry {
    /// Number of attempts before to bail out
    #[arg(long, default_value_t = 3)]
    pub attempts: usize,
    /// Delay in milliseconds between attempts
    #[arg(long, default_value_t = 1_000)]
    pub millis: u64,
}

#[derive(Args)]
pub struct Concurrent {
    /// Number of parallel operations to perform
    #[arg(long, default_value = "20")]
    pub parallel: usize,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Download remotely stored files.
    /// `path` can either be a directory or a single file
    Download {
        #[command(flatten)]
        common: Common,

        /// The location where to store downloaded content
        #[arg(short, long, default_value = ".")]
        output: PathBuf,

        /// The path to download
        path: UrlPath,
    },

    /// Lists the content of a directory
    List {
        #[command(flatten)]
        common: Common,

        /// The directory to stat. A trailing slash
        /// will be appended if missing
        #[arg(default_value = "/")]
        dir: UrlPath,
    },

    /// Uploads a file, a directory or a list of files and/or directories
    /// to the remote location. A prefix can be specified to be prepended all
    /// uploaded files.
    Upload {
        #[command(flatten)]
        common: Common,

        #[command(flatten)]
        retry: Retry,

        #[command(flatten)]
        concurrent: Concurrent,

        #[arg(short = 'y', long, default_value_t = false)]
        execute: bool,

        /// Avoid checking whether files are stored
        /// in the requested remote location
        #[arg(long, default_value_t = false)]
        overwrite: bool,

        /// Perform checksum verification upon uploading
        #[arg(short, long, default_value_t = false)]
        checksum: bool,

        /// Prefix to prepend to the upload content remote path
        #[arg(short, long, default_value = "/", default_value_t = UrlPath::default())]
        prefix: UrlPath,

        /// The path to upload
        #[arg(default_value = ".")]
        paths: Vec<PathBuf>,
    },
}

#[derive(Parser)]
#[command(version, about)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

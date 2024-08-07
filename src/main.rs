use cdn_publish::{
    commands::{Download, Initialize, List, Run, Upload},
    Result,
};
use cdn_publish_cli::{Cli, Parser};

async fn run(command: cdn_publish_cli::Commands) -> Result<()> {
    match command {
        cdn_publish_cli::Commands::Download {
            common,
            output,
            path,
        } => {
            Download::builder()
                .common(common)
                .output(output)
                .path(path)
                .build()
                .init()
                .await?
                .run()
                .await
        }
        cdn_publish_cli::Commands::List { common, dir } => {
            List::builder()
                .common(common)
                .dir(dir)
                .build()
                .init()
                .await?
                .run()
                .await?;
            Ok(())
        }
        cdn_publish_cli::Commands::Upload {
            checksum,
            common,
            concurrent,
            execute,
            overwrite,
            prefix,
            paths,
            retry,
        } => {
            Upload::builder()
                .checksum(checksum)
                .common(common)
                .concurrent(concurrent)
                .execute(execute)
                .overwrite(overwrite)
                .paths(paths)
                .prefix(prefix)
                .retry(retry)
                .build()
                .init()
                .await?
                .run()
                .await
        }
    }
}

#[tokio::main]
async fn main() {
    let cli_args = Cli::parse();

    if let Err(error) = run(cli_args.command).await {
        eprintln!("{error}");
    }
}

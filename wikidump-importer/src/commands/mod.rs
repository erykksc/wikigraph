use std::io;

use clap::{Parser, Subcommand};

pub mod export_csv;
pub mod wikigraph_redis;

#[derive(Debug, Parser)]
#[command(name = "wikidump_importer")]
#[command(about = "Parse MediaWiki SQL dumps")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Command,
}

#[derive(Debug, Subcommand)]
pub enum Command {
    ExportCsv(export_csv::ExportCsvArgs),
    #[command(name = "redis")]
    Redis(wikigraph_redis::RedisArgs),
}

impl Cli {
    pub fn run(self) -> io::Result<()> {
        self.command.run()
    }
}

impl Command {
    pub fn run(self) -> io::Result<()> {
        match self {
            Self::ExportCsv(args) => export_csv::run_export_csv(args),
            Self::Redis(args) => wikigraph_redis::run_redis(args),
        }
    }
}

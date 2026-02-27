use std::io;

use clap::{Parser, Subcommand};

pub mod export_csv;
pub mod wikigraph_valkey;

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
    #[command(name = "wikigraph-valkey")]
    WikigraphValkey(wikigraph_valkey::WikigraphValkeyArgs),
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
            Self::WikigraphValkey(args) => wikigraph_valkey::run_wikigraph_valkey(args),
        }
    }
}

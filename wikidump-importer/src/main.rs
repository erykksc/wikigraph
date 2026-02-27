use clap::Parser;

use wikidump_importer::commands::Cli;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    cli.run()?;
    Ok(())
}

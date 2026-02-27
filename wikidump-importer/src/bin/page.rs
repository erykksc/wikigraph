use std::io::{self, BufWriter, Write};

use parse_mediawiki_sql::utils::memory_map;
use wikidump_importer::outputs::csv::{write_page_header, write_page_row};
use wikidump_importer::parsers::page::for_each_row;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let input_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "page.sql".to_string());

    let page_sql = unsafe { memory_map(&input_path)? };
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());

    write_page_header(&mut out)?;

    for_each_row(&page_sql, |row| {
        write_page_row(&mut out, &row)?;
        Ok::<(), std::io::Error>(())
    })?;

    out.flush()?;

    Ok(())
}

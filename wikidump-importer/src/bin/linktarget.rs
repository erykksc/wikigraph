use std::fs::File;
use std::io::{self, BufReader, BufWriter, Write};

use wikidump_importer::outputs::csv::{write_linktarget_header, write_linktarget_row};
use wikidump_importer::parsers::linktarget::iter_rows;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let input_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "linktarget.sql".to_string());

    let file = File::open(&input_path)?;
    let reader = BufReader::new(file);
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());
    let row_limit = std::env::args()
        .nth(2)
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(usize::MAX);

    write_linktarget_header(&mut out)?;

    for row in iter_rows(reader).take(row_limit) {
        write_linktarget_row(&mut out, &row?)?;
    }

    out.flush()?;
    Ok(())
}

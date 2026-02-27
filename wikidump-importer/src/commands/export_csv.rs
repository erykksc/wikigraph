use std::fs::File;
use std::io::{self, BufReader, BufWriter, ErrorKind, Write};

use clap::{Args, ValueEnum};
use parse_mediawiki_sql::utils::memory_map;

use crate::outputs::csv::{
    write_linktarget_header, write_linktarget_row, write_page_header, write_page_row,
    write_pagelinks_header, write_pagelinks_row,
};
use crate::parsers::linktarget;
use crate::parsers::page;
use crate::parsers::pagelinks;

#[derive(Debug, Clone, Copy, ValueEnum)]
pub enum Table {
    #[value(name = "page")]
    Page,
    #[value(name = "linktarget")]
    LinkTarget,
    #[value(name = "pagelinks")]
    PageLinks,
}

impl Table {
    fn default_input_path(self) -> &'static str {
        match self {
            Self::Page => "page.sql",
            Self::LinkTarget => "linktarget.sql",
            Self::PageLinks => "pagelinks.sql",
        }
    }
}

#[derive(Debug, Args)]
pub struct ExportCsvArgs {
    #[arg(long, value_enum)]
    table: Table,
    #[arg(long)]
    input: Option<String>,
    #[arg(long)]
    limit: Option<usize>,
}

fn run_export_page(input_path: &str, limit: Option<usize>) -> io::Result<()> {
    let page_sql = unsafe { memory_map(input_path) }
        .map_err(|err| io::Error::new(ErrorKind::InvalidData, err.to_string()))?;
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());
    let row_limit = limit.unwrap_or(usize::MAX);
    let mut rows_written = 0usize;

    write_page_header(&mut out)?;
    page::for_each_row(&page_sql, |row| {
        if rows_written >= row_limit {
            return Ok(false);
        }
        write_page_row(&mut out, &row)?;
        rows_written += 1;
        Ok(true)
    })?;
    out.flush()
}

fn run_export_linktarget(input_path: &str, limit: Option<usize>) -> io::Result<()> {
    let file = File::open(input_path)?;
    let reader = BufReader::new(file);
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());

    write_linktarget_header(&mut out)?;
    let row_limit = limit.unwrap_or(usize::MAX);
    for row in linktarget::iter_rows(reader).take(row_limit) {
        write_linktarget_row(&mut out, &row?)?;
    }
    out.flush()
}

fn run_export_pagelinks(input_path: &str, limit: Option<usize>) -> io::Result<()> {
    let file = File::open(input_path)?;
    let reader = BufReader::new(file);
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());

    write_pagelinks_header(&mut out)?;
    let row_limit = limit.unwrap_or(usize::MAX);
    for row in pagelinks::iter_rows(reader).take(row_limit) {
        write_pagelinks_row(&mut out, &row?)?;
    }
    out.flush()
}

pub fn run_export_csv(args: ExportCsvArgs) -> io::Result<()> {
    let input_path = args
        .input
        .unwrap_or_else(|| args.table.default_input_path().to_string());

    match args.table {
        Table::Page => run_export_page(&input_path, args.limit),
        Table::LinkTarget => run_export_linktarget(&input_path, args.limit),
        Table::PageLinks => run_export_pagelinks(&input_path, args.limit),
    }
}

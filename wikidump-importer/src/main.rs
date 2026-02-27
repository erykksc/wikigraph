use std::fs::File;
use std::io::{self, BufReader, BufWriter, ErrorKind, Write};
use std::str;

use clap::{Args, Parser, Subcommand, ValueEnum};
use parse_mediawiki_sql::utils::memory_map;
use redis::RedisResult;
use wikidump_importer::outputs::csv::{
    write_linktarget_header, write_linktarget_row, write_page_header, write_page_row,
    write_pagelinks_header, write_pagelinks_row,
};
use wikidump_importer::parsers::linktarget;
use wikidump_importer::parsers::page;
use wikidump_importer::parsers::pagelinks;

#[derive(Debug, Parser)]
#[command(name = "wikidump_importer")]
#[command(about = "Parse MediaWiki SQL dumps")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    ExportCsv(ExportCsvArgs),
    #[command(name = "wikigraph-valkey")]
    WikigraphValkey(WikigraphValkeyArgs),
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum Table {
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
struct ExportCsvArgs {
    #[arg(long, value_enum)]
    table: Table,
    #[arg(long)]
    input: Option<String>,
    #[arg(long)]
    limit: Option<usize>,
}

#[derive(Debug, Args)]
struct WikigraphValkeyArgs {
    #[arg(long, default_value = "page.sql")]
    page: String,
    #[arg(long, default_value = "pagelinks.sql")]
    pagelinks: String,
    #[arg(long, default_value = "linktarget.sql")]
    linktarget: String,
    #[arg(long, default_value_t = 0)]
    namespace: i32,
    #[arg(long)]
    valkey_url: Option<String>,
    #[arg(long, default_value_t = 1000)]
    batch_size: usize,
}

#[derive(Debug, Default, Clone, Copy)]
struct UploadStats {
    scanned: usize,
    uploaded: usize,
    skipped_namespace: usize,
}

const PAGE_KEY_PREFIX: &str = "page:";
const PAGELINKS_KEY_PREFIX: &str = "pagelinks:";
const LINKTARGET_KEY_PREFIX: &str = "linktarget:";

fn resolve_valkey_url(args_url: Option<String>) -> String {
    if let Some(url) = args_url {
        return url;
    }
    if let Ok(url) = std::env::var("VALKEY_URL") {
        return url;
    }
    if let Ok(url) = std::env::var("REDIS_URL") {
        return url;
    }
    "redis://127.0.0.1:6379/".to_string()
}

fn flush_pipeline(pipe: &mut redis::Pipeline, conn: &mut redis::Connection) -> io::Result<()> {
    let result: RedisResult<()> = pipe.query(conn);
    result.map_err(|err| io::Error::other(err.to_string()))?;
    pipe.clear();
    Ok(())
}

fn upload_page_to_valkey(
    conn: &mut redis::Connection,
    input_path: &str,
    namespace_filter: i32,
    batch_size: usize,
) -> io::Result<UploadStats> {
    let page_sql = unsafe { memory_map(input_path) }
        .map_err(|err| io::Error::new(ErrorKind::InvalidData, err.to_string()))?;
    let mut stats = UploadStats::default();
    let mut pipe = redis::pipe();
    let mut queued = 0usize;

    page::for_each_row(&page_sql, |row| {
        stats.scanned += 1;
        if row.namespace != namespace_filter {
            stats.skipped_namespace += 1;
            return Ok(true);
        }

        pipe.cmd("SET")
            .arg(format!("{}{}", PAGE_KEY_PREFIX, row.title))
            .arg(row.id.to_string())
            .ignore();
        queued += 1;
        stats.uploaded += 1;

        if queued >= batch_size {
            flush_pipeline(&mut pipe, conn)?;
            queued = 0;
        }

        Ok(true)
    })?;

    if queued > 0 {
        flush_pipeline(&mut pipe, conn)?;
    }

    Ok(stats)
}

fn upload_pagelinks_to_valkey(
    conn: &mut redis::Connection,
    input_path: &str,
    namespace_filter: i32,
    batch_size: usize,
) -> io::Result<UploadStats> {
    let file = File::open(input_path)?;
    let reader = BufReader::new(file);
    let mut stats = UploadStats::default();
    let mut pipe = redis::pipe();
    let mut queued = 0usize;

    for row in pagelinks::iter_rows(reader) {
        let row = row?;
        stats.scanned += 1;
        if row.from_namespace != namespace_filter {
            stats.skipped_namespace += 1;
            continue;
        }

        pipe.cmd("SADD")
            .arg(format!("{}{}", PAGELINKS_KEY_PREFIX, row.from_id))
            .arg(row.target_id.to_string())
            .ignore();
        queued += 1;
        stats.uploaded += 1;

        if queued >= batch_size {
            flush_pipeline(&mut pipe, conn)?;
            queued = 0;
        }
    }

    if queued > 0 {
        flush_pipeline(&mut pipe, conn)?;
    }

    Ok(stats)
}

fn upload_linktarget_to_valkey(
    conn: &mut redis::Connection,
    input_path: &str,
    namespace_filter: i32,
    batch_size: usize,
) -> io::Result<UploadStats> {
    let file = File::open(input_path)?;
    let reader = BufReader::new(file);
    let mut stats = UploadStats::default();
    let mut pipe = redis::pipe();
    let mut queued = 0usize;

    for row in linktarget::iter_rows(reader) {
        let row = row?;
        stats.scanned += 1;
        if row.namespace != namespace_filter {
            stats.skipped_namespace += 1;
            continue;
        }
        let title = str::from_utf8(&row.title).map_err(|_| {
            io::Error::new(
                ErrorKind::InvalidData,
                "lt_title is not valid UTF-8 after SQL unescape",
            )
        })?;

        pipe.cmd("SET")
            .arg(format!("{}{}", LINKTARGET_KEY_PREFIX, row.id))
            .arg(title)
            .ignore();
        queued += 1;
        stats.uploaded += 1;

        if queued >= batch_size {
            flush_pipeline(&mut pipe, conn)?;
            queued = 0;
        }
    }

    if queued > 0 {
        flush_pipeline(&mut pipe, conn)?;
    }

    Ok(stats)
}

fn run_wikigraph_valkey(args: WikigraphValkeyArgs) -> io::Result<()> {
    if args.batch_size == 0 {
        return Err(io::Error::new(
            ErrorKind::InvalidInput,
            "--batch-size must be greater than 0",
        ));
    }

    let valkey_url = resolve_valkey_url(args.valkey_url);
    let client = redis::Client::open(valkey_url.as_str())
        .map_err(|err| io::Error::new(ErrorKind::InvalidInput, err.to_string()))?;
    let mut conn = client
        .get_connection()
        .map_err(|err| io::Error::new(ErrorKind::ConnectionRefused, err.to_string()))?;

    let _: String = redis::cmd("PING")
        .query(&mut conn)
        .map_err(|err| io::Error::new(ErrorKind::ConnectionRefused, err.to_string()))?;

    let page_stats = upload_page_to_valkey(&mut conn, &args.page, args.namespace, args.batch_size)?;
    let pagelinks_stats =
        upload_pagelinks_to_valkey(&mut conn, &args.pagelinks, args.namespace, args.batch_size)?;
    let linktarget_stats =
        upload_linktarget_to_valkey(&mut conn, &args.linktarget, args.namespace, args.batch_size)?;

    let stderr = io::stderr();
    let mut err_out = BufWriter::new(stderr.lock());
    writeln!(
        err_out,
        "uploaded page: scanned={}, uploaded={}, skipped_namespace={}",
        page_stats.scanned, page_stats.uploaded, page_stats.skipped_namespace
    )?;
    writeln!(
        err_out,
        "uploaded pagelinks: scanned={}, uploaded={}, skipped_namespace={}",
        pagelinks_stats.scanned, pagelinks_stats.uploaded, pagelinks_stats.skipped_namespace
    )?;
    writeln!(
        err_out,
        "uploaded linktarget: scanned={}, uploaded={}, skipped_namespace={}",
        linktarget_stats.scanned, linktarget_stats.uploaded, linktarget_stats.skipped_namespace
    )?;
    err_out.flush()
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

fn run_export_csv(args: ExportCsvArgs) -> io::Result<()> {
    let input_path = args
        .input
        .unwrap_or_else(|| args.table.default_input_path().to_string());

    match args.table {
        Table::Page => run_export_page(&input_path, args.limit),
        Table::LinkTarget => run_export_linktarget(&input_path, args.limit),
        Table::PageLinks => run_export_pagelinks(&input_path, args.limit),
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Command::ExportCsv(args) => run_export_csv(args)?,
        Command::WikigraphValkey(args) => run_wikigraph_valkey(args)?,
    }

    Ok(())
}

use std::fs::File;
use std::io::{self, BufReader, BufWriter, ErrorKind, Write};
use std::str;

use clap::Args;
use parse_mediawiki_sql::utils::memory_map;
use redis::RedisResult;

use crate::parsers::linktarget;
use crate::parsers::page;
use crate::parsers::pagelinks;

#[derive(Debug, Args)]
pub struct WikigraphValkeyArgs {
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

pub fn run_wikigraph_valkey(args: WikigraphValkeyArgs) -> io::Result<()> {
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

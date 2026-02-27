use std::fs::File;
use std::io::{self, BufReader, BufWriter, ErrorKind, Write};
use std::str;
use std::time::Instant;

use clap::Args;
use parse_mediawiki_sql::utils::memory_map;
use redis::RedisResult;

use crate::parsers::linktarget;
use crate::parsers::page;
use crate::parsers::pagelinks;

#[derive(Debug, Args)]
pub struct WikigraphRedisArgs {
    #[arg(long, default_value = "page.sql")]
    page: String,
    #[arg(long, default_value = "pagelinks.sql")]
    pagelinks: String,
    #[arg(long, default_value = "linktarget.sql")]
    linktarget: String,
    #[arg(long, default_value_t = 0)]
    namespace: i32,
    #[arg(long)]
    redis_url: Option<String>,
    #[arg(long, default_value_t = 1000)]
    batch_size: usize,
    #[arg(long, default_value_t = 100_000)]
    progress_every: usize,
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

struct ProgressReporter {
    table: &'static str,
    every: usize,
    next_scanned: usize,
    started_at: Instant,
}

impl ProgressReporter {
    fn new(table: &'static str, every: usize) -> Self {
        Self {
            table,
            every,
            next_scanned: every,
            started_at: Instant::now(),
        }
    }

    fn maybe_report(&mut self, stats: UploadStats) -> io::Result<()> {
        if self.every == 0 || stats.scanned < self.next_scanned {
            return Ok(());
        }

        let elapsed_secs = self.started_at.elapsed().as_secs_f64();
        let rows_per_sec = if elapsed_secs > 0.0 {
            stats.scanned as f64 / elapsed_secs
        } else {
            0.0
        };

        let stderr = io::stderr();
        let mut err_out = BufWriter::new(stderr.lock());
        writeln!(
            err_out,
            "progress {table}: scanned={scanned}, uploaded={uploaded}, skipped_namespace={skipped}, rows_per_sec={rows_per_sec:.0}",
            table = self.table,
            scanned = stats.scanned,
            uploaded = stats.uploaded,
            skipped = stats.skipped_namespace,
        )?;
        err_out.flush()?;

        while self.next_scanned <= stats.scanned {
            self.next_scanned = self.next_scanned.saturating_add(self.every);
        }

        Ok(())
    }
}

fn resolve_redis_url(args_url: Option<String>) -> String {
    if let Some(url) = args_url {
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

fn upload_page_to_redis(
    conn: &mut redis::Connection,
    input_path: &str,
    namespace_filter: i32,
    batch_size: usize,
    progress_every: usize,
) -> io::Result<UploadStats> {
    let page_sql = unsafe { memory_map(input_path) }
        .map_err(|err| io::Error::new(ErrorKind::InvalidData, err.to_string()))?;
    let mut stats = UploadStats::default();
    let mut progress = ProgressReporter::new("page", progress_every);
    let mut pipe = redis::pipe();
    let mut queued = 0usize;

    page::for_each_row(&page_sql, |row| {
        stats.scanned += 1;
        progress.maybe_report(stats)?;
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

fn upload_pagelinks_to_redis(
    conn: &mut redis::Connection,
    input_path: &str,
    namespace_filter: i32,
    batch_size: usize,
    progress_every: usize,
) -> io::Result<UploadStats> {
    let file = File::open(input_path)?;
    let reader = BufReader::new(file);
    let mut stats = UploadStats::default();
    let mut progress = ProgressReporter::new("pagelinks", progress_every);
    let mut pipe = redis::pipe();
    let mut queued = 0usize;

    for row in pagelinks::iter_rows(reader) {
        let row = row?;
        stats.scanned += 1;
        progress.maybe_report(stats)?;
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

fn upload_linktarget_to_redis(
    conn: &mut redis::Connection,
    input_path: &str,
    namespace_filter: i32,
    batch_size: usize,
    progress_every: usize,
) -> io::Result<UploadStats> {
    let file = File::open(input_path)?;
    let reader = BufReader::new(file);
    let mut stats = UploadStats::default();
    let mut progress = ProgressReporter::new("linktarget", progress_every);
    let mut pipe = redis::pipe();
    let mut queued = 0usize;

    for row in linktarget::iter_rows(reader) {
        let row = row?;
        stats.scanned += 1;
        progress.maybe_report(stats)?;
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

pub fn run_wikigraph_redis(args: WikigraphRedisArgs) -> io::Result<()> {
    if args.batch_size == 0 {
        return Err(io::Error::new(
            ErrorKind::InvalidInput,
            "--batch-size must be greater than 0",
        ));
    }

    let redis_url = resolve_redis_url(args.redis_url);
    let client = redis::Client::open(redis_url.as_str())
        .map_err(|err| io::Error::new(ErrorKind::InvalidInput, err.to_string()))?;
    let mut conn = client
        .get_connection()
        .map_err(|err| io::Error::new(ErrorKind::ConnectionRefused, err.to_string()))?;

    let _: String = redis::cmd("PING")
        .query(&mut conn)
        .map_err(|err| io::Error::new(ErrorKind::ConnectionRefused, err.to_string()))?;

    {
        let stderr = io::stderr();
        let mut err_out = BufWriter::new(stderr.lock());
        writeln!(
            err_out,
            "starting page import: input={}, namespace={}, batch_size={}, progress_every={}",
            args.page, args.namespace, args.batch_size, args.progress_every
        )?;
        err_out.flush()?;
    }

    let page_stats = upload_page_to_redis(
        &mut conn,
        &args.page,
        args.namespace,
        args.batch_size,
        args.progress_every,
    )?;

    {
        let stderr = io::stderr();
        let mut err_out = BufWriter::new(stderr.lock());
        writeln!(
            err_out,
            "starting pagelinks import: input={}, namespace={}, batch_size={}, progress_every={}",
            args.pagelinks, args.namespace, args.batch_size, args.progress_every
        )?;
        err_out.flush()?;
    }

    let pagelinks_stats = upload_pagelinks_to_redis(
        &mut conn,
        &args.pagelinks,
        args.namespace,
        args.batch_size,
        args.progress_every,
    )?;

    {
        let stderr = io::stderr();
        let mut err_out = BufWriter::new(stderr.lock());
        writeln!(
            err_out,
            "starting linktarget import: input={}, namespace={}, batch_size={}, progress_every={}",
            args.linktarget, args.namespace, args.batch_size, args.progress_every
        )?;
        err_out.flush()?;
    }

    let linktarget_stats = upload_linktarget_to_redis(
        &mut conn,
        &args.linktarget,
        args.namespace,
        args.batch_size,
        args.progress_every,
    )?;

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

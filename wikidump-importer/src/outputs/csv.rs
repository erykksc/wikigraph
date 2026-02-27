use std::io::{self, Write};

use crate::parsers::linktarget::LinkTargetRow;
use crate::parsers::page::PageRow;
use crate::parsers::pagelinks::PageLinkRow;

pub fn csv_escape(value: &str) -> String {
    if value.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

pub fn write_page_header<W: Write>(out: &mut W) -> io::Result<()> {
    writeln!(out, "pageName,pageId")
}

pub fn write_page_row<W: Write>(out: &mut W, row: &PageRow) -> io::Result<()> {
    writeln!(out, "{},{}", csv_escape(&row.title), row.id)
}

pub fn write_linktarget_header<W: Write>(out: &mut W) -> io::Result<()> {
    writeln!(out, "linktarget_id,target_namespace,target_title")
}

pub fn write_linktarget_row<W: Write>(out: &mut W, row: &LinkTargetRow) -> io::Result<()> {
    let title_text = std::str::from_utf8(&row.title).map_err(|_| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "lt_title is not valid UTF-8 after SQL unescape",
        )
    })?;
    writeln!(
        out,
        "{:016x},{},{}",
        row.id,
        row.namespace,
        csv_escape(title_text)
    )
}

pub fn write_pagelinks_header<W: Write>(out: &mut W) -> io::Result<()> {
    writeln!(out, "from_page_id,from_namespace,linktarget_id")
}

pub fn write_pagelinks_row<W: Write>(out: &mut W, row: &PageLinkRow) -> io::Result<()> {
    writeln!(
        out,
        "{:08x},{},{:016x}",
        row.from_id, row.from_namespace, row.target_id
    )
}

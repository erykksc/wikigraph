use std::io;

use crate::parsers::linktarget::LinkTargetRow;
use crate::parsers::page::PageRow;
use crate::parsers::pagelinks::PageLinkRow;

const PAGE_KEY_PREFIX: &str = "page:";
const PAGELINKS_KEY_PREFIX: &str = "pagelinks:";
const LINKTARGET_KEY_PREFIX: &str = "linktarget:";

pub fn queue_page_row(pipe: &mut redis::Pipeline, row: &PageRow) {
    pipe.cmd("SET")
        .arg(format!("{}{}", PAGE_KEY_PREFIX, row.title))
        .arg(row.id.to_string())
        .ignore();
}

pub fn queue_pagelinks_row(pipe: &mut redis::Pipeline, row: &PageLinkRow) {
    pipe.cmd("SADD")
        .arg(format!("{}{}", PAGELINKS_KEY_PREFIX, row.from_id))
        .arg(row.target_id.to_string())
        .ignore();
}

pub fn queue_linktarget_row(pipe: &mut redis::Pipeline, row: &LinkTargetRow) -> io::Result<()> {
    let title = std::str::from_utf8(&row.title).map_err(|_| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "lt_title is not valid UTF-8 after SQL unescape",
        )
    })?;

    pipe.cmd("SET")
        .arg(format!("{}{}", LINKTARGET_KEY_PREFIX, row.id))
        .arg(title)
        .ignore();

    Ok(())
}

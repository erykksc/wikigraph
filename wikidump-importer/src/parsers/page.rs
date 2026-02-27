use std::io;

use parse_mediawiki_sql::{iterate_sql_insertions, schemas::Page};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PageRow {
    pub id: u32,
    pub title: String,
}

pub fn for_each_row<F>(sql: &[u8], mut f: F) -> io::Result<()>
where
    F: FnMut(PageRow) -> io::Result<()>,
{
    for Page { id, title, .. } in &mut iterate_sql_insertions(sql) {
        f(PageRow {
            id: id.into_inner(),
            title: title.into_inner(),
        })?;
    }

    Ok(())
}

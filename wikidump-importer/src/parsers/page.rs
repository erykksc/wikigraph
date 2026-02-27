use std::io;

use parse_mediawiki_sql::{iterate_sql_insertions, schemas::Page};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PageRow {
    pub id: u32,
    pub namespace: i32,
    pub title: String,
}

pub fn for_each_row<F>(sql: &[u8], mut f: F) -> io::Result<()>
where
    F: FnMut(PageRow) -> io::Result<bool>,
{
    for Page {
        id,
        namespace,
        title,
        ..
    } in &mut iterate_sql_insertions(sql)
    {
        let should_continue = f(PageRow {
            id: id.into_inner(),
            namespace: namespace.into_inner(),
            title: title.into_inner(),
        })?;
        if !should_continue {
            break;
        }
    }

    Ok(())
}

use parse_mediawiki_sql::{iterate_sql_insertions, schemas::Page, utils::memory_map};

fn csv_escape(value: &str) -> String {
    if value.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let input_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "page.sql".to_string());

    let page_sql = unsafe { memory_map(&input_path)? };

    println!("pageName,pageId");

    for Page { id, title, .. } in &mut iterate_sql_insertions(&page_sql) {
        let page_name = title.into_inner();
        println!("{},{}", csv_escape(&page_name), id.into_inner());
    }

    Ok(())
}

use std::fs::File;
use std::io::{self, BufRead, BufReader, BufWriter, Write};
use wikidump_importer::sql_parsing::{
    find_insert_values_start, parse_i32, parse_sql_quoted_bytes, parse_u64, skip_spaces,
};

const INSERT_PREFIX: &[u8] = b"INSERT INTO `linktarget` VALUES ";

#[derive(Debug, Clone)]
struct LinkTargetRow {
    id: u64,
    namespace: i32,
    title: Vec<u8>,
}

fn parse_row(values: &[u8], mut i: usize) -> io::Result<(LinkTargetRow, usize)> {
    i = skip_spaces(values, i);
    if i >= values.len() || values[i] != b'(' {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "expected '(' at tuple start",
        ));
    }
    i += 1;

    // Field 1: lt_id (BIGINT UNSIGNED)
    let (id, j1) = parse_u64(values, i)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "failed to parse lt_id"))?;
    i = skip_spaces(values, j1);
    if i >= values.len() || values[i] != b',' {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "expected comma after lt_id",
        ));
    }
    i += 1;

    // Field 2: lt_namespace (INT)
    let (namespace, j2) = parse_i32(values, i).ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidData, "failed to parse lt_namespace")
    })?;
    i = skip_spaces(values, j2);
    if i >= values.len() || values[i] != b',' {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "expected comma after lt_namespace",
        ));
    }
    i += 1;

    // Field 3: lt_title (VARBINARY)
    let (title, j3) = parse_sql_quoted_bytes(values, i).ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "failed to parse lt_title as SQL string",
        )
    })?;
    i = skip_spaces(values, j3);
    if i >= values.len() || values[i] != b')' {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "expected closing ')'",
        ));
    }
    i += 1;

    Ok((
        LinkTargetRow {
            id,
            namespace,
            title,
        },
        i,
    ))
}

struct LinkTargetIter<R: BufRead> {
    reader: R,
    line: Vec<u8>,
    values_start: Option<usize>,
    cursor: usize,
}

impl<R: BufRead> LinkTargetIter<R> {
    fn new(reader: R) -> Self {
        Self {
            reader,
            line: Vec::new(),
            values_start: None,
            cursor: 0,
        }
    }
}

impl<R: BufRead> Iterator for LinkTargetIter<R> {
    type Item = io::Result<LinkTargetRow>;

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if let Some(values_start) = self.values_start {
                let values = &self.line[values_start..];
                self.cursor = skip_spaces(values, self.cursor);

                if self.cursor >= values.len() || values[self.cursor] == b';' {
                    self.values_start = None;
                    self.cursor = 0;
                    continue;
                }

                if values[self.cursor] != b'(' {
                    self.cursor += 1;
                    continue;
                }

                match parse_row(values, self.cursor) {
                    Ok((row, next_i)) => {
                        self.cursor = skip_spaces(values, next_i);
                        if self.cursor < values.len() && values[self.cursor] == b',' {
                            self.cursor += 1;
                        }
                        return Some(Ok(row));
                    }
                    Err(err) => return Some(Err(err)),
                }
            }

            self.line.clear();
            match self.reader.read_until(b'\n', &mut self.line) {
                Ok(0) => return None,
                Ok(_) => {
                    self.values_start = find_insert_values_start(&self.line, INSERT_PREFIX);
                    self.cursor = 0;
                }
                Err(err) => return Some(Err(err)),
            }
        }
    }
}

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
        .unwrap_or_else(|| "linktarget.sql".to_string());

    let file = File::open(&input_path)?;
    let mut reader = BufReader::new(file);
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());
    let row_limit = std::env::args()
        .nth(2)
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(usize::MAX);

    writeln!(out, "linktarget_id,target_namespace,target_title")?;

    for row in LinkTargetIter::new(&mut reader).take(row_limit) {
        let LinkTargetRow {
            id,
            namespace,
            title,
        } = row?;
        let title_text = std::str::from_utf8(&title).map_err(|_| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                "lt_title is not valid UTF-8 after SQL unescape",
            )
        })?;
        writeln!(out, "{:016x},{},{}", id, namespace, csv_escape(title_text))?;
    }

    out.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::parse_row;

    #[test]
    fn parse_row_handles_spaces() {
        let input = b"  ( 115058193 , -2 , 'Call_of_Duty' ) ,";
        let (row, i) = parse_row(input, 0).expect("must parse");
        assert_eq!(row.id, 115058193);
        assert_eq!(row.namespace, -2);
        assert_eq!(&row.title, b"Call_of_Duty");
        assert_eq!(input[i], b' ');
    }
}

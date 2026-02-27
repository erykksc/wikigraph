use std::fs::File;
use std::io::{self, BufRead, BufReader, BufWriter, Write};

const INSERT_PREFIX: &[u8] = b"INSERT INTO `pagelinks` VALUES ";

#[derive(Debug, Clone, Copy)]
struct PageLinkRow {
    from_id: u32,
    target_id: u64,
    from_namespace: i32,
}

fn skip_spaces(bytes: &[u8], mut i: usize) -> usize {
    while i < bytes.len() && matches!(bytes[i], b' ' | b'\t' | b'\r' | b'\n') {
        i += 1;
    }
    i
}

fn parse_u64(bytes: &[u8], mut i: usize) -> Option<(u64, usize)> {
    i = skip_spaces(bytes, i);
    let start = i;
    let mut n: u64 = 0;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        n = n.checked_mul(10)?.checked_add((bytes[i] - b'0') as u64)?;
        i += 1;
    }
    if i == start { None } else { Some((n, i)) }
}

fn parse_u32(bytes: &[u8], mut i: usize) -> Option<(u32, usize)> {
    i = skip_spaces(bytes, i);
    let start = i;
    let mut n: u32 = 0;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        n = n.checked_mul(10)?.checked_add((bytes[i] - b'0') as u32)?;
        i += 1;
    }
    if i == start { None } else { Some((n, i)) }
}

fn parse_i32(bytes: &[u8], mut i: usize) -> Option<(i32, usize)> {
    i = skip_spaces(bytes, i);
    let mut sign: i64 = 1;
    if i < bytes.len() && bytes[i] == b'-' {
        sign = -1;
        i += 1;
    }

    let start = i;
    let mut n: i64 = 0;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        n = n.checked_mul(10)?.checked_add((bytes[i] - b'0') as i64)?;
        i += 1;
    }
    if i == start {
        return None;
    }

    let signed = n.checked_mul(sign)?;
    let out = i32::try_from(signed).ok()?;
    Some((out, i))
}

fn parse_row(values: &[u8], mut i: usize) -> io::Result<(PageLinkRow, usize)> {
    i = skip_spaces(values, i);
    if i >= values.len() || values[i] != b'(' {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "expected '(' at tuple start",
        ));
    }
    i += 1;

    // Field 1: pl_from (INT UNSIGNED)
    let (from_id, j1) = parse_u32(values, i)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "failed to parse pl_from"))?;
    i = skip_spaces(values, j1);
    if i >= values.len() || values[i] != b',' {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "expected comma after pl_from",
        ));
    }
    i += 1;

    // Field 2: pl_from_namespace (INT)
    let (from_namespace, j2) = parse_i32(values, i).ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "failed to parse pl_from_namespace",
        )
    })?;
    i = skip_spaces(values, j2);
    if i >= values.len() || values[i] != b',' {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "expected comma after pl_from_namespace",
        ));
    }
    i += 1;

    // Field 3: pl_target_id (BIGINT UNSIGNED)
    let (target_id, j3) = parse_u64(values, i).ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidData, "failed to parse pl_target_id")
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
        PageLinkRow {
            from_id,
            target_id,
            from_namespace,
        },
        i,
    ))
}

fn find_insert_start(line: &[u8]) -> Option<usize> {
    line.windows(INSERT_PREFIX.len())
        .position(|w| w == INSERT_PREFIX)
        .map(|start| start + INSERT_PREFIX.len())
}

struct PageLinksIter<R: BufRead> {
    reader: R,
    line: Vec<u8>,
    values_start: Option<usize>,
    cursor: usize,
}

impl<R: BufRead> PageLinksIter<R> {
    fn new(reader: R) -> Self {
        Self {
            reader,
            line: Vec::new(),
            values_start: None,
            cursor: 0,
        }
    }
}

impl<R: BufRead> Iterator for PageLinksIter<R> {
    type Item = io::Result<PageLinkRow>;

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
                    self.values_start = find_insert_start(&self.line);
                    self.cursor = 0;
                }
                Err(err) => return Some(Err(err)),
            }
        }
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let input_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "pagelinks.sql".to_string());

    let file = File::open(&input_path)?;
    let mut reader = BufReader::new(file);
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());
    let row_limit = std::env::args()
        .nth(2)
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(usize::MAX);

    writeln!(out, "from_page_id,from_namespace,linktarget_id")?;

    for row in PageLinksIter::new(&mut reader).take(row_limit) {
        let PageLinkRow {
            from_id,
            from_namespace,
            target_id,
        } = row?;
        writeln!(out, "{:08x},{},{:016x}", from_id, from_namespace, target_id)?;
    }

    out.flush()?;
    Ok(())
}

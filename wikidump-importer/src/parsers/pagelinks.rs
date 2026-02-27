use std::io::{self, BufRead};

use crate::sql_parsing::{find_insert_values_start, parse_i32, parse_u32, parse_u64, skip_spaces};

const INSERT_PREFIX: &[u8] = b"INSERT INTO `pagelinks` VALUES ";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PageLinkRow {
    pub from_id: u32,
    pub target_id: u64,
    pub from_namespace: i32,
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

pub struct PageLinksIter<R: BufRead> {
    reader: R,
    line: Vec<u8>,
    values_start: Option<usize>,
    cursor: usize,
}

impl<R: BufRead> PageLinksIter<R> {
    pub fn new(reader: R) -> Self {
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
                    self.values_start = find_insert_values_start(&self.line, INSERT_PREFIX);
                    self.cursor = 0;
                }
                Err(err) => return Some(Err(err)),
            }
        }
    }
}

pub fn iter_rows<R: BufRead>(reader: R) -> PageLinksIter<R> {
    PageLinksIter::new(reader)
}

#[cfg(test)]
mod tests {
    use super::parse_row;

    #[test]
    fn parse_row_handles_spaces() {
        let input = b"  ( 199, 0, 115058193 ) ,";
        let (row, i) = parse_row(input, 0).expect("must parse");
        assert_eq!(row.from_id, 199);
        assert_eq!(row.from_namespace, 0);
        assert_eq!(row.target_id, 115058193);
        assert_eq!(input[i], b' ');
    }
}

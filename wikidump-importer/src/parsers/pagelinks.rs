use std::io::{self, BufRead};

use crate::sql_parsing::{parse_i32, parse_u32, parse_u64, skip_spaces};

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
    buf: [u8; 8192],
    buf_len: usize,
    buf_pos: usize,
    prefix_match: usize,
    in_values: bool,
    tuple_buf: Vec<u8>,
    in_quote: bool,
    quote_pending: bool,
    after_backslash: bool,
    finished: bool,
}

impl<R: BufRead> PageLinksIter<R> {
    pub fn new(reader: R) -> Self {
        Self {
            reader,
            buf: [0; 8192],
            buf_len: 0,
            buf_pos: 0,
            prefix_match: 0,
            in_values: false,
            tuple_buf: Vec::new(),
            in_quote: false,
            quote_pending: false,
            after_backslash: false,
            finished: false,
        }
    }

    fn process_byte(&mut self, b: u8) -> Option<io::Result<PageLinkRow>> {
        if !self.in_values {
            if b == INSERT_PREFIX[self.prefix_match] {
                self.prefix_match += 1;
                if self.prefix_match == INSERT_PREFIX.len() {
                    self.in_values = true;
                    self.prefix_match = 0;
                }
            } else {
                self.prefix_match = usize::from(b == INSERT_PREFIX[0]);
            }
            return None;
        }

        if self.tuple_buf.is_empty() {
            if b == b'(' {
                self.tuple_buf.push(b);
                self.in_quote = false;
                self.quote_pending = false;
                self.after_backslash = false;
            } else if b == b';' {
                self.in_values = false;
            }
            return None;
        }

        self.tuple_buf.push(b);

        if self.in_quote {
            if self.quote_pending {
                if b == b'\'' {
                    self.quote_pending = false;
                    return None;
                }
                self.in_quote = false;
                self.quote_pending = false;
            } else if self.after_backslash {
                self.after_backslash = false;
                return None;
            } else {
                match b {
                    b'\\' => {
                        self.after_backslash = true;
                        return None;
                    }
                    b'\'' => {
                        self.quote_pending = true;
                        return None;
                    }
                    _ => return None,
                }
            }
        }

        if !self.in_quote {
            if b == b'\'' {
                self.in_quote = true;
                self.quote_pending = false;
                self.after_backslash = false;
                return None;
            }

            if b == b')' {
                let tuple = std::mem::take(&mut self.tuple_buf);
                return Some(parse_row(&tuple, 0).map(|(row, _)| row));
            }
        }

        None
    }
}

impl<R: BufRead> Iterator for PageLinksIter<R> {
    type Item = io::Result<PageLinkRow>;

    fn next(&mut self) -> Option<Self::Item> {
        if self.finished {
            return None;
        }

        loop {
            if self.buf_pos >= self.buf_len {
                match self.reader.read(&mut self.buf) {
                    Ok(0) => {
                        self.finished = true;
                        if self.tuple_buf.is_empty() {
                            return None;
                        }
                        return Some(Err(io::Error::new(
                            io::ErrorKind::InvalidData,
                            "unexpected EOF while parsing pagelinks tuple",
                        )));
                    }
                    Ok(n) => {
                        self.buf_len = n;
                        self.buf_pos = 0;
                    }
                    Err(err) => {
                        self.finished = true;
                        return Some(Err(err));
                    }
                }
            }

            while self.buf_pos < self.buf_len {
                let b = self.buf[self.buf_pos];
                self.buf_pos += 1;
                if let Some(row) = self.process_byte(b) {
                    return Some(row);
                }
            }
        }
    }
}

pub fn iter_rows<R: BufRead>(reader: R) -> PageLinksIter<R> {
    PageLinksIter::new(reader)
}

#[cfg(test)]
mod tests {
    use std::io::{self, Cursor};

    use super::{iter_rows, parse_row};

    #[test]
    fn parse_row_handles_spaces() {
        let input = b"  ( 199, 0, 115058193 ) ,";
        let (row, i) = parse_row(input, 0).expect("must parse");
        assert_eq!(row.from_id, 199);
        assert_eq!(row.from_namespace, 0);
        assert_eq!(row.target_id, 115058193);
        assert_eq!(input[i], b' ');
    }

    #[test]
    fn iter_rows_respects_tuple_boundaries_on_single_line_insert() {
        let sql = b"INSERT INTO `pagelinks` VALUES (10,0,11),(12,1,13),(14,-2,15);";
        let rows = iter_rows(Cursor::new(&sql[..]))
            .take(2)
            .collect::<io::Result<Vec<_>>>()
            .expect("must parse first two rows");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].from_id, 10);
        assert_eq!(rows[1].from_id, 12);
    }
}

pub fn skip_spaces(bytes: &[u8], mut i: usize) -> usize {
    while i < bytes.len() && matches!(bytes[i], b' ' | b'\t' | b'\r' | b'\n') {
        i += 1;
    }
    i
}

pub fn parse_u64(bytes: &[u8], mut i: usize) -> Option<(u64, usize)> {
    i = skip_spaces(bytes, i);
    let start = i;
    let mut n: u64 = 0;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        n = n.checked_mul(10)?.checked_add((bytes[i] - b'0') as u64)?;
        i += 1;
    }
    if i == start { None } else { Some((n, i)) }
}

pub fn parse_u32(bytes: &[u8], mut i: usize) -> Option<(u32, usize)> {
    i = skip_spaces(bytes, i);
    let start = i;
    let mut n: u32 = 0;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        n = n.checked_mul(10)?.checked_add((bytes[i] - b'0') as u32)?;
        i += 1;
    }
    if i == start { None } else { Some((n, i)) }
}

pub fn parse_i32(bytes: &[u8], mut i: usize) -> Option<(i32, usize)> {
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

pub fn find_insert_values_start(line: &[u8], insert_prefix: &[u8]) -> Option<usize> {
    line.windows(insert_prefix.len())
        .position(|w| w == insert_prefix)
        .map(|start| start + insert_prefix.len())
}

pub fn parse_sql_quoted_bytes(bytes: &[u8], mut i: usize) -> Option<(Vec<u8>, usize)> {
    i = skip_spaces(bytes, i);
    if i >= bytes.len() || bytes[i] != b'\'' {
        return None;
    }
    i += 1;

    let mut out = Vec::new();
    while i < bytes.len() {
        match bytes[i] {
            b'\'' => {
                if i + 1 < bytes.len() && bytes[i + 1] == b'\'' {
                    out.push(b'\'');
                    i += 2;
                    continue;
                }
                i += 1;
                return Some((out, i));
            }
            b'\\' => {
                i += 1;
                if i >= bytes.len() {
                    return None;
                }
                let escaped = match bytes[i] {
                    b'0' => 0,
                    b'b' => 0x08,
                    b'n' => b'\n',
                    b'r' => b'\r',
                    b't' => b'\t',
                    b'Z' => 0x1A,
                    b'\'' => b'\'',
                    b'"' => b'"',
                    b'\\' => b'\\',
                    other => other,
                };
                out.push(escaped);
                i += 1;
            }
            other => {
                out.push(other);
                i += 1;
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::parse_sql_quoted_bytes;

    #[test]
    fn parse_sql_quoted_bytes_handles_escapes() {
        let input = br#"'Contributions/It\'s\\Fine\n' ,"#;
        let (value, i) = parse_sql_quoted_bytes(input, 0).expect("must parse");
        assert_eq!(&value, b"Contributions/It's\\Fine\n");
        assert_eq!(input[i], b' ');
    }
}

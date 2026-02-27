# AGENTS.md - wikidump-importer

Guide for agentic coding tools operating in this repository.

## 1. Project Snapshot
- Language: Rust
- Edition: 2024
- Crate: `wikidump_importer`
- Type: single Cargo package with binaries in `src/bin/`
- Purpose: parse Wikipedia SQL dumps into CSV outputs

Current binaries:
- `page` (`src/bin/page.rs`)
- `pagelinks` (`src/bin/pagelinks.rs`)
- `linktarget` (`src/bin/linktarget.rs`)

Key files:
- `Cargo.toml` - package metadata/dependencies
- `src/lib.rs` - shared module exports
- `src/sql_parsing.rs` - shared byte-level parsing helpers
- `src/bin/*.rs` - parser executables

## 2. Build/Lint/Test/Run Commands
Run from repository root.

Build:
```bash
cargo build
cargo build --release
cargo build --bin page
cargo build --bin pagelinks
cargo build --bin linktarget
```

Run:
```bash
cargo run --bin page
cargo run --bin page -- /path/to/page.sql

cargo run --bin pagelinks
cargo run --bin pagelinks -- /path/to/pagelinks.sql 1000

cargo run --bin linktarget
cargo run --bin linktarget -- /path/to/linktarget.sql 1000
```

Format and lint:
```bash
cargo fmt --all
cargo fmt --all -- --check
cargo clippy --all-targets --all-features
cargo clippy --all-targets --all-features -- -D warnings
```

Tests (full and scoped):
```bash
# all tests
cargo test

# library tests only
cargo test --lib

# per binary target
cargo test --bin page
cargo test --bin pagelinks
cargo test --bin linktarget
```

Single-test workflows (preferred inner loop):
```bash
# name filter across all targets
cargo test parse_row

# name filter inside one binary
cargo test --bin pagelinks parse_row
cargo test --bin linktarget parse_row

# exact single test
cargo test --bin linktarget parse_row_handles_spaces -- --exact
cargo test --lib parse_sql_quoted_bytes_handles_escapes -- --exact

# show test output
cargo test -- --nocapture
```

## 3. Code Style Guidelines

Imports:
- Order imports: `std`, third-party crates, local crate modules.
- Keep imports explicit and minimal.
- Remove unused imports; do not silence warnings.

Formatting:
- Rustfmt is required; do not hand-format around it.
- Keep files ASCII unless a file already requires Unicode.
- Add comments only for non-obvious logic or invariants.

Types and parsing:
- Use schema-aligned integer widths (`u32`, `u64`, `i32`).
- Prefer checked arithmetic for untrusted numeric parsing.
- Keep low-level parsing byte-oriented (`&[u8]`) in hot paths.
- Use `Option` for primitive parse helpers where failure is expected.
- Convert to `io::Result` at row/iterator boundaries with clear errors.

Naming conventions:
- Files/modules/functions/locals: `snake_case`
- Types/enums/traits: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Parser helper names should be specific and verb-based.

Error handling:
- Treat dump input as untrusted/malformed.
- Avoid panics in parser paths.
- Use `io::ErrorKind::InvalidData` for format/validation failures.
- Include field/token context in error messages.

I/O and performance:
- Use streaming reads (`BufRead`, `read_until`) for large dumps.
- Use `BufWriter` for output.
- Minimize allocations and UTF-8 conversions in tight loops.
- Keep iterator output deterministic and stable.

CLI/output compatibility:
- Preserve defaults unless explicitly requested to change.
- Keep CSV headers and column order stable.
- Keep output script-friendly and deterministic.

## 4. Testing Guidance for Parser Changes
Prefer focused unit tests for:
- whitespace around tuple fields
- missing separators/parentheses
- signed namespace edge cases
- numeric overflow boundaries
- SQL quoted string escapes (`\\`, `\'`, doubled `'`)
- semicolon/end-of-line tuple termination
- iterator behavior across multiple `INSERT` lines

Recommended validation sequence before handoff:
1. `cargo fmt --all -- --check`
2. `cargo test` (or clearly state scoped tests run)
3. `cargo clippy --all-targets --all-features -- -D warnings`

## 5. Cursor and Copilot Rules
Checked locations:
- `.cursor/rules/`
- `.cursorrules`
- `.github/copilot-instructions.md`

Status for this repository at generation time:
- No Cursor rule files found.
- No Copilot instruction file found.

If these files are added later, treat them as higher-priority local instructions.

## 6. Git and Workspace Hygiene
- Never edit generated files in `target/`.
- Do not commit large generated dump outputs unless requested.
- Keep changes tightly scoped to requested behavior.
- Avoid unrelated refactors in parser-critical files.
- In dirty worktrees, do not revert unrelated user changes.

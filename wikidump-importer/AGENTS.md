# AGENTS.md - wikidump-importer
Guide for agentic coding tools operating in this repository.

## 1. Project Snapshot
- Language: Rust
- Edition: 2024
- Package: `wikidump_importer`
- Structure: single crate with binaries under `src/bin/`
- Purpose: parse Wikipedia SQL dumps into CSV-like exports
- Core dependency: `parse-mediawiki-sql` (`utils` feature)

Current binaries:
- `page` (`src/bin/page.rs`): parses `page.sql`, outputs `pageName,pageId`
- `pagelinks` (`src/bin/pagelinks.rs`): parses `pagelinks.sql`, outputs `from_page_id,from_namespace,linktarget_id`

Repository layout:
- `Cargo.toml`: metadata and dependencies
- `Cargo.lock`: dependency lockfile
- `src/bin/`: executable sources
- `target/`: build artifacts (never edit manually)

## 2. Build/Lint/Test/Run Commands
Run commands from repo root.

```bash
# Build
cargo build
cargo build --release
cargo build --bin page
cargo build --bin pagelinks

# Run
cargo run --bin page
cargo run --bin page -- /path/to/page.sql
cargo run --bin pagelinks
cargo run --bin pagelinks -- /path/to/pagelinks.sql 1000

# Format
cargo fmt --all
cargo fmt --all -- --check

# Lint
cargo clippy --all-targets --all-features
cargo clippy --all-targets --all-features -- -D warnings

# Test (all)
cargo test

# Test (per target)
cargo test --bin page
cargo test --bin pagelinks

# Test (single by name filter)
cargo test parse_row

# Test (single in one target)
cargo test --bin pagelinks parse_row

# Test (single exact name)
cargo test --bin pagelinks parse_row_handles_spaces -- --exact

# Show test stdout
cargo test -- --nocapture
```

Notes:
- There are currently no committed tests; add unit tests when changing parser behavior.
- The single-test commands above are the preferred inner-loop workflow.

## 3. Coding Conventions

### 3.1 Imports
- Order imports by source: std first, third-party second.
- Keep imports minimal and remove unused imports.
- Prefer selective imports (`use std::io::{BufRead, BufWriter, Write};`).

### 3.2 Formatting
- Run `cargo fmt --all` after edits.
- Keep code ASCII unless the file already requires Unicode.
- Use concise comments only for non-obvious logic.
- Avoid large style-only rewrites in unrelated code.

### 3.3 Types and Parsing
- Use explicit integer widths when constrained by schema (`u32`, `u64`, `i32`).
- Use checked numeric operations for untrusted input.
- Use `Option` in low-level token parsers when absence/failure is expected.
- Convert parse failures to `io::Result` at boundary functions.
- Return `Result` from `main`; avoid process abort patterns.

### 3.4 Naming
- Files/modules/functions/locals: `snake_case`
- Types/structs/enums/traits: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Parser helper names should describe behavior (`parse_u64`, `skip_spaces`, `find_insert_start`).

### 3.5 Error Handling
- Treat dump contents as untrusted and potentially malformed.
- Do not panic on data-format errors.
- Use `io::ErrorKind::InvalidData` for parse validation failures.
- Error messages should include failed field/expectation context.

### 3.6 I/O and Performance
- Prefer streaming reads (`BufRead`, `read_until`) for large dump files.
- Prefer buffered writes (`BufWriter`) for large output streams.
- Keep hot parsing paths byte-oriented (`&[u8]`) where practical.
- Minimize allocations and string conversions in tight loops.

### 3.7 CLI Compatibility
- Preserve current default arguments unless explicitly asked to change.
- Keep output headers and column order stable for downstream tooling.
- Keep output deterministic and script-friendly.

## 4. Agent Validation Checklist
For parser or CLI behavior changes, run:
1. `cargo fmt --all -- --check`
2. `cargo clippy --all-targets --all-features -- -D warnings`
3. `cargo test` (or targeted single-test command during iteration)

Recommended smoke check when local data is available:
- `cargo run --bin pagelinks -- /path/to/pagelinks.sql 100`

## 5. Cursor and Copilot Rules
Checked for local rule files in:
- `.cursor/rules/`
- `.cursorrules`
- `.github/copilot-instructions.md`

Result:
- No Cursor rules or Copilot instructions were found in this repository at generation time.
- If added later, those files should be treated as higher-priority local instructions.

## 6. Git and Workspace Hygiene
- Do not edit generated build outputs in `target/`.
- Do not commit large generated CSV artifacts unless explicitly requested.
- Keep commits and changes scoped to requested behavior.
- Avoid unrelated refactors while touching parser-critical code.

## 7. Suggested Test Additions (When Modifying Parsers)
- Numeric overflow and underflow handling
- Leading/trailing whitespace around tuple fields
- Missing separators/parentheses
- Signed namespace parsing edge cases
- End-of-line and semicolon termination behavior
- Iterator behavior across multiple INSERT lines

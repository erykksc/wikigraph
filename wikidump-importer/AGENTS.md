# AGENTS.md - wikidump-importer

Guide for agentic coding tools operating in this repository.

## 1. Project Snapshot
- Language: Rust
- Edition: 2024
- Crate: `wikidump_importer`
- Type: single Cargo package with one CLI binary (`src/main.rs`) and library modules (`src/lib.rs`)
- Purpose: parse Wikipedia SQL dumps into CSV outputs and upload selected data to Redis-compatible storage

Current CLI subcommands:
- `export-csv`
- `redis`

Key files:
- `Cargo.toml` - package metadata/dependencies
- `src/main.rs` - CLI entrypoint
- `src/lib.rs` - module exports (`commands`, `outputs`, `parsers`, `sql_parsing`)
- `src/commands/mod.rs` - clap command wiring
- `src/commands/export_csv.rs` - CSV export subcommand
- `src/commands/redis.rs` - Redis upload subcommand
- `src/outputs/csv.rs` - CSV formatting/writers
- `src/outputs/redis.rs` - Redis key/value writer helpers
- `src/parsers/*.rs` - table-specific row parsers
- `src/sql_parsing.rs` - shared byte-level parsing helpers

## 2. Build/Lint/Test/Run Commands
Run from repository root.

Build:
```bash
cargo build
cargo build --release
cargo build --bin wikidump_importer
```

Run:
```bash
# CLI entrypoint
cargo run -- export-csv --table page --input /path/to/page.sql
cargo run -- export-csv --table pagelinks --input /path/to/pagelinks.sql --limit 1000
cargo run -- export-csv --table linktarget --input /path/to/linktarget.sql

cargo run -- redis --page /path/to/page.sql --pagelinks /path/to/pagelinks.sql --linktarget /path/to/linktarget.sql

# Optimized release run
cargo run --release -- redis --page ~/wikipedia/page.sql --pagelinks ~/wikipedia/pagelinks.sql --linktarget ~/wikipedia/linktarget.sql --namespace 0 --batch-size 1000 --progress-every 1000000
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

# binary entrypoint tests (if present)
cargo test --bin wikidump_importer

# parser-focused module tests
cargo test pagelinks::tests
cargo test linktarget::tests
cargo test sql_parsing::tests
```

Single-test workflows (preferred inner loop):
```bash
# name filter across all targets
cargo test parse_row

# name filter inside parser modules
cargo test pagelinks::tests::parse_row
cargo test linktarget::tests::parse_row

# exact single test
cargo test parse_row_handles_spaces -- --exact
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

## 7. Redis-Compatible Storage Upload Command and Database Shape

New subcommand:
- `redis`

Arguments:
- `--page` (default: `page.sql`)
- `--pagelinks` (default: `pagelinks.sql`)
- `--linktarget` (default: `linktarget.sql`)
- `--namespace` (default: `0`) - applied to all three tables
- `--batch-size` (default: `1000`) - number of write commands sent per pipeline flush
- `--progress-every` (default: `1000000`) - emit progress line every N scanned rows per table (`0` disables progress lines)
- `--redis-url` (optional) - if omitted, resolve from `REDIS_URL`, then `redis://127.0.0.1:6379/`

Filtering behavior:
- `page`: include rows where `page_namespace == --namespace`
- `pagelinks`: include rows where `pl_from_namespace == --namespace`
- `linktarget`: include rows where `lt_namespace == --namespace`

Resulting Redis-compatible keyspace (exact prefixes used by code):
- `page:<page_title>` -> Redis string (`SET`) whose value is decimal `page.id` (`u32`) text
- `pagelinks:<from_page_id>` -> Redis set (`SADD`) of decimal `pl_target_id` (`u64`) text members
- `linktarget:<linktarget_id>` -> Redis string (`SET`) whose value is decoded `lt_title` text

Encoding and format details:
- IDs in Redis keys/values are decimal (base-10), not the hex format used by CSV output for some columns.
- `linktarget` titles are SQL-unescaped bytes decoded as UTF-8 before writing; invalid UTF-8 returns `InvalidData` and aborts the command.
- No TTL/expiration is set by this command.
- Keys do not include namespace in their name; namespace only controls which rows are imported.

Operational notes for users:
- `pagelinks` is many-to-many, so `SADD` is used to accumulate multiple targets per source page.
- Duplicate `pagelinks` pairs are naturally deduplicated by Redis set semantics.
- `SET` keys for `page:*` and `linktarget:*` are overwritten if the same key is written again in later runs.
- The command does not clear existing keys. Re-running with different dumps/namespaces can leave mixed data unless you delete keys first.
- The command validates `--batch-size > 0` and fails fast on invalid values.
- The command prints progress and per-table counters to stderr: `scanned`, `uploaded`, `skipped_namespace`.

Recommended usage example:
```bash
cargo run --release -- redis \
  --page ~/wikipedia/page.sql \
  --pagelinks ~/wikipedia/pagelinks.sql \
  --linktarget ~/wikipedia/linktarget.sql \
  --namespace 0 \
  --batch-size 1000
```

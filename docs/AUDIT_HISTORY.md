# md2pdf Bug Audit History

This file documents every bug found across all audit sessions.
Reference this when writing fixes — check if your fix is for a recurring pattern.

## Recurring Patterns (Fix These First)

| ID | Pattern | Versions affected | Status |
|----|---------|------------------|--------|
| RP01 | Debug/scratch scripts committed to repo root | v0.8.4, v0.8.5 | Fixed v0.8.6 |
| RP02 | `assets/mermaid.min.js` missing from published package | v0.8.0–v0.8.2 | Fixed v0.8.3 |
| RP03 | `process.exitCode` overwritten by async cleanup (chmod 000 exits 0) | v0.7.1–v0.8.6 | Partial fix |
| RP04 | Validation check happens AFTER cache check, bypassed on warm hit | v0.8.4–v0.8.5 | Fixed v0.8.6 |
| RP05 | New error paths added without `code` field in `--json-errors` output | v0.8.1–v0.8.5 | Partial fix |
| RP06 | `playwright-core` version mismatch breaks `md2pdf init` on fresh install | v0.8.5 | Partial fix |
| RP07 | Untested code paths ship with wrong exit codes | all versions | Ongoing |

---

## Complete Bug History

### v0.7.1 Audit (54 tests, 87% pass)

| Bug | Description | Severity | Fixed |
|-----|-------------|----------|-------|
| B01 | chmod 000 file generates PDF successfully, exits 0 | Critical | Partial (v0.8.6) |
| B02 | `--json-errors` post-spinner errors go to stderr, not stdout | High | v0.8.4 |
| B03 | `--mermaid-theme` invalid value silently ignored | Medium | v0.8.x |
| B04 | `--verbose` flag is a no-op, shows no extra info | Low | v0.8.x |
| B05 | Output parent dir not validated, fails with raw ENOENT stack trace | Medium | v0.8.x |
| B06 | Browser cache not written after discovery, rediscovers every run | Critical | v0.8.x |

### v0.8.1 Audit (70 tests, 81% pass)

| Bug | Description | Severity | Fixed |
|-----|-------------|----------|-------|
| B07 | `assets/mermaid.min.js` missing from published package (crash on every mermaid file) | Critical | v0.8.3 |
| B08 | Cache warm runs still ~2.7s wall-clock (browser still launches) | High | v0.8.4 |
| B09 | `-o /existing-dir` silently writes to wrong path instead of erroring | High | v0.8.2 |
| B10 | `publish: false` → `--json-errors` shows `success: false` (should be `true`) | Medium | v0.8.2 |
| B11 | `--json-errors` missing `code` field in 10 of 15 error cases | Medium | v0.8.6 |
| B12 | No args exits 0 instead of 1 | Medium | v0.8.2 |
| B13 | `-o /tmp/` trailing slash bypasses directory check | Medium | v0.8.2 |

### v0.8.2 Audit (96 tests, 88% pass)

| Bug | Description | Severity | Fixed |
|-----|-------------|----------|-------|
| B14 | Batch with any failures exits 0 | High | v0.8.6 |
| B15 | `--margin` invalid value exits 0 | Medium | v0.8.4 |
| B16 | `--json-errors` output is invalid JSON for `-o /dir` error | Medium | v0.8.4 |

### v0.8.3 Audit (101 tests, 92% pass)

| Bug | Description | Severity | Fixed |
|-----|-------------|----------|-------|
| B17 | Single file warm still 2.7s (cache check after browser launch) | High | v0.8.4 |
| B18 | `publish: false` skip message conflated with overwrite skip in batch summary | Low | v0.8.4 |
| B19 | Batch result objects missing `code` field per file | Medium | Partial (v0.8.6) |

### v0.8.4 Audit (95 tests, 89% pass)

| Bug | Description | Severity | Fixed |
|-----|-------------|----------|-------|
| B20 | Path traversal exits 0 both cold AND on warm cache hit | High | v0.8.6 |
| B21 | `--browser /nonexistent` exits 0 when file is cached | High | v0.8.6 |
| B22 | Browser cache `md2pdfVersion` stores `"unknown"` | Low | v0.8.6 |
| B23 | `test_read_cache.js` debug file committed to repo root | Low | v0.8.6 |

### v0.8.5 Audit (100 tests, 88% pass)

| Bug | Description | Severity | Fixed |
|-----|-------------|----------|-------|
| B24 | `playwright-core@1.61.1` + fresh install = browser not found (version mismatch) | Critical | v0.8.6 (partial) |
| B25 | `--mermaid-theme bad` prints raw Commander output instead of boxed format | Medium | v0.8.6 |
| B26 | Batch `0 succeeded, N failed` exits 0 | High | v0.8.6 |

### v0.8.6 Audit (pre-publish, 23/23 exit codes correct)

| Bug | Description | Severity | Status |
|-----|-------------|----------|--------|
| B27 | chmod 000 exits 0 (RP03 still active in root environments) | Medium | Known, non-blocking |
| B28 | Batch result per-file `code` field still `—` for conversion errors | Low | Known, non-blocking |

---

## Rules Derived From This History

1. **Never add a new error path without also adding it to Gate 5 and Gate 6.**
2. **Never let validation run after `checkCache()`.** Order: validate → check cache → launch browser → convert.
3. **Never use `process.exitCode =` and then `return` in async code.** Use `process.exit()` at the very end of the async chain, or derive the exit code from `hasErrors` in a synchronous finally block.
4. **Always run `npm pack --dry-run` and verify `assets/mermaid.min.js` is in the output before publishing.**
5. **Always pin `playwright-core` exactly (not `^` or `~`) and verify `md2pdf init` installs the same revision.**
6. **Any file named `test_*.js`, `fix-*.js`, or `scratch*.js` in the repo root is a bug waiting to happen. Add these patterns to `.gitignore`.**

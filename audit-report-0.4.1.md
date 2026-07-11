# audit-report-0.4.1.md

## Executive Summary
This session collected reproducible evidence for md2pdf audit tasks, but the local repository/package under test reports **v0.2.4**, while npm registry latest is **v0.4.1**.

- Local CLI `--version`: `0.2.4` (`/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/cli-version.txt`)
- npm registry version: `0.4.1` (`/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/npm-view-version.txt`)

Because the checked-out code is not v0.4.1, results apply to the tested codebase state only.

## Environment
- Node: v22.23.1
- npm: 10.9.8
- OS: Linux 6.17.0-1018-azure x86_64
- Playwright: 1.61.1 (installed binaries present)

Evidence:
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/node-version.txt`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/npm-version.txt`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/uname.txt`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/playwright-version.txt`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/playwright-install-list.txt`

## Methodology
Executed:
- Baseline install/build/dependency checks
- CLI option matrix tests
- Input/output validation tests
- Rendering fixture tests (including math/mermaid/obsidian-like content)
- Installation mode matrix (local source, tarball, npm package)

Captured raw artifacts under:
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/`

## Project Structure
Top-level areas inspected: `src/`, `tests/`, `scripts/`, `templates/`, `.github/workflows/`, docs, package metadata.

## Dependency Audit
- `npm audit` reported 4 vulnerabilities (2 moderate, 1 high, 1 critical), centered on vitest/vite/esbuild toolchain.
- `npm run doctor` script does not exist (npm script-level command), but CLI doctor command works.

Evidence:
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/npm-audit.json`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/npm-doctor.log`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/cli-doctor.json`

## Browser Detection Audit
See dedicated report: `/home/runner/work/md2pdf/md2pdf/browser-detection-audit.md`.

## Playwright Audit
- Chromium installed in Playwright cache.
- Cache total size: 646M.
- Binaries: chromium-1228 (379M), chromium_headless_shell-1228 (262M), ffmpeg-1011 (4.9M).

Evidence:
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/install-tests/playwright-cache-size.txt`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/install-tests/playwright-binaries-size.txt`

## Feature Testing
### CLI highlights
- Supported flags work: `--help`, `--version`, `--output`, `--toc`, `--theme`, `--json-errors`, etc.
- Unsupported/unknown flags fail: `--stdin`, `--stdout`, `--quiet`, `--browser`, `--input`.
- Duplicate `-o` accepted; last value used.

Evidence:
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/data/cli-case-results.tsv`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/cli-tests/out/browser_flag.err`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/cli-tests/out/stdin_flag.err`

### Input/output/render highlights
- Huge input case aborted with OOM (`signal 6`, V8 heap OOM trace).
- Readonly output path fails with permission-related error path.
- UTF-8/UTF-16/binary/invalid-encoding cases in this run did not universally fail and often produced output.

Evidence:
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/data/input-output-render-results.tsv`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/huge.err`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/readonly.err`

## Performance Benchmarks
Only partial timings were collected (single-run timings for many cases). Full 30-iteration statistical benchmark target was not completed.

## Browser Benchmarks
Cross-browser benchmark matrix (Chrome/Chromium/Edge/Brave/Opera/Vivaldi/Firefox) was not completed in this session.

## Raw Timing Tables
See:
- `/home/runner/work/md2pdf/md2pdf/raw-benchmark-data.md`

## Bug Findings
See:
- `/home/runner/work/md2pdf/md2pdf/bug-report-0.4.1.md`

## Recommendations
1. Check out/tag exact v0.4.1 code before re-running complete audit.
2. Implement or remove undocumented CLI flags expected by test scope (`--stdin`, `--stdout`, `--quiet`, `--browser`, `--input`).
3. Add explicit large-input protection to avoid OOM crashes.
4. Expand browser detection to real multi-browser discovery if required by product goals.

## Appendices
- Full logs and artifacts in `/home/runner/work/md2pdf/md2pdf/audit-artifacts/`

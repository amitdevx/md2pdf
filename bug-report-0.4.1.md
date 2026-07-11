# bug-report-0.4.1.md

## B-001
- Severity: High
- Title: Large markdown input causes process OOM crash
- Reproduction Steps:
  1. Run `node dist/cli/index.js audit-artifacts/input-tests/huge.md -o audit-artifacts/output-tests/out/huge.pdf`
- Expected Behavior: Graceful failure or successful completion without hard crash.
- Actual Behavior: Process aborts (signal 6) with V8 OOM.
- Logs: `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/huge.err`
- Evidence: Entry `input/huge` in `/home/runner/work/md2pdf/md2pdf/audit-artifacts/data/input-output-render-results.tsv`
- Suggested Fix: Add input size limits, streaming strategy, and pre-render memory safeguards.

## B-002
- Severity: Medium
- Title: CLI advertised audit scope flags are not implemented (`--browser`, `--stdin`, `--stdout`, `--quiet`, `--input`)
- Reproduction Steps:
  1. Run each flagged command from `audit-artifacts/data/cli-case-results.tsv` (`browser_flag`, `stdin_flag`, `stdout_flag`, `quiet_flag`, `input_flag`).
- Expected Behavior: Option recognized and handled.
- Actual Behavior: Unknown option errors.
- Logs:
  - `/home/runner/work/md2pdf/md2pdf/audit-artifacts/cli-tests/out/browser_flag.err`
  - `/home/runner/work/md2pdf/md2pdf/audit-artifacts/cli-tests/out/stdin_flag.err`
- Evidence: corresponding rows in `cli-case-results.tsv`.
- Suggested Fix: implement options or update CLI contract/docs to avoid unsupported expectation.

## B-003
- Severity: Medium
- Title: Version mismatch for requested target audit version
- Reproduction Steps:
  1. Run `node dist/cli/index.js --version` (returns 0.2.4)
  2. Run `npm view @amitdevx/md2pdf version` (returns 0.4.1)
- Expected Behavior: audited code version matches requested target.
- Actual Behavior: local code under test is older than requested target.
- Logs:
  - `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/cli-version.txt`
  - `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/npm-view-version.txt`
- Suggested Fix: checkout/tag exact v0.4.1 before final audit sign-off.

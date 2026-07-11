# browser-detection-audit.md

## Detection order
Based on inspected code paths:
- Core conversion path imports `playwright` and launches `chromium.launch(...)` directly.
- No CLI-level `--browser` option is implemented in current help/output and runtime.

Evidence:
- `/home/runner/work/md2pdf/md2pdf/src/core/index.ts` lines 115-118
- `/home/runner/work/md2pdf/md2pdf/src/pdf/index.ts` lines 17-19
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/cli-help.txt`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/cli-tests/out/browser_flag.err`

## Fallback order
Observed fallback during install script:
1. `node_modules/.bin/playwright install chromium`
2. fallback to `npx playwright install chromium`

Evidence:
- `/home/runner/work/md2pdf/md2pdf/scripts/install-browser.mjs`

## Failure cases
- Unknown `--browser` CLI option.
- Browser launch errors mapped via `detectBrowserError` to categorized error codes.

Evidence:
- `/home/runner/work/md2pdf/md2pdf/src/errors/detect.ts`

## Unsupported browsers
No runtime support path was verified for Edge/Brave/Opera/Vivaldi/Firefox selection in this session.

## Edge cases
- Browser executable missing
- Missing Linux shared libs
- Sandbox issues
- OOM
- Permission denied
- Unsupported architecture
- Network timeout

These are classified in `src/errors/detect.ts`.

## Performance impact
Only Playwright Chromium path timings were collected indirectly in CLI test timings; dedicated browser-detection performance profiling was not completed.

## Potential bugs
1. Missing `--browser` support despite requirement scope.
2. Direct Chromium launch path limits cross-browser strategy.

## Suggestions
1. Add explicit browser resolution strategy and CLI selection support.
2. Add telemetry/timing around browser discovery and launch fallback.
3. Add integration tests for browser fallback and unsupported-browser handling.

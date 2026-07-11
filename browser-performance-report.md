# browser-performance-report.md

## Scope Status
Requested cross-browser benchmark matrix was **not completed** in this session.

Browsers requested:
- Playwright bundled Chromium
- System Chrome
- Chromium
- Edge
- Brave
- Opera
- Vivaldi
- Firefox (if supported)

## Collected Browser Evidence
- Playwright bundled Chromium is installed and used in tests.
- Browser cache and binary sizes captured.

Evidence:
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/logs/playwright-install-list.txt`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/install-tests/playwright-cache-size.txt`
- `/home/runner/work/md2pdf/md2pdf/audit-artifacts/install-tests/playwright-binaries-size.txt`

## Metrics Table
No multi-browser timing dataset was collected in this session for:
- Average / Median / Min / Max / P95 / P99 / Std Dev
- Memory / CPU / Startup Time / PDF Time / Cleanup Time
- Render Accuracy cross-browser comparison

## Browser Detection Result
Current implementation launches Playwright Chromium directly; no complete system-browser priority chain was verified in execution for all requested browser families.

## Fallback Result
Not fully benchmarked across browsers in this session.

# tests/snapshots/ — Approved Visual Snapshots

This directory contains the **approved rendered output** of all golden documents.
Snapshots are committed to git and serve as the reference for visual regression.

---

## Structure

```
tests/snapshots/
├── README.md                 ← You are here
├── basic/
│   ├── default.pdf           ← approved PDF (rendered with default theme)
│   └── default-001.png       ← rasterized first page (for quick CI diff)
├── code-blocks/
│   └── default.pdf
├── tables/
│   └── default.pdf
├── mermaid-all/
│   ├── default.pdf           ← light theme render
│   └── obsidian-dark.pdf     ← dark theme render
├── academic/
│   └── academic.pdf          ← rendered with academic theme
...
```

Snapshots are created with: `npm run golden:approve`

---

## Rules

- ✅ Snapshots are committed to git
- ✅ Approval is always a deliberate human act — review the diff before approving
- ❌ Never auto-approve in CI — CI only checks, never writes snapshots
- ❌ Never delete a snapshot without understanding why the output changed

---

## Diffing

CI diffs are performed with `pixelmatch`:
- Fail threshold: > 0.1% differing pixels per page
- Diff images (showing changed pixels in red) written to `tests/diff/` (gitignored)

---

## How to Approve a Change

```sh
npm run golden:render     # render all fixtures to tests/output/
npm run golden:diff       # view diff report
# Review output visually — open tests/output/<fixture>/<theme>.pdf
npm run golden:approve    # copy tests/output/ → tests/snapshots/
git add tests/snapshots/  # commit the new snapshots
```

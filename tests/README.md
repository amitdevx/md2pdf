# tests/

Test suite for `@amitdevx/md2pdf`.

---

## Directory Map

```
tests/
├── README.md                ← You are here
│
├── fixtures/                ← Golden documents (permanent, curated Markdown sources)
│   └── README.md            ← Fixture inventory and golden document strategy summary
│
├── snapshots/               ← Approved PDF + PNG snapshots (committed to git)
│   └── README.md            ← How snapshots work, how to approve
│
├── output/                  ← Rendered output during test runs (gitignored)
├── diff/                    ← Pixel-diff images from failed comparisons (gitignored)
│
├── parser/
│   └── index.test.ts        ← Unit tests for Markdown → HTML AST parsing
│
├── renderer/
│   └── index.test.ts        ← Unit tests for HTML template rendering
│
├── pdf/
│   └── index.test.ts        ← Integration tests for Playwright PDF generation
│
├── cli/                     ← End-to-end CLI tests
│
└── benchmarks/              ← Performance benchmarks (added v0.8.0)
    └── README.md
```

---

## Test Types

| Type | Runner | Location | Speed |
|------|--------|----------|-------|
| Unit tests | Vitest | `parser/`, `renderer/`, `pdf/` | Fast (< 5s) |
| E2E CLI tests | Vitest | `cli/` | Medium (< 30s) |
| Golden doc visual regression | Custom scripts | `fixtures/` + `snapshots/` | Slow (minutes) |
| Performance benchmarks | Custom scripts | `benchmarks/` | Very slow |

---

## Commands

```sh
npm test                  # run unit + E2E tests (Vitest)
npm run test:watch        # watch mode

npm run golden:render     # render all golden fixtures → tests/output/
npm run golden:diff       # pixel-diff output vs snapshots → report
npm run golden:approve    # overwrite snapshots (after human visual review)
npm run golden:check      # render + diff + fail on regression (CI)

npm run bench             # run all benchmarks (added v0.8.0)
```

---

## What Is a Golden Document?

> See [`fixtures/README.md`](./fixtures/README.md) and [`/phase/GOLDEN-DOCUMENTS.md`](../phase/GOLDEN-DOCUMENTS.md) for the full strategy.

Golden documents are permanent, curated Markdown files that cover every rendering concern.
After every feature change: **Render → Compare → Approve or Fix**.

# @amitdevx/md2pdf — v0.1.3 Pre-Release Quality Audit

**Date:** 2026-06-28  
**Version audited:** 0.1.3 (4 commits ahead of origin, not pushed)  
**Auditor:** Claude (automated audit + manual code review)  
**Scope:** Post-fix commit (`7bd3f33`) + v0.1.3 feature commit (`fa6a9dc`)

---

## Executive Summary

| Category | Count |
|----------|-------|
| Critical (blocks CI / non-functional feature) | 2 |
| Bugs | 3 |
| Wrong package / packaging issue | 1 |
| Missing public API exports | 1 |
| Missing tests | 3 |
| Incomplete fixtures | 2 |
| Docs gaps | 2 |
| Phase file inconsistencies | 2 |

**Verdict: NOT ready to push/publish.** Two critical issues block CI and make the flagship `<!-- pagebreak -->` feature completely non-functional.

---

## Build / CI Status

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | **FAIL** — 1 error |
| `npm run build` | PASS |
| `npm run test` | PASS (5/5) |

---

## CRITICAL Issues

### C1 — ESLint ERROR: unused `Text` import in `page-breaks.ts`

**File:** `src/plugins/page-breaks.ts:2`

```ts
import { Root, Element, Text, Comment } from 'hast';
//                        ^^^^  ^^^^^^^ — Text is imported but never used
```

`npm run lint` exits with code 1 (error, not warning). This would fail any CI pipeline that runs lint before publish. `Comment` is also imported but whether it's used is moot since `comment` nodes never appear (see C2).

**Fix:** Remove `Text` from the import. Remove `Comment` once C2 is resolved (see below).

---

### C2 — `<!-- pagebreak -->` detection is completely broken

**File:** `src/plugins/page-breaks.ts:17`

```ts
if (node.type === 'comment' && (node as Comment).value.trim() === 'pagebreak') {
```

**Root cause:** `remark-rehype` with `allowDangerousHtml: true` converts HTML blocks (including comments) from Markdown into hast `raw` nodes, **not** `comment` nodes. A `comment` node only appears when HTML is parsed by `rehype-parse` (not from Markdown source).

**Verified in runtime:**
```
Node type: raw    value: "<!-- pagebreak -->"   ← actual type
Node type: comment                              ← what the plugin checks (never matches)
```

The `<!-- pagebreak -->` feature, which is the primary manual page-break mechanism described in the phase spec and acceptance criteria, **produces no output at all**. The `md2pdf-page-break` div is never injected.

**Fix (two options):**

Option A — check for `raw` nodes (no new deps):
```ts
// In rehypePageBreaks, replace the comment check with:
if (node.type === 'raw') {
  const raw = node as unknown as { type: 'raw'; value: string };
  if (raw.value.trim() === '<!-- pagebreak -->') {
    const pageBreakElement: Element = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['md2pdf-page-break'], style: 'page-break-before: always;' },
      children: [],
    };
    parent.children.splice(index, 1, pageBreakElement);
    return;
  }
}
```

Option B — add `rehype-raw` to the pipeline before `rehypePageBreaks`. This converts raw nodes into proper hast nodes (including real `comment` nodes), enabling the existing check to work. Costs one new dependency.

---

## Bugs

### B1 — `header: { enabled: false }` is silently treated as enabled

**File:** `src/core/index.ts:53`

```ts
if (options.header) {   // { enabled: false } is a truthy object — always true
```

The `ConvertOptions` type allows `header?: boolean | { enabled?: boolean; template?: string }`. A user passing `{ enabled: false }` intends to disable the header, but the truthiness check activates it.

**Fix:**
```ts
const headerEnabled = options.header === true ||
  (typeof options.header === 'object' && options.header.enabled !== false);
if (headerEnabled) { ... }
```
Same for `options.footer`.

---

### B2 — `h1NewPage` adds `page-break-before: always` to the very first heading, creating a blank leading page

**File:** `src/plugins/page-breaks.ts:32-39`

The plugin adds `md2pdf-page-break-before` to **every** `h1`, including the first element in the document. In Playwright's print engine, `page-break-before: always` on the first element creates a blank page before all content.

The code comment acknowledges this ("Don't add page break before the very first element") but then does nothing about it. The plugin has no concept of position in the document.

**Fix:** Skip the first `h1` in the document:
```ts
let firstH1Seen = false;
visit(tree, (node, index, parent) => {
  if (node.type === 'element' && (node as Element).tagName === 'h1') {
    if (!firstH1Seen) { firstH1Seen = true; return; }
    // add class only to subsequent h1s
  }
});
```

---

### B3 — `injectMetadata` reads `package.json` from disk on every PDF conversion

**File:** `src/pdf/metadata.ts:17-19`

```ts
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '../../package.json');
const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
```

This performs async disk I/O on every single call to get a version string that never changes at runtime. Minor but avoidable. Move the version read to module level or use a build-time constant.

---

## Packaging Issues

### P1 — `hast@0.0.2` is the wrong package

**File:** `package.json` devDependencies

The previous agent installed `hast@0.0.2`, which is a 2014 HTML processor placeholder with **no TypeScript type definitions**. The imports in `toc.ts` and `page-breaks.ts` resolve correctly only because `@types/hast@3.0.4` is available as a **transitive dependency** of `remark-rehype`.

```json
// Wrong — this package has no .d.ts files
"hast": "^0.0.2"

// Correct — should be one of:
"@types/hast": "^3.0.0"   // explicit devDep for the types
// OR just remove it — @types/hast is already transitively available
```

If a future parent dep stops depending on `@types/hast`, types will silently break.

---

## Missing Public API Export

### A1 — `PdfMetadata` not exported from public API

**File:** `src/index.ts`

```ts
export { convert } from './core/index.js';
export type { ConvertOptions, ConvertResult } from './types/index.js';
// PdfMetadata is missing ↑
```

`ConvertOptions.metadata` is typed as `PdfMetadata`. Any user who imports the package and wants to declare a typed metadata object **cannot** do so without importing from the internal path. This is a public API gap.

**Fix:**
```ts
export type { ConvertOptions, ConvertResult, PdfMetadata } from './types/index.js';
```

---

## Missing Tests

### T1 — No unit tests for `rehypePageBreaks`

The new plugin (`src/plugins/page-breaks.ts`) has zero test coverage. Neither the `<!-- pagebreak -->` path nor the `h1NewPage` path is exercised by any test. Given that C2 shows the `<!-- pagebreak -->` path is broken, tests would have caught this immediately.

---

### T2 — No tests for `header` / `footer` options in `convert()`

The new CLI flags `--header`, `--footer`, `--header-template`, `--footer-template` and the corresponding `convert()` options are not exercised by any test. The `displayHeaderFooter`, `headerTemplate`, `footerTemplate` plumbing in `src/pdf/index.ts` is also untested.

---

### T3 — `pageCounts` real implementation is untested

The previous audit noted `pageCounts: 0` as a bug. It is now correctly wired to `pdfDoc.getPageCount()`, but no test asserts this. The existing PDF test only checks `stat.isFile()` and `stat.size > 0`.

---

## Incomplete Fixtures

### F1 — `long-document.md` is 16 lines (spec: 50+ pages)

**File:** `tests/fixtures/long-document.md`

The phase spec says: *"50+ pages to stress-test layout."* The actual fixture has 16 lines of content with a single code block, rendering to approximately 1–2 pages. It does not exercise pagination, header/footer repetition, or layout stability across many pages.

---

### F2 — `headers-footers.md` is 12 lines (spec: long document for header/footer consistency)

**File:** `tests/fixtures/headers-footers.md`

The phase spec says: *"long document to verify header/footer consistency."* The fixture is 12 lines with 2 pages. Not sufficient to verify consistent rendering of running headers/footers.

---

## Documentation Gaps

### D1 — `api.md` does not document `ConvertResult`

**File:** `docs/api.md`

The `convert()` function returns `ConvertResult`, but the API reference documents only `ConvertOptions`. `pageCounts`, `renderTimeMs`, `warnings`, and `metadata` on the result object are not described anywhere in the docs.

---

### D2 — `api.md` does not document `PdfMetadata`

**File:** `docs/api.md`

`ConvertOptions.metadata` is typed as `PdfMetadata` but the shape of that type (title, author, subject, keywords, creator, producer, creationDate) is not documented.

---

## Phase File Inconsistencies

### PH1 — Status is `✅ Done` but all acceptance criteria are unchecked

**File:** `phase/v0.1.3-headers-footers.md`

The file header says `**Status:** ✅ Done` but every item under Acceptance Criteria still shows `- [ ]` (unchecked). Given C2 (pagebreak detection broken) and B2 (blank first page from h1NewPage), the criteria are genuinely not met.

---

### PH2 — Internal references still say "v0.1.2"

**File:** `phase/v0.1.3-headers-footers.md`

The file was renamed from `v0.1.2-headers-footers.md` to `v0.1.3-headers-footers.md` but internal body text, comments, and the "Why separate from v0.1.1?" section still reference the old numbering. Minor, but confusing for future reference.

---

## What the Previous Agent Got Right

These issues from the original audit were correctly fixed:

| Issue | Fix Applied | Verified |
|-------|-------------|----------|
| Metadata merge bug (`...options.metadata` overwriting fallbacks) | Spread first, then `??` overrides | ✅ |
| `__dirname` in ESM test | `fileURLToPath(new URL('.', import.meta.url))` | ✅ |
| Title XSS in HTML template | `escapeHtml()` function added | ✅ |
| CLI version hardcoded to `0.1.1` | Reads `pkg.version` from `package.json` | ✅ |
| `setCreator` hardcoded to `'md2pdf 0.1.1'` | Reads version dynamically | ✅ |
| `unist-util-visit` ghost dep | Added to `dependencies` | ✅ |
| `pageCounts: 0` placeholder | Wired to `pdfDoc.getPageCount()` | ✅ |
| `any` in Shiki `onError` | Typed as `unknown` with `instanceof` guard | ✅ |
| `any` in `toc.ts` textNode | Typed as `import('hast').Text` inline | ✅ |
| `allowDangerousHtml` undocumented | Comments added to parser | ✅ |
| Offline CDN font dependency | TODO comment added | ✅ |

---

## Priority Fix Order Before Pushing

1. **C1** — Remove unused `Text` import from `page-breaks.ts` (30-second fix, unblocks lint)
2. **C2** — Fix `<!-- pagebreak -->` to check `node.type === 'raw'` (core feature is broken)
3. **B2** — Skip first `h1` in `h1NewPage` logic (blank leading page bug)
4. **B1** — Handle `{ enabled: false }` correctly for header/footer
5. **A1** — Export `PdfMetadata` from `src/index.ts`
6. **P1** — Replace `hast@0.0.2` with `@types/hast` or remove it
7. **T1** — Add unit tests for `rehypePageBreaks` (especially the `<!-- pagebreak -->` path)
8. **D1/D2** — Document `ConvertResult` and `PdfMetadata` in `api.md`
9. **F1/F2** — Expand fixture files to match phase spec intent

---

*Generated by automated code review + runtime verification. All critical findings were confirmed by running the production pipeline.*

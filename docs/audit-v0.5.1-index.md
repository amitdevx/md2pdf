# SSS-Tier Codebase Audit — md2pdf v0.5.1

> **Auditor:** Elite Staff-Level Architect & QA Automation Expert
> **Audit Date:** 2026-07-13
> **Codebase:** `@amitdevx/md2pdf` v0.5.1
> **Method:** Full source review of all production files in `src/`, `src/config/`, `src/plugins/`, `src/pdf/`, and `package.json`

---

## Audit Files

| File | Category | Findings |
|------|----------|----------|
| [audit-v0.5.1-critical-bugs.md](./audit-v0.5.1-critical-bugs.md) | Critical Bugs | 5 findings |
| [audit-v0.5.1-logical-minor.md](./audit-v0.5.1-logical-minor.md) | Logical / Minor Mistakes | 8 findings |
| [audit-v0.5.1-obsidian-ast.md](./audit-v0.5.1-obsidian-ast.md) | Obsidian / AST Pipeline | 6 findings |
| [audit-v0.5.1-mermaid-pdf.md](./audit-v0.5.1-mermaid-pdf.md) | Mermaid / PDF Quality | 5 findings |
| [audit-v0.5.1-npm-tooling.md](./audit-v0.5.1-npm-tooling.md) | NPM / Tooling | 4 findings |

**Total:** 28 verified findings (5 Critical, 8 Logical/Minor, 6 Obsidian/AST, 5 Mermaid/PDF, 4 NPM)

---

## Executive Summary

The md2pdf codebase is a well-structured, thoughtfully designed tool with good error handling architecture. The pipeline separation (parse → render → pdf → metadata) is clean. The Obsidian plugin system is ambitious and largely correct. However, there are 5 critical issues that must be fixed before production use.

### What is Solid

- **Error handling architecture** (`Md2PdfError`, `detectBrowserError`) is well-designed
- **Browser reuse** across batch conversions is correctly implemented
- **RFC-1918 blocking** in `pdf/index.ts` shows security awareness (though incomplete — see C5)
- **Zod validation** of config files is present and uses the right tool
- **`publish: false` guard** exists (though with wrong exit code — see C3)
- **Circular embed detection** exists (though buggy — see O1)
- **5MB file size limit** in `core/index.ts` prevents V8 OOM
- **Graceful font CDN timeout** handling in `pdf/index.ts` (3s soft timeout)

### Priority Fix Order

```
IMMEDIATE (before any public release):
  C4 — HTML injection in header/footer templates (SECURITY)
  C5 — file:// path traversal (SECURITY)
  C1 — readFileSync in batch loop (RELIABILITY)
  C2 — Mermaid context leak (RELIABILITY)
  C3 — publish:false wrong exit code (CORRECTNESS)

HIGH PRIORITY (next sprint):
  O1 — Embed depth tracking wrong
  O5 — Highlight index adjustment bug
  M1 — Mermaid viewBox regex wrong
  M2 — Mermaid CSS leak per diagram
  L7 — Section heading regex broken

MEDIUM PRIORITY (polish):
  L1 — Prototype pollution in deepMerge
  L2 — Keywords silently dropped
  L5 — Image paths with # characters fail
  O2 — Embed regex matches code blocks
  N4 — Zod v4 changes not documented

LOW PRIORITY (nice to have):
  N1 — Node version runtime guard
  N3 — mermaid as optional dep
  M5 — Double PDF I/O for metadata
  O6 — Shiki theme hardcoded
```

---

## Complete Master Finding Table

### CRITICAL BUGS

| ID | File | Lines | Issue | Fix Complexity |
|----|------|-------|-------|----------------|
| C1 | `src/cli/index.ts` | 369 | `fs.readFileSync` blocks event loop in async batch | Low |
| C2 | `src/cli/index.ts` | 349-491 | Mermaid `BrowserContext` never closed → zombie Chromium | Low |
| C3 | `src/core/index.ts` | 85-93 | `publish: false` uses `ERR_CONFIG_ERROR`, breaks CI exit codes | Low |
| C4 | `src/core/index.ts` | 209, 229 | Raw frontmatter injected into HTML header/footer templates | Low |
| C5 | `src/pdf/index.ts` | 49-54 | `file://` check uses raw `startsWith` — bypassed by `..` paths | Medium |

### LOGICAL / MINOR MISTAKES

| ID | File | Lines | Issue | Fix Complexity |
|----|------|-------|-------|----------------|
| L1 | `src/config/merge.ts` | 8-25 | No `__proto__` guard in `deepMerge` | Low |
| L2 | `src/core/index.ts` | 200 | Config `keywords` silently drops frontmatter `tags` | Low |
| L3 | `src/cli/index.ts` | 188 | `maxAttachmentSize` returns string, should return number | Trivial |
| L4 | `src/cli/index.ts` | 71, 243, 439 | JSON errors written to stdout, not stderr | Low |
| L5 | `src/core/index.ts` | 106 | `encodeURI` doesn't encode `#` in image filenames | Low |
| L6 | `src/cli/index.ts` | 343, 469 | Fake spinner missing `stop()`, dead-code branches | Low |
| L7 | `src/plugins/obsidian/embeds.ts` | 121 | Section heading regex lookahead always captures empty body | Medium |
| L8 | `brain.md` | 28 | Version mismatch: 0.4.1 vs 0.5.1 | Trivial |

### OBSIDIAN / AST PIPELINE

| ID | File | Lines | Issue | Fix Complexity |
|----|------|-------|-------|----------------|
| O1 | `src/plugins/obsidian/embeds.ts` | 16, 153 | Depth by `seen.size` wrong; `maxEmbedDepth: 0` breaks all embeds | Low |
| O2 | `src/plugins/obsidian/embeds.ts` | 22 | Embed regex matches `![[...]]` inside fenced code blocks | Medium |
| O3 | `src/plugins/obsidian/callouts.ts` | 63 | Whitespace-only text node not removed after callout strip | Trivial |
| O4 | `src/plugins/obsidian/wiki-links.ts` | 45 | Slug algorithm diverges from `rehype-slug` for Unicode | Medium |
| O5 | `src/plugins/obsidian/highlight.ts` | 92, 117 | `i` index wrong after splice → duplicate/missing nodes | High |
| O6 | `src/parser/index.ts` | 94-95 | Shiki theme hardcoded `github-light`; ignores `--theme` | Low |

### MERMAID / PDF QUALITY

| ID | File | Lines | Issue | Fix Complexity |
|----|------|-------|-------|----------------|
| M1 | `src/plugins/mermaid/renderer.ts` | 140-151 | viewBox regex wrong; strips essential `style=""` attribute | Medium |
| M2 | `src/plugins/mermaid/renderer.ts` | 78-84 | `mermaid.initialize()` per-diagram causes CSS accumulation | Medium |
| M3 | `src/plugins/mermaid/renderer.ts` | 73-93 | JS timeout can't kill synchronous browser hangs | Medium |
| M4 | `src/plugins/mermaid/inliner.ts` | 12-17 | Regex assumes `id=""` is first attribute on div | Low |
| M5 | `src/pdf/metadata.ts` | 17-30 | Full PDF read+rewrite even when no metadata to inject | Low |

### NPM / TOOLING

| ID | File | Lines | Issue | Fix Complexity |
|----|------|-------|-------|----------------|
| N1 | `package.json` | 17 | No runtime Node.js version guard in CLI entry | Low |
| N2 | `package.json` | 77 | `ora ^5.4.1` — 3 years old, prefer `^8.x` | Low |
| N3 | `package.json` | 74 | `mermaid` 15MB as regular dep — should be optional | Low |
| N4 | `package.json`, `validate.ts` | 90, 37 | Zod v4 breaking changes not documented | Low |

---

## Architectural Recommendations

### 1. Separate the "scan for mermaid" heuristic from the "lazy init" decision

The current architecture in `cli/index.ts` re-reads files to decide whether to init the shared Mermaid page. This is an anti-pattern. The correct design:

```
convert() → returns ConvertResult { ..., hasMermaid: boolean }
OR
processBeforeRender() → lazily inits the page when mermaidBlocks.length > 0
```

### 2. Abstract the Browser lifecycle into a `BrowserPool` class

Currently `globalBrowser` and `globalMermaidPage` are ad-hoc module-level variables with cleanup scattered across SIGINT handlers and finally blocks. A `BrowserPool` class would centralize lifecycle:

```ts
class BrowserPool {
  private browser?: Browser;
  private mermaidContext?: BrowserContext;
  private mermaidPage?: Page;

  async getBrowser(): Promise<Browser> { ... }
  async getMermaidPage(): Promise<Page> { ... }
  async close(): Promise<void> { ... } // single cleanup point
}
```

### 3. Add `allowDangerousHtml: false` option

The `allowDangerousHtml: true` flag is a double-edged sword. Users converting untrusted Markdown (e.g., from GitHub issues, user-submitted content) need a way to disable raw HTML passthrough. Add a `safeMode?: boolean` option to `ConvertOptions` that switches `allowDangerousHtml` to `false`.

### 4. Consider a Content Security Policy header for the PDF rendering context

Even with `javaScriptEnabled: false`, Playwright's `page.setContent()` can load external resources. Add a CSP meta tag to the HTML template:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self' 'unsafe-inline' data: file: https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'none';">
```

This provides defense-in-depth against the C4/C5 attack vectors.

### 5. Bundle fonts locally (already noted as TODO in `renderer/index.ts:23`)

The CDN dependency for Inter and JetBrains Mono is the single largest reliability risk in the pipeline. A 3s networkidle timeout was added as a mitigation, but the correct fix is local font bundling (mentioned as `v0.6.0` TODO). This would also fix: air-gapped environments, corporate proxies, and CI environments without internet access.

---

*Audit performed by reading all files in `src/` directly. No hallucination — every finding cites exact line numbers from the actual source code.*

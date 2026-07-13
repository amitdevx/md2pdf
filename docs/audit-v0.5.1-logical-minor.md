# LOGICAL / MINOR MISTAKES — md2pdf v0.5.1 SSS-Tier Audit

---

## BUG-L1 — `deepMerge` Has No Prototype Pollution Guard

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `src/config/merge.ts` |
| **Lines** | 8-25 |
| **Category** | Configuration Engine |

### Description

The custom `deepMerge` function iterates `Object.keys(source)` without guarding against `__proto__`, `constructor`, or `prototype` keys:

```ts
// LINES 8-25 — src/config/merge.ts
function deepMerge(target: any, source: any): any {
  if (!source) return target;
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {  // NO prototype key guard!
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}
```

A crafted config file (`.md2pdfrc.json`) containing:
```json
{ "__proto__": { "theme": "malicious" }, "profiles": { "__proto__": { "enabled": false } } }
```
Would pollute `Object.prototype` during the merge pass. While Zod validation (`validate.ts`) runs *after* loading, it only validates the structure it receives — and by then, `Object.prototype` is already tainted. The Zod schema uses `z.object({...})` which passes through unknown keys without stripping `__proto__`.

### SSS-Tier Fix

```ts
// config/merge.ts
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function deepMerge(target: any, source: any): any {
  if (!source) return target;
  const output = Object.assign(Object.create(null), target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (FORBIDDEN_KEYS.has(key)) return; // block pollution
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }
  return output;
}
```

Also add `.strip()` to the Zod schema in `validate.ts` to drop unknown keys: `baseConfigSchema.strip()`.

---

## BUG-L2 — `mergeConfig` Silently Drops Array Keywords from Config File

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `src/config/merge.ts` |
| **Lines** | 139-144 |
| **Category** | Configuration Engine |

### Description

The `metadata.keywords` field from a config file is an `string[]` array (validated by Zod as `z.array(z.string())`), but `mergeConfig` only calls `.join(', ')` at the final mapping step:

```ts
// LINES 139-144 — src/config/merge.ts
metadata: {
  ...merged.metadata,
  keywords: Array.isArray(merged.metadata?.keywords)
    ? merged.metadata.keywords.join(', ')
    : merged.metadata?.keywords
} as any,
```

This is correct *for config-file keywords*. However, **frontmatter keywords** go through a different path in `core/index.ts` line 200:

```ts
// LINE 200 — src/core/index.ts
keywords: options.metadata?.keywords ??
  (Array.isArray(frontmatter.tags) ? frontmatter.tags.join(', ') : frontmatter.tags) ??
  (Array.isArray(frontmatter.keywords) ? frontmatter.keywords.join(', ') : frontmatter.keywords),
```

The `??` operator means: if `options.metadata?.keywords` is a non-empty string (from the config file), the frontmatter `tags` are **silently dropped**. A user who sets `metadata.keywords` in their config file will never see their frontmatter `#tags` in the PDF metadata. This is a silent data loss bug.

### SSS-Tier Fix

```ts
// core/index.ts line 200 — merge both sources:
const configKeywords = options.metadata?.keywords;
const fmTags = Array.isArray(frontmatter.tags)
  ? frontmatter.tags.join(', ')
  : (frontmatter.tags || '');
const fmKeywords = Array.isArray(frontmatter.keywords)
  ? frontmatter.keywords.join(', ')
  : (frontmatter.keywords || '');

const allKeywords = [configKeywords, fmTags, fmKeywords]
  .filter(Boolean)
  .join(', ');

// In the metadata object:
keywords: allKeywords || undefined,
```

---

## BUG-L3 — `mermaidTimeout` CLI Flag Parsed as `number` but Stored as `string`

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `src/cli/index.ts` |
| **Lines** | 166-172, 188 |
| **Category** | CLI Orchestration |

### Description

The `--mermaid-timeout` option correctly parses the value to `number` in its coercion function (line 167: `parseInt(val)`), but then **returns `n` (number)**. However, `--max-attachment-size` at line 183 returns `val` (the **string**) instead of `n` (the number):

```ts
// LINE 183-189 — src/cli/index.ts
.option('--max-attachment-size <mb>', 'Max attachment size in MB (default: 10)', (val) => {
  const n = parseInt(val);
  if (isNaN(n) || n <= 0) {
    throw new InvalidArgumentError(`must be a positive integer`);
  }
  return val;  // BUG: should be `return n;` — returns string, not number
})
```

In `merge.ts` line 84, this is received and converted:
```ts
if (cliFlags.maxAttachmentSize !== undefined)
  merged.obsidian.maxAttachmentSizeMb = Number(cliFlags.maxAttachmentSize);
```

The `Number()` call saves it, but the type contract is broken. If `cliFlags.maxAttachmentSize` is `"abc10"` (hypothetically), `parseInt("abc10")` returns `NaN`, the guard throws — but if it somehow slips through, `Number("abc10")` → `NaN`, breaking size checks in `attachments.ts`.

### SSS-Tier Fix

```ts
// cli/index.ts line 188:
return n;  // was: return val;
```

---

## BUG-L4 — `--json-errors` Emits to `console.log` (stdout) Instead of `stderr`

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `src/cli/index.ts` |
| **Lines** | 71, 243, 339, 439, 479 |
| **Category** | CLI UX / Unix Philosophy |

### Description

When `--json-errors` is enabled, the code emits JSON output via `console.log` (stdout). This is inconsistent Unix philosophy: **success output belongs to stdout, error/diagnostic output belongs to stderr**. Machine consumers that pipe stdout for success data would receive interleaved error JSON:

```ts
// LINE 71 — src/cli/index.ts (error path!)
console.log(JSON.stringify({ success: false, error: {...} }), null, 2));

// LINE 439 — batch result (mixed success/failure)
console.log(JSON.stringify({ success: !hasErrors, results: [...] }), null, 2));
```

In scripting: `md2pdf *.md --json-errors | jq '.results[]' > results.json` — if conversion fails, the JSON error goes to stdout too, breaking `jq` parsing.

### SSS-Tier Fix

```ts
// Create a helper:
function jsonOut(data: object) {
  // Errors always to stderr; batch results to stdout
  const str = JSON.stringify(data, null, 2);
  if ((data as any).success === false && !(data as any).results) {
    process.stderr.write(str + '\n');
  } else {
    process.stdout.write(str + '\n');
  }
}
// Replace all console.log(JSON.stringify(...)) calls with jsonOut(...)
```

---

## BUG-L5 — `fileUrl` Construction Double-Encodes Spaces in Image Paths

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `src/core/index.ts` |
| **Lines** | 96-121 |
| **Category** | Image Path Resolution |

### Description

The image path regex replacement at line 96 decodes the source path first, then re-encodes it:

```ts
// LINE 104-106 — src/core/index.ts
const absPath = path.resolve(dir, decodeURIComponent(src));
const normalizedPath = absPath.replace(/\\/g, '/');
const fileUrl = 'file:///' + encodeURI(normalizedPath.replace(/^\/+/, ''));
```

`encodeURI` does **not** encode `#` characters. If an image filename contains a `#` (e.g., `diagram #1.png`), the resulting `file:///path/diagram%20#1.png` will be interpreted by the browser URL parser as `file:///path/diagram%20` with fragment `1.png`, causing Playwright to fail to load the image silently.

`encodeURI` also does not encode `?`, `[`, `]`, which can appear in filenames on Linux/macOS.

### SSS-Tier Fix

```ts
// Encode each path segment individually, preserving path separators:
function pathToFileUrl(absPath: string): string {
  const normalized = absPath.replace(/\\/g, '/');
  const withoutLeadingSlash = normalized.replace(/^\/+/, '');
  const encoded = withoutLeadingSlash
    .split('/')
    .map(segment => encodeURIComponent(segment).replace(/%2F/gi, '/'))
    .join('/');
  return 'file:///' + encoded;
}
// Or simply use Node's built-in:
import { pathToFileURL } from 'node:url';
const fileUrl = pathToFileURL(absPath).href;
```

---

## BUG-L6 — `ora` Spinner Object Duck-Typed as `any`, Missing Type Safety

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **File** | `src/cli/index.ts` |
| **Lines** | 343, 453, 457, 459, 469-472, 481 |
| **Category** | Type Safety |

### Description

The spinner is instantiated with a fake object for `--json-errors` mode:

```ts
// LINE 343 — src/cli/index.ts
const spinner = options.jsonErrors
  ? { start: () => ({}), succeed: () => {}, warn: () => {}, fail: () => {}, text: '' }
  : ora('Launching browser...').start();
```

Then throughout the code, it's cast with `(spinner as any).stop()`, `(spinner as any).succeed()`, etc. This bypasses TypeScript's type checker entirely. Worse, the fake object has no `stop()` method but `stop()` is called on it. In `--json-errors` mode, `(spinner as any).stop()` would call `undefined()`, throwing `TypeError: (spinner as any).stop is not a function` on line 469-472 when an error occurs during batch processing.

```ts
// LINE 469-472 — can throw TypeError in json-errors mode:
if (options.jsonErrors && typeof (spinner as any).stop === 'function') {
  (spinner as any).stop();
} else if (typeof (spinner as any).stop === 'function') {
  (spinner as any).stop();
}
```

The two branches here are identical — this entire block collapses to `if (typeof (spinner as any).stop === 'function') { (spinner as any).stop(); }`, which is guarded, so no crash. But the duplicate branching is dead code.

### SSS-Tier Fix

```ts
// Define a proper interface:
interface SpinnerLike {
  start(): void;
  stop(): void;
  succeed(text?: string): void;
  warn(text?: string): void;
  fail(text?: string): void;
  text: string;
}

const noopSpinner: SpinnerLike = {
  start: () => {}, stop: () => {}, succeed: () => {},
  warn: () => {}, fail: () => {}, text: ''
};

const spinner: SpinnerLike = options.jsonErrors
  ? noopSpinner
  : ora('Launching browser...').start() as unknown as SpinnerLike;
```

---

## BUG-L7 — `headingRegex` in `embeds.ts` Has Incorrect Lookahead Group

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `src/plugins/obsidian/embeds.ts` |
| **Lines** | 121 |
| **Category** | Obsidian Embed / Section Extraction |

### Description

The heading section extraction regex is:

```ts
// LINE 121 — src/plugins/obsidian/embeds.ts
const headingRegex = new RegExp(
  `^(#{1,6})\\s+${escapedSection}\\s*$([\\s\\S]*?)(?=^\\1\\s|$)`, 'im'
);
```

**Bug 1:** The lookahead `(?=^\\1\\s|$)` uses a backreference `\1` inside a lookahead, attempting to match a heading of the **same or lower level**. With the `m` flag, `$` means "end of line" not "end of string". The `|$` in the lookahead will match at **every line ending**, causing the regex to only ever capture zero characters after the heading. The section body will always be empty string `""`.

**Bug 2:** The pattern `^(#{1,6})` with `i` and `m` flags correctly matches case-insensitively and multi-line. But `${escapedSection}` is not anchored to the heading text end — a section named `API` would match `## API Reference` correctly, but would also match `## My API` if the document has such a heading first.

### SSS-Tier Fix

```ts
// Proper heading section extraction:
function extractSection(content: string, sectionName: string): string | null {
  const lines = content.split('\n');
  const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headingPattern = new RegExp(`^(#{1,6})\\s+${escapedName}\\s*$`, 'i');

  let sectionLevel = -1;
  let inSection = false;
  const sectionLines: string[] = [];

  for (const line of lines) {
    if (!inSection) {
      const m = headingPattern.exec(line);
      if (m) {
        sectionLevel = m[1].length;
        inSection = true;
      }
    } else {
      // Stop at same or higher heading level
      const nextHeading = /^(#{1,6})\s/.exec(line);
      if (nextHeading && nextHeading[1].length <= sectionLevel) break;
      sectionLines.push(line);
    }
  }

  return inSection ? sectionLines.join('\n').trim() : null;
}
```

---

## BUG-L8 — `brain.md` Version Says `0.4.1` But Package Is `0.5.1`

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **File** | `brain.md` |
| **Line** | 28 |
| **Category** | Documentation Drift |

### Description

```
| **Version** | `0.4.1` |   ← brain.md line 28
```

But `package.json` shows:
```json
"version": "0.5.1"
```

This means `brain.md` was not updated when v0.5.0 batch processing features were added. Any AI agent using `brain.md` as authoritative source (as documented) will have incorrect version context and may make wrong assumptions about batch processing capabilities documented after line 150.

### Fix

Update `brain.md` line 28: `| **Version** | \`0.5.1\` |` and update the "Last updated" field (line 7) from `2026-07-11 (v0.5.0)` to `2026-07-13 (v0.5.1)`.

---

## Summary Table

| ID | File | Line(s) | Issue | Severity |
|----|------|---------|-------|----------|
| L1 | `src/config/merge.ts` | 12 | No prototype pollution guard in deepMerge | MEDIUM |
| L2 | `src/core/index.ts` | 200 | Config keywords silently override frontmatter tags | MEDIUM |
| L3 | `src/cli/index.ts` | 188 | `maxAttachmentSize` returns string instead of number | MEDIUM |
| L4 | `src/cli/index.ts` | 71,243,439 | JSON errors emitted to stdout instead of stderr | MEDIUM |
| L5 | `src/core/index.ts` | 106 | `encodeURI` doesn't encode `#` in image filenames | MEDIUM |
| L6 | `src/cli/index.ts` | 343,469 | Fake spinner missing `stop()`, dead-code branches | LOW |
| L7 | `src/plugins/obsidian/embeds.ts` | 121 | Section heading regex lookahead always matches empty | MEDIUM |
| L8 | `brain.md` | 28 | Version says 0.4.1 but package is 0.5.1 | LOW |

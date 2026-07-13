# NPM / TOOLING — md2pdf v0.5.1 SSS-Tier Audit

---

## BUG-N1 — `bin` Points to Unguarded JS File (No Shebang Validation, No CJS Fallback)

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **File** | `package.json` |
| **Line** | 17 |
| **Category** | npm / bin mapping |

### Description

```json
"bin": {
  "md2pdf": "dist/cli/index.js"
}
```

The `dist/cli/index.js` file is the **ESM bundle** output from tsup. When installed globally via `npm install -g @amitdevx/md2pdf`, npm creates a symlink to this file and runs it with the system Node.js. The file starts with `#!/usr/bin/env node` (line 1 of the source), and since `package.json` has `"type": "module"`, the bundled output is treated as ESM.

**Problem 1 — Node.js < 18 compatibility:** The engines field specifies `"node": ">=18"`, but there is no runtime enforcement. A user with Node 16 runs `md2pdf` and gets a cryptic `SyntaxError: Cannot use import statement` or `ERR_REQUIRE_ESM` with no actionable error message.

**Problem 2 — `dist/cli/index.js` may not exist after `npm install`.** The `files` field includes `"dist"`, but there is no check in `postinstall` or `prepare` that the dist is built. If a developer clones the repo and does `npm link` without running `npm run build`, the bin symlink points to a non-existent file.

**Problem 3 — `tsup.config.ts`** (as mentioned in brain.md) splits the output into `dist/index.js` (library) and `dist/cli/index.js` (CLI). The `exports` field correctly maps the library. But there is no `"exports"` entry for the CLI file — consumers cannot import `@amitdevx/md2pdf/cli` for programmatic access to CLI utilities (not a bug per se, but an API surface gap).

### SSS-Tier Fix

```ts
// Add to cli/index.ts (already has shebang, keep it):
#!/usr/bin/env node

// Add a Node.js version guard at the very top (before any imports):
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  process.stderr.write(
    `\nError: md2pdf requires Node.js 18 or higher.\n` +
    `You are running Node.js ${process.version}.\n` +
    `Please upgrade: https://nodejs.org\n\n`
  );
  process.exit(1);
}
```

```json
// package.json — add postinstall check:
"scripts": {
  "postinstall": "node -e \"const v=process.versions.node.split('.')[0]; if(v<18){console.error('md2pdf requires Node.js 18+');process.exit(1)}\"",
}
```

---

## BUG-N2 — `ora` v5.x is ESM-Only, Bundled Into CJS Output

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `package.json` |
| **Line** | 77 |
| **Category** | npm / ESM/CJS interop |

### Description

```json
"ora": "^5.4.1",
```

`ora` v5.x and above is ESM-only (`"type": "module"` in its own package.json). The md2pdf package has a CJS fallback (`"require": "./dist/index.cjs"` in exports). When tsup bundles the library for CJS output, it needs to bundle `ora`. Since `ora` is ESM-only, tsup handles this by using a dynamic `import()` interop shim — but `ora` is only used in `cli/index.ts` which is NOT part of the library bundle.

However, there's a subtler issue: `ora` v5.4.1 does not exist. The latest v5.x is `5.4.1` and was released in 2021. The current major version of ora is **v8.x** (2024). Using `^5.4.1` locks consumers into a 3-year-old spinner library that:
1. Has known Unicode rendering issues on Windows terminals
2. Does not support the `isSilent` option added in v6
3. Conflicts with newer `chalk` versions if consumers have chalk installed

### SSS-Tier Fix

```json
// package.json — upgrade ora:
"ora": "^8.0.1",
```

Upgrade with care: ora v6+ changed the default export to a named export `import { ora } from 'ora'` → verify import syntax in `cli/index.ts` still works (it uses `import ora from 'ora'` which works with the `interopDefault` in jiti).

---

## BUG-N3 — `mermaid` v11 in Dependencies is a 15MB Peer Dep Bloat

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `package.json` |
| **Line** | 74 |
| **Category** | npm / Dependency Size |

### Description

```json
"mermaid": "^11.16.0",
```

`mermaid` is listed as a **regular dependency** (not `peerDependencies` or `optionalDependencies`). The `mermaid` package is ~15MB uncompressed and ships with its own bundled d3, dagre, and multiple rendering backends. However, `mermaid` is only used **inside a Playwright browser context** — the Node.js process never imports mermaid directly. The only Node.js usage is:

```ts
// renderer.ts line 55:
cachedMermaidScriptPath = require.resolve('mermaid/dist/mermaid.min.js');
```

This just resolves the file path to inject into the browser via `page.addScriptTag`. The actual mermaid code runs in Chromium, not Node.js. Yet npm installs all 15MB for every consumer.

Additionally, `mermaid` has significant peer dependency conflicts — it requires specific versions of d3, dagre-d3-es, and khroma that may conflict with consumer projects.

### SSS-Tier Fix

```json
// package.json — move to optional:
"optionalDependencies": {
  "mermaid": "^11.16.0"
},
```

And add a runtime check in `renderer.ts`:
```ts
try {
  cachedMermaidScriptPath = require.resolve('mermaid/dist/mermaid.min.js');
} catch {
  throw new Md2PdfError(
    Md2PdfErrorCode.ERR_MISSING_DEPENDENCIES,
    'Mermaid Not Installed',
    'Mermaid diagrams require the `mermaid` package. Run: npm install mermaid',
  );
}
```

---

## BUG-N4 — `zod` v4 Breaking Change: `z.record` Signature Changed

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **File** | `package.json`, `src/config/validate.ts` |
| **Lines** | 90 (package.json), 37 (validate.ts) |
| **Category** | npm / Breaking Change |

### Description

```json
"zod": "^4.4.3",
```

Zod v4 (released mid-2024) introduced **breaking changes** to the `z.record()` API. In Zod v3, `z.record(z.string(), z.string())` was the signature. In Zod v4, the API changed:
- `z.record(keySchema, valueSchema)` now requires both arguments, but the key schema must be a `ZodString` or `ZodEnum` — plain `z.string()` works but the behavior differs.
- `z.record(z.string())` (single-arg) works differently between v3 and v4.

In `validate.ts` line 37:
```ts
themeVariables: z.record(z.string(), z.string()).optional(),
```

In Zod v4, this usage is valid but `z.record(z.string(), z.string())` is now `z.record(z.string())` (the key type is implicitly `string`). This specific usage is backward compatible.

**The real issue:** Zod v4 removed `z.string().email()`, `z.string().url()`, and other refinements from the default bundle (moved to `zod/v4` import path). If any future validators use these, they'll silently return `never` or throw at import time.

Also: Zod v4 changed `z.object({}).parse()` to throw `ZodError` with a different shape for nested errors. Any `catch (err: any) { err.message }` handling of Zod errors in `loader.ts` (line 93) will still work since `ZodError.message` is preserved, but `err.errors` (the array of issues) has a different structure.

### SSS-Tier Fix

Pin to a known-compatible Zod version and add a comment:

```json
"zod": "^4.4.3",  // verified compatible with v4.4.3 — test before upgrading
```

Add to `validate.ts`:
```ts
// NOTE: This codebase uses Zod v4. The API changed significantly from v3.
// See: https://zod.dev/BREAKING_CHANGES for v3→v4 migration guide.
// Key differences used here:
// - z.record(keySchema, valueSchema) — unchanged
// - z.object({}).parse() — throws ZodError with v4 issue structure
```

---

## Summary Table

| ID | File | Line(s) | Issue | Severity |
|----|------|---------|-------|----------|
| N1 | `package.json` | 17 | No Node.js version runtime guard in CLI bin | HIGH |
| N2 | `package.json` | 77 | `ora ^5.4.1` is 3 years old, ESM-only quirks | MEDIUM |
| N3 | `package.json` | 74 | `mermaid` 15MB installed as regular dep, should be optional | MEDIUM |
| N4 | `package.json`, `validate.ts` | 90, 37 | Zod v4 breaking changes not documented or guarded | HIGH |

# src/

Source code for `@amitdevx/md2pdf`. All TypeScript, compiled to `dist/` by `tsup`.

---

## Module Map

```
src/
├── index.ts              ← Public API entry point: exports convert(), defineConfig(), all types
│
├── cli/
│   └── index.ts          ← CLI entry point (bin: md2pdf). Thin wrapper around convert().
│
├── core/
│   └── index.ts          ← convert() implementation: orchestrates parser → renderer → pdf
│
├── parser/
│   └── index.ts          ← Markdown → HTML AST via unified/remark pipeline
│
├── renderer/
│   └── index.ts          ← HTML template assembly: injects CSS, fonts, plugin output
│
├── pdf/
│   └── index.ts          ← Playwright PDF generation: page.pdf() wrapper
│
├── plugins/
│   ├── markdown/         ← remark plugins (Markdown AST transforms)
│   ├── html/             ← rehype plugins (HTML AST transforms)
│   ├── obsidian/         ← Obsidian-specific plugins (wiki links, callouts, embeds)
│   └── renderer/         ← Render-phase hooks (beforeRender, afterPageLoad, afterPdf)
│
├── themes/
│   ├── default/          ← Default theme CSS + metadata
│   ├── github/           ← GitHub theme
│   ├── obsidian-light/   ← Obsidian Light theme
│   └── obsidian-dark/    ← Obsidian Dark theme
│   (dracula/, nord/, academic/ — added in v0.6.0)
│
├── config/               ← Config file discovery, loading, merging, validation
│
├── assets/               ← Static CSS assets (base.css, print.css, typography.css)
│
├── constants/            ← Shared constants (default options, version, etc.)
│
├── types/
│   └── index.ts          ← All public TypeScript types (ConvertOptions, Theme, Plugin, etc.)
│
└── utils/                ← Shared utility functions (file resolution, hashing, logging)
```

---

## Public API (`src/index.ts`)

Everything exported from `src/index.ts` is part of the public API and subject to semver.
Everything else is internal — do not import from deep paths outside of tests.

```ts
// Public exports (stable from v1.0.0)
export { convert } from './core/index.js'
export { defineConfig } from './config/index.js'
export type { ConvertOptions, ConvertResult } from './types/index.js'
export type { Md2PdfConfig } from './types/config.js'
export type { Theme } from './types/theme.js'
export type {
  MarkdownPlugin, HtmlPlugin, RenderPlugin,
  ThemePlugin, ExportPlugin, AnyPlugin,
  RenderContext
} from './types/plugin.js'
```

---

## Pipeline Flow

```
Input .md file
      │
      ▼
src/parser/           ← unified: remark-parse → remark plugins → remark-rehype → rehype plugins → HTML string
      │
      ▼
src/renderer/         ← wrap HTML in full page template, inject CSS, inject fonts
      │
      ▼
src/pdf/              ← Playwright: page.setContent(html) → page.pdf() → Buffer → file
      │
      ▼
Output .pdf file
```

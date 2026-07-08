# brain.md — Complete Knowledge Base for `@amitdevx/md2pdf`

> **Purpose:** This file contains *every detail* about the md2pdf npm package.
> Any AI agent reading this file should be able to understand, modify, build, test,
> and extend the project without reading any other file.
>
> **Last updated:** 2026-07-08 (v0.3.0)

---

## Table of Contents

1. [Identity](#1-identity)
2. [Architecture & Pipeline](#2-architecture--pipeline)
3. [Full File Tree](#3-full-file-tree)
4. [Every Source File — Complete Code](#4-every-source-file--complete-code)
5. [Every Test File — Complete Code](#5-every-test-file--complete-code)
6. [Every Config File — Complete Contents](#6-every-config-file--complete-contents)
7. [Dependency Graph](#7-dependency-graph)
8. [Build System](#8-build-system)
9. [CI/CD Pipelines](#9-cicd-pipelines)
10. [Coding Standards & Conventions](#10-coding-standards--conventions)
11. [Public API Surface](#11-public-api-surface)
12. [Type System](#12-type-system)
13. [Current CSS / Theme System](#13-current-css--theme-system)
14. [Golden Document Testing Strategy](#14-golden-document-testing-strategy)
15. [Full Development Roadmap](#15-full-development-roadmap)
16. [Dependencies — What Each Does](#16-dependencies--what-each-does)
17. [Future Dependencies](#17-future-dependencies)
18. [Directory Purpose Map](#18-directory-purpose-map)
19. [Gitignore Rules](#19-gitignore-rules)
20. [npm Publish Rules](#20-npm-publish-rules)
21. [Key Design Decisions](#21-key-design-decisions)
22. [Research Findings Summary](#22-research-findings-summary)
23. [Known Limitations (v0.2.4)](#23-known-limitations-v024)
24. [Quick Reference for Common Tasks](#24-quick-reference-for-common-tasks)
25. [Post-Mortems & Lessons Learned](#25-post-mortems--lessons-learned)

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Package name** | `@amitdevx/md2pdf` |
| **Version** | `0.3.0` |
| **Description** | Production-quality Markdown to PDF rendering engine |
| **Author** | Amit Divekar |
| **License** | MIT |
| **Repository** | `https://github.com/amitdevx/md2pdf` (shorthand in package.json) |
| **npm registry** | `https://registry.npmjs.org` (public) |
| **Node.js** | `>= 18` |
| **Module system** | ESM (`"type": "module"`) with CJS fallback |
| **Language** | TypeScript (strict mode) |
| **Target** | ES2022 |
| **Bundler** | tsup |
| **Test runner** | Vitest |
| **Linter** | ESLint 9 (flat config) + typescript-eslint |
| **Formatter** | Prettier |
| **Git hooks** | Husky + lint-staged |
| **PDF engine** | Playwright (headless Chromium) |
| **Markdown engine** | unified + remark + rehype |
| **Syntax highlighting** | Shiki (`@shikijs/rehype`) — `github-light` theme |
| **Mermaid diagrams** | `mermaid` rendered inside Playwright browser context → SVG inlined |
| **PDF metadata** | `pdf-lib` — injects Title, Author, Subject, Keywords, Creator, Producer |
| **Frontmatter** | `gray-matter` — YAML parsed before Markdown processing |

---

## 2. Architecture & Pipeline

### Core Pipeline (v0.2.0)

```
Input .md file
      │
      ▼
┌──────────────────────────────────────────────────────────┐
│  src/core/index.ts  (convert())                          │
│  - Reads raw file                                        │
│  - gray-matter: strips YAML frontmatter                  │
│  - Checks publish: false guard                           │
│  - Regex: relative image paths → absolute file:// URLs   │
│  - Collects mermaidBlocks[] (filled during parsing)      │
│  - Builds PdfMetadata from options + frontmatter         │
│  - Builds header/footer templates if requested           │
│  - Launches Playwright browser (shared across steps)     │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  src/parser/index.ts  (parseMarkdown())                  │
│  unified()                                               │
│    .use(remarkParse)                                     │
│    .use(remarkGfm)            ← GFM tables, footnotes    │
│    .use(remarkRehype, { allowDangerousHtml: true })      │
│    .use(rehypeSlug)           ← heading id attributes    │
│    .use(rehypePageBreaks)     ← <!-- pagebreak -->,      │
│                                  h1NewPage, hrPageBreak  │
│    .use(rehypeToc)            ← optional TOC injection   │
│    .use(rehypeMermaidDetector)← extracts mermaid blocks, │
│                                  replaces with <div id>  │
│    .use(rehypeExpandDetails)  ← forces <details open>    │
│    .use(rehypeShiki)          ← syntax highlighting      │
│    .use(rehypeStringify, { allowDangerousHtml: true })   │
│  → returns { html, warnings }                            │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  src/renderer/index.ts  (renderHtmlTemplate())           │
│  - Wraps HTML in full DOCTYPE page                       │
│  - Loads Inter + JetBrains Mono from Google Fonts CDN   │
│  - Injects baseCss + printCss from src/assets/css.ts    │
│  - HTML escapes title                                    │
│  → complete HTML document string                         │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  src/renderer/pipeline.ts  (processBeforeRender())       │
│  - If mermaidBlocks.length > 0:                          │
│      renderMermaidBlocks(browser, blocks, theme, ...)    │
│        → for each block: page.evaluate(mermaid.render)   │
│        → returns RenderedMermaid[] with SVG strings      │
│      inlineMermaidSvgs(html, rendered)                   │
│        → replaces <div id="mermaid-placeholder-N">       │
│          with centered SVG wrapped in mermaid-container  │
│  → returns processedHtml                                 │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  src/pdf/index.ts  (generatePdf())                       │
│  - Reuses browser passed from core (no second launch)    │
│  - page.setContent(html, { waitUntil: 'domcontentloaded'}) │
│  - waitForLoadState('networkidle', { timeout: 3000 })    │
│    (catches Google Fonts; soft-fails if CDN slow)        │
│  - await document.fonts.ready                            │
│  - page.pdf({ format, margin, header, footer, ... })     │
│  → writes PDF to outputPath                              │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  src/pdf/metadata.ts  (injectMetadata())                 │
│  - pdf-lib: loads written PDF bytes                      │
│  - Sets Title, Author, Subject, Keywords                 │
│  - Sets Creator: "md2pdf <version>", Producer: Playwright│
│  - Sets CreationDate                                     │
│  - Saves modified PDF back to disk                       │
│  → returns pageCount (integer)                           │
└──────────────────────────────────────────────────────────┘
               │
               ▼
      convert() returns ConvertResult {
        outputPath, pageCounts, renderTimeMs, warnings, metadata
      }
```

### CLI Pipeline

```
User runs: md2pdf input.md [options]
      │
      ▼
src/cli/index.ts
  ├── Reads version dynamically from package.json
  ├── Registers subcommands: doctor, init
  ├── Validates: file exists, is .md, not a directory
  ├── Validates: --paper, --margin values (strict regex)
  ├── Rejects stdin (-) input
  ├── Auto-appends .pdf if output has no extension
  ├── Guards against input === output (resolved paths)
  ├── Builds ConvertOptions from CLI flags
  ├── Shows ora spinner (suppressed with --json-errors)
  └── Calls convert({ input, output, toc, header, footer,
                       paper, margin, theme, mermaid,
                       pageBreaks, metadata? })
        │
        ├── On success: prints resolved path + render time
        ├── On warnings: spinner.warn + lists each warning
        └── On error: renderCliError() → structured output
              ├── Md2PdfError: code, title, reason, context
              ├── getRecommendation() → summary + commands
              └── --json-errors → JSON to stderr

md2pdf doctor   → health check (browser, PDF gen, FS write)
md2pdf init     → guided Chromium install wizard
```

---

## 3. Full File Tree

Every file in the repo (excluding `node_modules/`, `.git/`, `dist/`):

```
md2pdf/
├── brain.md                               ← THIS FILE — complete project knowledge base
├── STRUCTURE.md                           ← Concise directory map
├── README.md                              ← Public npm/GitHub README
├── CHANGELOG.md                           ← Version history (0.0.1 through 0.2.0)
├── LICENSE                                ← MIT
├── package.json                           ← npm metadata, scripts, deps
├── package-lock.json                      ← Exact dependency tree
├── tsconfig.json                          ← TypeScript config (dev)
├── tsconfig.build.json                    ← TypeScript config (declarations only)
├── tsup.config.ts                         ← Build config (tsup → dist/)
├── vitest.config.ts                       ← Test runner config
├── eslint.config.js                       ← Linting rules (flat config)
├── prettier.config.js                     ← Code formatting rules
├── .gitignore                             ← Git exclusions
│
├── src/                                   ← TypeScript source code
│   ├── README.md                          ← Module map and pipeline docs
│   ├── index.ts                           ← Public API entry point
│   │
│   ├── core/
│   │   └── index.ts                       ← convert() — main orchestrator
│   │
│   ├── cli/
│   │   ├── index.ts                       ← CLI binary (bin: md2pdf), main command
│   │   ├── doctor.ts                      ← `md2pdf doctor` subcommand
│   │   └── init.ts                        ← `md2pdf init` subcommand
│   │
│   ├── parser/
│   │   └── index.ts                       ← parseMarkdown() — unified pipeline
│   │
│   ├── renderer/
│   │   ├── index.ts                       ← renderHtmlTemplate() — HTML wrapper
│   │   └── pipeline.ts                    ← processBeforeRender() — Mermaid injection
│   │
│   ├── pdf/
│   │   ├── index.ts                       ← generatePdf() — Playwright PDF output
│   │   └── metadata.ts                    ← injectMetadata() — pdf-lib metadata patch
│   │
│   ├── assets/
│   │   └── css.ts                         ← baseCss + printCss exported as TS strings
│   │
│   ├── plugins/
│   │   ├── toc.ts                         ← rehypeToc() — TOC generation plugin
│   │   ├── page-breaks.ts                 ← rehypePageBreaks() — page break plugin
│   │   └── mermaid/
│   │       ├── index.ts                   ← re-exports all mermaid module exports
│   │       ├── detector.ts                ← rehypeMermaidDetector() — finds & replaces mermaid blocks
│   │       ├── renderer.ts                ← renderMermaidBlocks() — Playwright SVG rendering
│   │       ├── inliner.ts                 ← inlineMermaidSvgs() — SVG → placeholder replacement
│   │       └── theme-map.ts              ← getMermaidTheme() — maps md2pdf theme → Mermaid theme
│   │
│   ├── errors/
│   │   ├── index.ts                       ← Md2PdfError class + Md2PdfErrorCode enum
│   │   ├── detect.ts                      ← detectBrowserError() — classifies Playwright errors
│   │   └── recommendations.ts             ← getRecommendation() — actionable fix suggestions
│   │
│   ├── types/
│   │   └── index.ts                       ← ConvertOptions, ConvertResult, PdfMetadata
│   │
│   ├── themes/                            ← Scaffolded (empty), for v0.6.0
│   │   ├── default/
│   │   ├── github/
│   │   ├── obsidian-light/
│   │   └── obsidian-dark/
│   │
│   ├── config/                            ← Scaffolded (empty), for v0.5.0
│   ├── commands/                          ← Scaffolded (empty), for future subcommands
│   ├── constants/                         ← Scaffolded (empty)
│   └── utils/                             ← Scaffolded (empty)
│
├── tests/                                 ← Test suite
│   ├── README.md                          ← Test directory guide
│   ├── parser/
│   │   └── index.test.ts
│   ├── renderer/
│   │   └── index.test.ts
│   ├── pdf/
│   │   └── index.test.ts
│   ├── cli/                               ← E2E CLI tests (scaffolded, empty)
│   ├── fixtures/                          ← Golden document .md sources
│   │   ├── README.md
│   │   ├── basic.md
│   │   ├── code-blocks.md
│   │   ├── footnotes.md
│   │   ├── headers-footers.md
│   │   ├── images.md
│   │   ├── long-document.md
│   │   ├── mermaid-charts.md
│   │   ├── mermaid-class.md
│   │   ├── mermaid-er.md
│   │   ├── mermaid-errors.md
│   │   ├── mermaid-flowchart.md
│   │   ├── mermaid-mixed.md
│   │   ├── mermaid-narrative.md
│   │   ├── mermaid-sequence.md
│   │   ├── mermaid-state.md
│   │   ├── metadata.md
│   │   ├── nested-lists.md
│   │   ├── page-breaks.md
│   │   ├── tables.md
│   │   └── toc.md
│   ├── snapshots/
│   │   └── README.md
│   ├── benchmarks/
│   │   └── README.md
│   ├── output/                            ← Render output (GITIGNORED)
│   └── diff/                              ← Pixel-diff images (GITIGNORED)
│
├── docs/                                  ← Documentation
│   ├── README.md
│   ├── 00-research-initial.md
│   ├── 01-research.md
│   ├── 02-architecture.md
│   ├── 03-strategy.md
│   └── contributing.md
│
├── examples/
│   ├── README.md
│   ├── basic.md
│   └── basic.pdf
│
├── scripts/
│   ├── README.md
│   └── install-browser.mjs               ← postinstall: downloads Chromium via Playwright
│
├── templates/
│   └── README.md
│
├── phase/                                 ← Internal dev planning (GITIGNORED)
│   ├── README.md
│   ├── GOLDEN-DOCUMENTS.md
│   ├── v0.0.1-foundation.md
│   ├── v0.0.2-packaging.md
│   ├── v0.1.0-core-rendering.md
│   ├── v0.1.1-toc-footnotes.md
│   ├── v0.1.2-headers-footers.md
│   ├── v0.2.0-mermaid.md
│   ├── v0.2.1-mermaid-improvements.md
│   ├── v0.3.0-math.md
│   ├── v0.4.0-obsidian-core.md
│   ├── v0.4.1-obsidian-embeds.md
│   ├── v0.5.0-config.md
│   ├── v0.6.0-themes.md
│   ├── v0.7.0-plugins.md
│   ├── v0.8.0-performance.md
│   ├── v0.9.0-stabilization.md
│   ├── v0.9.x-bugfixes.md
│   └── v1.0.0-stable.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
│
└── .husky/
    └── _/
        ├── .gitignore
        └── husky.sh
```

---

## 4. Every Source File — Complete Code

### `src/index.ts` — Public API entry point
```ts
export { convert } from './core/index.js';
export type { ConvertOptions, ConvertResult, PdfMetadata } from './types/index.js';
```

**Note:** v0.2.0 exports `ConvertResult` and `PdfMetadata` in addition to `ConvertOptions`. `convert()` now returns `Promise<ConvertResult>` instead of `Promise<void>`.

---

### `src/types/index.ts` — Type definitions
```ts
export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
}

export interface ConvertOptions {
  input: string;
  output: string;
  theme?: string;
  paper?: 'A4' | 'Letter' | 'Legal';
  margin?: string; // e.g., '20mm'
  toc?: boolean;
  tocDepth?: number;
  tocTitle?: string;
  metadata?: PdfMetadata;
  header?: boolean | { enabled?: boolean; template?: string };
  footer?: boolean | { enabled?: boolean; template?: string };
  pageBreaks?: {
    h1NewPage?: boolean;
    hrAsPageBreak?: boolean;
  };
  mermaid?: {
    theme?: 'default' | 'dark' | 'base' | 'neutral';
    timeout?: number;
  };
}

export interface ConvertResult {
  outputPath: string;
  pageCounts: number;
  renderTimeMs: number;
  warnings: string[];
  metadata?: PdfMetadata;
}
```

**Key v0.2.0 additions:**
- `PdfMetadata` interface (title, author, subject, keywords, creator, producer, creationDate)
- `ConvertOptions.mermaid` field (`theme`, `timeout`)
- `ConvertOptions.paper`, `margin`, `toc`, `tocDepth`, `tocTitle`, `header`, `footer`, `pageBreaks`
- `ConvertResult` — convert() now returns structured result instead of void

---

### `src/core/index.ts` — convert() implementation
```ts
import { parseMarkdown } from '../parser/index.js';
import { renderHtmlTemplate } from '../renderer/index.js';
import { generatePdf } from '../pdf/index.js';
import { ConvertOptions, ConvertResult, PdfMetadata } from '../types/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';
import { injectMetadata } from '../pdf/metadata.js';

export async function convert(options: ConvertOptions): Promise<ConvertResult> {
  const startTime = Date.now();
  const { input, output, paper, margin } = options;

  const inputPath = path.resolve(process.cwd(), input);
  const rawMarkdown = await fs.readFile(inputPath, 'utf-8');

  let frontmatter: any;
  let markdown: string;
  try {
    const parsed = matter(rawMarkdown);
    frontmatter = parsed.data;
    markdown = parsed.content;
  } catch (error: any) {
    const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
    throw new Md2PdfError(
      Md2PdfErrorCode.ERR_CONFIG_ERROR,
      'Invalid Frontmatter',
      'Invalid frontmatter YAML: ' + (error.message || String(error)),
      { markdownFile: inputPath }
    );
  }

  if (frontmatter.publish === false) {
    const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
    throw new Md2PdfError(
      Md2PdfErrorCode.ERR_CONFIG_ERROR,
      'Skipped Conversion',
      'The file has `publish: false` in its frontmatter.',
      { markdownFile: inputPath }
    );
  }

  const dir = path.dirname(inputPath);
  const processedMarkdown = markdown.replace(/!\[([^\]]*)\]\((?!http|data:|file:)([^)]+)\)/g, (match, alt, fullSrc) => {
    const parts = fullSrc.trim().split(/\s+/);
    const src = parts[0];
    const title = parts.slice(1).join(' ');
    const absPath = path.resolve(dir, decodeURIComponent(src));
    const fileUrl = 'file://' + encodeURI(absPath.replace(/\\/g, '/'));
    return `![${alt}](${fileUrl}${title ? ' ' + title : ''})`;
  });

  const mermaidBlocks: any[] = [];

  const parsed = await parseMarkdown(processedMarkdown, {
    toc: options.toc,
    tocDepth: options.tocDepth,
    tocTitle: options.tocTitle,
    pageBreaks: options.pageBreaks,
    mermaidBlocks,
  });

  const title = options.metadata?.title || frontmatter.title || path.basename(input, path.extname(input));
  const html = renderHtmlTemplate(parsed.html, title);

  const outputPath = path.resolve(process.cwd(), output);

  const metadata: PdfMetadata = {
    ...options.metadata,
    title,
    author: options.metadata?.author ?? frontmatter.author,
    subject: options.metadata?.subject ?? frontmatter.subject,
    keywords: options.metadata?.keywords ?? (Array.isArray(frontmatter.keywords) ? frontmatter.keywords.join(', ') : frontmatter.keywords),
    creationDate: options.metadata?.creationDate ?? (frontmatter.date ? new Date(frontmatter.date) : undefined),
  };

  let headerTemplate = undefined;
  let marginTop = margin;
  const headerEnabled = options.header === true ||
    (typeof options.header === 'object' && options.header.enabled !== false);

  if (headerEnabled && options.header !== undefined) {
    marginTop = '30mm';
    if (typeof options.header === 'object' && options.header.template) {
      headerTemplate = options.header.template;
    } else {
      headerTemplate = `
      <div style="font-family: Inter, sans-serif; font-size: 9px; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; border-bottom: 0.5px solid #ccc; margin-bottom: 5mm; padding-bottom: 2mm;">
        <span class="title"></span>
        <span>${metadata.author ? metadata.author + ' — ' : ''}<span class="date"></span></span>
      </div>`;
    }
  }

  let footerTemplate = undefined;
  let marginBottom = margin;
  const footerEnabled = options.footer === true ||
    (typeof options.footer === 'object' && options.footer.enabled !== false);

  if (footerEnabled && options.footer !== undefined) {
    marginBottom = '30mm';
    if (typeof options.footer === 'object' && options.footer.template) {
      footerTemplate = options.footer.template;
    } else {
      footerTemplate = `
      <div style="font-family: Inter, sans-serif; font-size: 9px; width: 100%; padding: 0 15mm; display: flex; justify-content: center; border-top: 0.5px solid #ccc; margin-top: 5mm; padding-top: 2mm;">
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`;
    }
  }

  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const { processBeforeRender } = await import('../renderer/pipeline.js');
    const processedHtml = await processBeforeRender(html, browser, mermaidBlocks, {
      theme: options.theme || frontmatter.theme,
      globalMermaidTheme: options.mermaid?.theme || frontmatter.mermaid?.theme,
      timeout: options.mermaid?.timeout || frontmatter.mermaid?.timeout
    });

    await generatePdf({
      html: processedHtml,
      outputPath,
      format: paper,
      margin,
      marginTop,
      marginBottom,
      displayHeaderFooter: (headerEnabled && options.header !== undefined) || (footerEnabled && options.footer !== undefined),
      headerTemplate,
      footerTemplate,
      browser,
    });
  } catch (error) {
    const { detectBrowserError } = await import('../errors/detect.js');
    throw detectBrowserError(error, { markdownFile: inputPath, outputPath });
  } finally {
    if (browser) await browser.close();
  }

  const pageCounts = await injectMetadata(outputPath, metadata);

  return {
    outputPath,
    pageCounts,
    renderTimeMs: Date.now() - startTime,
    warnings: parsed.warnings,
    metadata
  };
}
```

**Critical implementation details:**
- `gray-matter` strips YAML frontmatter before Markdown is parsed — the resulting `content` is the raw Markdown body.
- `publish: false` in frontmatter throws a typed `Md2PdfError` — the CLI shows actionable guidance.
- Image path regex now handles encoded URIs (spaces in filenames), skips `http`, `data:`, and `file:` prefixes, and preserves optional Markdown image titles.
- `mermaidBlocks` is a shared array passed into parser and later into `processBeforeRender`.
- Browser is launched **once**, reused for both Mermaid rendering and PDF generation, then closed in `finally`.
- `metadata` merges frontmatter fields (`title`, `author`, `subject`, `keywords`, `date`) with `options.metadata` — options take priority.
- Header/footer both increase their respective margin to `30mm` to avoid content overlap.
- `injectMetadata` patches the written PDF via `pdf-lib` and returns the page count.

---

### `src/parser/index.ts` — Markdown → HTML pipeline
```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeToc from '../plugins/toc.js';
import rehypePageBreaks from '../plugins/page-breaks.js';

import { rehypeMermaidDetector, MermaidBlock } from '../plugins/mermaid/index.js';
import { visit } from 'unist-util-visit';

function rehypeExpandDetails() {
  return (tree: any) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'details') {
        node.properties = node.properties || {};
        node.properties.open = true;
      }
    });
  };
}

export async function parseMarkdown(
  markdown: string,
  options?: {
    toc?: boolean;
    tocDepth?: number;
    tocTitle?: string;
    pageBreaks?: {
      h1NewPage?: boolean;
      hrAsPageBreak?: boolean;
    };
    mermaidBlocks?: MermaidBlock[];
  }
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];
  const mermaidBlocks = options?.mermaidBlocks || [];

  const file = await unified()
    .use(remarkParse)
    // remark-gfm natively enables GFM footnotes, tables, and tasklists
    .use(remarkGfm)
    // allowDangerousHtml: true passes raw HTML tags in Markdown directly to the PDF output.
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypePageBreaks, options?.pageBreaks)
    .use(rehypeToc, {
      enable: options?.toc,
      depth: options?.tocDepth,
      title: options?.tocTitle,
    })
    .use(rehypeMermaidDetector, { blocks: mermaidBlocks })
    .use(rehypeExpandDetails)
    .use(rehypeShiki, {
      theme: 'github-light',
      fallbackLanguage: 'txt',
      onError: (err: unknown) => {
        if (err instanceof Error) {
          warnings.push(err.message);
        } else {
          warnings.push(String(err));
        }
      }
    })
    // allowDangerousHtml: true stringifies any raw HTML nodes so they render correctly.
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  // Add any warnings from unified itself
  file.messages.forEach(msg => warnings.push(msg.reason || msg.message));

  return { html: String(file), warnings };
}
```

**Plugin chain order (matters):**
1. `remarkParse` → Markdown text to mdast
2. `remarkGfm` → adds GFM tables, footnotes, task lists, strikethrough, autolinks
3. `remarkRehype` → mdast to hast (HTML AST), `allowDangerousHtml: true`
4. `rehypeSlug` → adds `id="..."` to h1-h6 (needed for TOC links)
5. `rehypePageBreaks` → converts `<!-- pagebreak -->`, H1 new-page, HR page-break
6. `rehypeToc` → if `toc: true`, injects a `<div class="table-of-contents">` at the top
7. `rehypeMermaidDetector` → finds `<pre><code class="language-mermaid">`, saves source to `mermaidBlocks[]`, replaces with `<div id="mermaid-placeholder-N">`
8. `rehypeExpandDetails` → adds `open` attribute to all `<details>` (PDF cannot expand them interactively)
9. `rehypeShiki` → server-side syntax highlighting using `github-light` theme; non-fatal errors go to warnings
10. `rehypeStringify` → hast to HTML string, `allowDangerousHtml: true`

**Return value:** `{ html: string; warnings: string[] }` — warnings are collected from Shiki errors and unified message system.

---

### `src/renderer/index.ts` — HTML page template
```ts
import { baseCss, printCss } from '../assets/css.js';

function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

export function renderHtmlTemplate(contentHtml: string, title: string = 'Document'): string {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <!-- TODO(v0.6.0): Bundle fonts locally instead of CDN to support offline/air-gapped environments -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    ${baseCss}
    ${printCss}
  </style>
</head>
<body>
  <div class="markdown-body">
    ${contentHtml}
  </div>
</body>
</html>`;
}
```

**Key v0.2.0 changes vs v0.0.2:**
- CSS is no longer inline in this file — it is imported from `src/assets/css.ts` as `baseCss` and `printCss` strings.
- Title is HTML-escaped via `escapeHtml()` to prevent XSS-style rendering bugs in the PDF title tag.
- Inter + JetBrains Mono loaded from Google Fonts CDN. Soft-fails if offline (3s timeout in `generatePdf`).
- `.markdown-body` padding is now `0` (margins are handled by Playwright's `page.pdf()` margin options).

---

### `src/renderer/pipeline.ts` — Before-render processing
```ts
import { Browser } from 'playwright';
import { MermaidBlock, renderMermaidBlocks, inlineMermaidSvgs } from '../plugins/mermaid/index.js';

import { MermaidTheme } from '../plugins/mermaid/theme-map.js';

export async function processBeforeRender(
  html: string,
  browser: Browser,
  mermaidBlocks: MermaidBlock[],
  options?: {
    theme?: string;
    globalMermaidTheme?: MermaidTheme;
    timeout?: number;
  }
): Promise<string> {
  if (mermaidBlocks && mermaidBlocks.length > 0) {
    const renderedSvgs = await renderMermaidBlocks(
      browser,
      mermaidBlocks,
      options?.theme,
      options?.globalMermaidTheme,
      options?.timeout
    );
    return inlineMermaidSvgs(html, renderedSvgs);
  }
  return html;
}
```

**Role:** Acts as a pre-PDF hook. Currently only handles Mermaid. Future hooks (`beforeRender`, `afterPageLoad`) will be added here. Returns html unchanged if no mermaid blocks exist.

---

### `src/pdf/index.ts` — Playwright PDF generation
```ts
import { chromium, Browser } from 'playwright';

export interface PdfOptions {
  html: string;
  outputPath: string;
  format?: 'A4' | 'Letter' | 'Legal';
  margin?: string;
  marginTop?: string;
  marginBottom?: string;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  browser?: Browser;
}

export async function generatePdf(options: PdfOptions): Promise<void> {
  const browser = options.browser || await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Load HTML — use domcontentloaded first, then briefly wait for networkidle
    // (covers Google Fonts CDN). Falls back gracefully if fonts are slow/offline.
    await page.setContent(options.html, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForLoadState('networkidle', { timeout: 3000 });
    } catch {
      // Font CDN timed out — PDF renders with fallback fonts, no crash
    }

    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const marginValue = options.margin || '20mm';

    await page.pdf({
      path: options.outputPath,
      format: options.format || 'A4',
      printBackground: true,
      margin: {
        top: options.marginTop || marginValue,
        right: marginValue,
        bottom: options.marginBottom || marginValue,
        left: marginValue,
      },
      displayHeaderFooter: options.displayHeaderFooter || false,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
    });
  } finally {
    if (!options.browser) {
      await browser.close();
    }
  }
}
```

**Critical notes:**
- `options.browser` — if a pre-launched browser is passed (from `core/index.ts`), it is **not closed** here; core closes it in its own `finally`. If not passed, a new browser is launched and closed locally.
- `waitUntil: 'domcontentloaded'` + 3s `networkidle` — fast path for offline use, Google Fonts CDN has max 3s wait.
- `document.fonts.ready` — explicit web font wait after `setContent`.
- `marginTop`/`marginBottom` override `margin` when headers/footers are enabled (set to `30mm` by core).
- Right/left margins always equal the base `margin` value.

---

### `src/pdf/metadata.ts` — PDF metadata injection
```ts
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PdfMetadata } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Try both paths to handle both src (ts-node) and dist (bundled) environments gracefully
const pkgPath1 = path.resolve(__dirname, '../../package.json');
const pkgPath2 = path.resolve(__dirname, '../package.json');
const pkgPath = existsSync(pkgPath1) ? pkgPath1 : pkgPath2;
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const version = pkg.version as string;

export async function injectMetadata(pdfPath: string, metadata: PdfMetadata): Promise<number> {
  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  if (metadata.title) pdfDoc.setTitle(metadata.title);
  if (metadata.author) pdfDoc.setAuthor(metadata.author);
  if (metadata.subject) pdfDoc.setSubject(metadata.subject);
  if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords.split(',').map(k => k.trim()));

  pdfDoc.setCreator(metadata.creator || `md2pdf ${version}`);
  pdfDoc.setProducer(metadata.producer || 'Playwright');
  pdfDoc.setCreationDate(metadata.creationDate || new Date());

  const modifiedPdfBytes = await pdfDoc.save();
  await fs.writeFile(pdfPath, modifiedPdfBytes);

  return pdfDoc.getPageCount();
}
```

**Notes:**
- `version` is read dynamically at module load time from `package.json` — no hardcoding.
- `pkgPath1/pkgPath2` dual-path resolution handles both `src/` (TypeScript dev) and `dist/` (bundled) environments.
- `keywords` is a comma-separated string in `PdfMetadata`; split to array for `pdf-lib`.
- Returns `pageCount` (int), which propagates as `ConvertResult.pageCounts`.

---

### `src/assets/css.ts` — CSS as TypeScript string exports
```ts
export const baseCss = `
:root {
  --md2pdf-font-family-body: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --md2pdf-font-family-heading: inherit;
  --md2pdf-font-family-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --md2pdf-font-size: 11pt;
  --md2pdf-line-height: 1.7;

  --md2pdf-color-text: #1a1a1a;
  --md2pdf-color-heading: #111111;
  --md2pdf-color-link: #0066cc;
  --md2pdf-color-code-bg: #f6f8fa;
  --md2pdf-color-border: #e1e4e8;
  --md2pdf-color-blockquote-border: #d0d7de;

  --md2pdf-code-border-radius: 6px;
}

body {
  font-family: var(--md2pdf-font-family-body);
  font-size: var(--md2pdf-font-size);
  line-height: var(--md2pdf-line-height);
  color: var(--md2pdf-color-text);
  background-color: #fff;
  margin: 0;
  padding: 0;
  word-wrap: break-word;
}

.markdown-body { padding: 0; margin: 0; }

h1, h2, h3, h4, h5, h6 {
  font-family: var(--md2pdf-font-family-heading);
  color: var(--md2pdf-color-heading);
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
  page-break-after: avoid;
}

h1 { font-size: 2.027em; border-bottom: 1px solid var(--md2pdf-color-border); padding-bottom: 0.3em; }
h2 { font-size: 1.602em; border-bottom: 1px solid var(--md2pdf-color-border); padding-bottom: 0.3em; }
h3 { font-size: 1.266em; }
h4 { font-size: 1em; }

p, blockquote, ul, ol, dl, table, pre { margin-top: 0; margin-bottom: 16px; widows: 2; orphans: 2; }

a { color: var(--md2pdf-color-link); text-decoration: none; }
a:hover { text-decoration: underline; }

blockquote {
  margin: 1.5em 0; padding: 1em 1.5em;
  color: #555; background-color: #f9f9f9;
  border-left: 4px solid var(--md2pdf-color-blockquote-border);
  font-style: italic; border-radius: 0 4px 4px 0;
}

code, kbd, pre { font-family: var(--md2pdf-font-family-mono); font-size: 85%; }

pre {
  padding: 1em 1.2em; overflow-x: auto; line-height: 1.45;
  background-color: var(--md2pdf-color-code-bg);
  border-radius: var(--md2pdf-code-border-radius);
  page-break-inside: avoid;
}
pre code { padding: 0; margin: 0; background-color: transparent; border: 0; }

code {
  padding: 0.2em 0.4em; margin: 0;
  background-color: var(--md2pdf-color-code-bg);
  border-radius: var(--md2pdf-code-border-radius);
}

table { border-spacing: 0; border-collapse: collapse; width: 100%; page-break-inside: avoid; }
table th, table td { padding: 8px 12px; border: 1px solid var(--md2pdf-color-border); }
table th { font-weight: 600; background-color: #f6f8fa; }
table tr { background-color: #fff; border-top: 1px solid var(--md2pdf-color-border); page-break-inside: avoid; }
table tr:nth-child(even) { background-color: #f8f9fa; }

img { max-width: 100%; height: auto; box-sizing: content-box; page-break-inside: avoid; display: block; margin: auto; }

figure { margin: 1em 0; page-break-inside: avoid; page-break-after: avoid; }
figcaption { text-align: center; font-size: 85%; color: #666; margin-top: 0.5em; }

hr { height: 0.25em; padding: 0; margin: 24px 0; background-color: var(--md2pdf-color-border); border: 0; }

ul { list-style-type: disc; }
ul ul { list-style-type: circle; }
ul ul ul { list-style-type: square; }
ul ul, ol ol, ul ol, ol ul { margin-top: 0.5em; margin-bottom: 0; }
ul, ol { padding-left: 2em; margin-top: 0; margin-bottom: 1em; }
li { margin: 0.25em 0; }
li > p { margin-top: 16px; }
li + li { margin-top: 0.25em; }

/* Task lists */
.contains-task-list { list-style-type: none; padding-left: 1.5em; }
.task-list-item { position: relative; }
.task-list-item input[type="checkbox"] { position: absolute; left: -1.5em; top: 0.25em; }

/* TOC */
.table-of-contents { margin: 2em 0; }
.toc-title { font-size: 1.5em; border-bottom: none; }
.toc-list { list-style: none; padding-left: 0; }
.toc-list .toc-list { padding-left: 1.5em; }
.toc-list li { margin: 0.2em 0; }
.toc-list a { text-decoration: none; color: var(--md2pdf-color-link); }
.toc-level-1 > a { font-weight: bold; }
.toc-level-3 > a { color: #555; }
.toc-level-4 > a { color: #777; }
.toc-level-5 > a { color: #999; }
.toc-level-6 > a { color: #aaa; }
.toc-separator { margin-top: 2em; }

/* Footnotes */
.footnotes { font-size: 9pt; margin-top: 2em; }
.footnotes::before { content: ""; display: block; width: 40%; border-top: 1px solid var(--md2pdf-color-border); margin: 1em 0; }
.footnotes ol { padding-left: 1.2em; }
.footnotes .sr-only { display: none; }
sup a[data-footnote-ref] { font-size: 0.7em; text-decoration: none; }

/* Details and Summary */
details { padding: 1em; border: 1px solid var(--md2pdf-color-border); border-radius: 6px; margin: 1em 0; background-color: #fbfbfb; }
details > summary { font-weight: 600; cursor: pointer; }
details[open] > summary { margin-bottom: 0.5em; }
`;

export const printCss = `
@media print {
  body { background-color: #fff !important; color: #000 !important; }
  .markdown-body { padding: 0; max-width: none; }
  * {
    color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    box-shadow: none !important;
    text-shadow: none !important;
    transition: none !important;
  }
  a[href^="http"] > img::after { content: ""; }
  pre, code, pre code {
    white-space: pre-wrap !important;
    word-wrap: break-word !important;
    overflow-x: hidden !important;
  }
  .md2pdf-page-break,
  .md2pdf-page-break-before {
    page-break-before: always !important;
    break-before: page !important;
  }
}
`;
```

**CSS variables (v0.2.0 — fully renamed from old `--text-main` etc.):**

| Variable | Value | Purpose |
|----------|-------|---------|
| `--md2pdf-font-family-body` | Inter + system fallback | Body text font |
| `--md2pdf-font-family-heading` | inherit | Heading font (inherits body) |
| `--md2pdf-font-family-mono` | JetBrains Mono + fallback | Code font |
| `--md2pdf-font-size` | 11pt | Base font size |
| `--md2pdf-line-height` | 1.7 | Body line height |
| `--md2pdf-color-text` | #1a1a1a | Body text color |
| `--md2pdf-color-heading` | #111111 | Heading text color |
| `--md2pdf-color-link` | #0066cc | Link color |
| `--md2pdf-color-code-bg` | #f6f8fa | Code block background |
| `--md2pdf-color-border` | #e1e4e8 | Table/heading borders |
| `--md2pdf-color-blockquote-border` | #d0d7de | Blockquote left border |
| `--md2pdf-code-border-radius` | 6px | Code block rounding |

---

### `src/plugins/toc.ts` — Table of Contents rehype plugin
```ts
import { visit } from 'unist-util-visit';
import { Element, Root } from 'hast';

export interface TocOptions {
  enable?: boolean;
  depth?: number;
  title?: string;
}

export default function rehypeToc(options: TocOptions = {}) {
  const { enable = false, depth = 3, title = 'Table of Contents' } = options;

  return (tree: Root) => {
    if (!enable) return;

    const headings: { depth: number; id: string; value: string }[] = [];

    visit(tree, 'element', (node: Element) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        const headingDepth = parseInt(node.tagName.charAt(1), 10);
        if (headingDepth <= depth) {
          const id = (node.properties?.id as string) || '';
          let value = '';
          visit(node, 'text', (textNode: import('hast').Text) => {
            value += textNode.value;
          });
          headings.push({ depth: headingDepth, id, value });
        }
      }
    });

    if (headings.length === 0) return;

    // Builds a properly nested <ul> tree respecting heading depth
    const buildList = (items: typeof headings): Element => { /* ... */ };

    const tocSection: Element = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['table-of-contents'] },
      children: [
        { type: 'element', tagName: 'h2', properties: { className: ['toc-title'] }, children: [{ type: 'text', value: title }] },
        buildList(headings),
        { type: 'element', tagName: 'hr', properties: { className: ['toc-separator'] }, children: [] }
      ],
    };

    tree.children.unshift(tocSection);
  };
}
```

**Behavior:** Only runs if `enable: true`. Collects h1-h(depth) headings (using `id` set by `rehype-slug`), builds a semantically nested `<ul class="toc-list">`, prepends to `<body>`. Pruner removes empty trailing nested `<ul>` elements.

---

### `src/plugins/page-breaks.ts` — Page break rehype plugin
```ts
export interface PageBreakOptions {
  h1NewPage?: boolean;
  hrAsPageBreak?: boolean;
}

export default function rehypePageBreaks(options: PageBreakOptions = {}) {
  const { h1NewPage = false, hrAsPageBreak = false } = options;
  // ...
}
```

**Three mechanisms:**
1. `<!-- pagebreak -->` raw HTML comment → replaced with `<div class="md2pdf-page-break">` (CSS: `page-break-before: always`)
2. `h1NewPage: true` → all h1s after the first get class `md2pdf-page-break-before` (first h1 is never broken before)
3. `hrAsPageBreak: true` → `<hr>` elements replaced with page break div

**CSS classes** (defined in `printCss`):
- `.md2pdf-page-break` — `page-break-before: always; break-before: page;`
- `.md2pdf-page-break-before` — same

---

### `src/plugins/mermaid/detector.ts` — Mermaid block detector
```ts
export interface MermaidBlock {
  id: string;
  source: string;
  theme?: string;
  line?: number;
}

export interface MermaidDetectorOptions {
  blocks: MermaidBlock[];
}

export const rehypeMermaidDetector: Plugin<[MermaidDetectorOptions], Root> = (options) => {
  return (tree) => {
    let counter = 0;
    visit(tree, 'element', (node: Element, index, parent) => {
      // Finds <pre><code class="language-mermaid">
      // Extracts source text, optional {theme=dark} meta
      // Pushes to options.blocks[]
      // Replaces <pre> with <div id="mermaid-placeholder-N" class="mermaid-container">
    });
  };
};
```

**Key behaviors:**
- Skips empty blocks.
- Extracts per-diagram theme override from code meta: `` ```mermaid {theme=dark} ``.
- Placeholder `<div>` has `style="page-break-inside: avoid;"` to prevent diagram splitting across pages.
- `id` format: `mermaid-placeholder-0`, `mermaid-placeholder-1`, etc.

---

### `src/plugins/mermaid/renderer.ts` — Mermaid SVG rendering
```ts
export interface RenderedMermaid {
  id: string;
  svgHtml: string;
}

export async function renderMermaidBlocks(
  browser: Browser,
  blocks: MermaidBlock[],
  md2pdfTheme: string = 'default',
  globalMermaidTheme?: MermaidTheme,
  timeoutMs: number = 10000
): Promise<RenderedMermaid[]>
```

**Rendering approach:**
1. Creates a new browser context with `deviceScaleFactor: 2` (HiDPI).
2. Loads blank HTML page in the context.
3. Injects `mermaid/dist/mermaid.min.js` via `require.resolve` (no bundling — loaded at runtime from `node_modules`).
4. For each block: calls `window.mermaid.initialize({ startOnLoad: false, theme })` + `window.mermaid.render(id, source)` inside `page.evaluate()` with a per-diagram timeout.
5. On render success: strips hardcoded `width` and `style` from SVG, applies responsive `max-width: 100%` width based on `viewBox` dimensions.
6. On render error: returns a red error `<div>` with `<pre>` of the error message and collapsible `<details>` showing source — never throws.
7. Theme resolution order: diagram-level `{theme=X}` > `globalMermaidTheme` > `md2pdfTheme` auto-mapping.

---

### `src/plugins/mermaid/inliner.ts` — SVG inliner
```ts
export function inlineMermaidSvgs(html: string, rendered: RenderedMermaid[]): string {
  let processedHtml = html;
  for (const item of rendered) {
    const regex = new RegExp(`<div\\s+id="${item.id}"[^>]*></div>`, 'g');
    processedHtml = processedHtml.replace(
      regex,
      `<div class="mermaid-container" style="page-break-inside: avoid; display: flex; justify-content: center; margin: 20px 0;">${item.svgHtml}</div>`
    );
  }
  return processedHtml;
}
```

---

### `src/plugins/mermaid/theme-map.ts` — Theme mapping
```ts
export type MermaidTheme = 'default' | 'dark' | 'base' | 'neutral';

export function getMermaidTheme(
  md2pdfTheme?: string,
  diagramMetaOverride?: string,
  globalMermaidOverride?: MermaidTheme
): MermaidTheme
```

| md2pdf theme | Mermaid theme |
|---|---|
| `default` | `default` |
| `github` | `base` |
| `obsidian-light` | `default` |
| `obsidian-dark` | `dark` |
| `dracula` | `dark` |
| `nord` | `neutral` |
| `academic` | `neutral` |
| (unknown) | `default` |

---

### `src/errors/index.ts` — Error types
```ts
export enum Md2PdfErrorCode {
  // Core browser errors
  ERR_BROWSER_MISSING = 'ERR_BROWSER_MISSING',
  ERR_BROWSER_LAUNCH_FAILED = 'ERR_BROWSER_LAUNCH_FAILED',
  ERR_MISSING_DEPENDENCIES = 'ERR_MISSING_DEPENDENCIES',
  ERR_SANDBOX = 'ERR_SANDBOX',
  ERR_PERMISSION_DENIED = 'ERR_PERMISSION_DENIED',
  ERR_OUT_OF_MEMORY = 'ERR_OUT_OF_MEMORY',
  ERR_UNSUPPORTED_ARCH = 'ERR_UNSUPPORTED_ARCH',
  ERR_NETWORK_TIMEOUT = 'ERR_NETWORK_TIMEOUT',

  // I/O & Configuration
  ERR_OUTPUT_DIR_MISSING = 'ERR_OUTPUT_DIR_MISSING',
  ERR_INVALID_MARKDOWN = 'ERR_INVALID_MARKDOWN',
  ERR_CONFIG_ERROR = 'ERR_CONFIG_ERROR',

  // Future-proofing
  ERR_INVALID_THEME = 'ERR_INVALID_THEME',
  ERR_PLUGIN_FAILURE = 'ERR_PLUGIN_FAILURE',
  ERR_FONT_MISSING = 'ERR_FONT_MISSING',
  ERR_REMOTE_ASSET_FAILED = 'ERR_REMOTE_ASSET_FAILED',

  // Fallback
  ERR_UNKNOWN = 'ERR_UNKNOWN'
}

export class Md2PdfError extends Error {
  public code: Md2PdfErrorCode;
  public title: string;
  public reason: string;
  public context: ErrorContext;
  public originalError?: Error | unknown;
}
```

---

### `src/errors/detect.ts` — Browser error classification
`detectBrowserError(error, contextBase)` maps raw Playwright/OS error strings to typed `Md2PdfError` codes:

| Pattern | Code |
|---------|------|
| `Executable doesn't exist` / `playwright install` | `ERR_BROWSER_MISSING` |
| `error while loading shared libraries` / `.so` match | `ERR_MISSING_DEPENDENCIES` |
| `No usable sandbox` / `zygote` | `ERR_SANDBOX` |
| `ENOMEM` / `Cannot allocate memory` | `ERR_OUT_OF_MEMORY` |
| `EACCES` / `Permission denied` | `ERR_PERMISSION_DENIED` |
| `Exec format error` / `ELF` | `ERR_UNSUPPORTED_ARCH` |
| `ETIMEDOUT` / `ECONNRESET` / `ECONNREFUSED` | `ERR_NETWORK_TIMEOUT` |
| `browserType.launch` | `ERR_BROWSER_LAUNCH_FAILED` |
| (fallback) | `ERR_UNKNOWN` |

---

### `src/errors/recommendations.ts` — Human-readable fix suggestions
`getRecommendation(error)` returns `{ summary, commands, docs? }` for each error code.

| Code | Summary | Commands |
|------|---------|----------|
| `ERR_BROWSER_MISSING` | Playwright needs Chromium binary | `npx playwright install chromium` |
| `ERR_MISSING_DEPENDENCIES` | Missing system shared libraries | `sudo npx playwright install-deps` (linux) |
| `ERR_SANDBOX` | OS sandboxing unavailable | — (requires code changes) |
| `ERR_PERMISSION_DENIED` | Browser executable not executable | `chmod +x <path>` or `chmod -R 755 ~/.cache/ms-playwright/` |
| `ERR_OUT_OF_MEMORY` | System OOM | — |
| `ERR_UNSUPPORTED_ARCH` | Wrong CPU arch binary | `npx playwright install chromium` |
| `ERR_CONFIG_ERROR` | frontmatter `publish: false` | Remove or set `publish: true` |
| (default) | — | — |

---

### `src/cli/index.ts` — Main CLI binary (summary)

**Key v0.2.0 changes:**
- Version read dynamically: `const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'))` → `program.version(pkg.version)`
- Two subcommands registered: `program.addCommand(doctorCmd)` + `program.addCommand(initCmd)`
- Exit code constants: `EXIT.OK=0`, `EXIT.USAGE_ERROR=1`, `EXIT.ENVIRONMENT_ERROR=2`, `EXIT.INTERNAL_BUG=3`
- `renderCliError()` renders typed `Md2PdfError` with title, reason, recommendation, error code. `--json-errors` flag outputs JSON to stderr instead.
- Input validation: file must exist, not be a directory, must end with `.md`, stdin (`-`) is rejected.
- Output validation: trailing slash guard, auto-append `.pdf`, resolved input ≠ resolved output.
- `--json-errors` suppresses spinner entirely (returns `{ start, succeed, warn, fail }` no-ops).

**All CLI flags:**

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `<input>` | positional | — | Input `.md` file path |
| `-o, --output <output>` | string | input.replace(`.md`, `.pdf`) | Output PDF path |
| `--toc` | boolean | false | Generate Table of Contents |
| `--toc-depth <depth>` | number (1-6) | 3 | Max heading depth for TOC |
| `--toc-title <title>` | string | `Table of Contents` | TOC section heading |
| `--header` | boolean | false | Enable default running header |
| `--footer` | boolean | false | Enable default running footer |
| `--header-template <html>` | string | — | Custom HTML header template |
| `--footer-template <html>` | string | — | Custom HTML footer template |
| `--paper <format>` | A4/Letter/Legal | `A4` | Page format |
| `--margin <size>` | CSS unit | `20mm` | Page margin (all sides) |
| `--hr-page-break` | boolean | false | Treat `---` as page break |
| `--h1-new-page` | boolean | false | Force page break before each H1 |
| `--theme <theme>` | string | — | md2pdf theme name |
| `--mermaid-theme <theme>` | default/dark/base/neutral | auto | Override Mermaid diagram theme |
| `--mermaid-timeout <ms>` | number | 10000 | Mermaid render timeout |
| `--debug` | boolean | false | Print debug diagnostics on error |
| `--verbose` | boolean | false | Print verbose output |
| `--json-errors` | boolean | false | Output errors as JSON to stderr |

---

### `src/cli/doctor.ts` — `md2pdf doctor` subcommand

Runs a sequential health check:
1. Reports Node.js version, md2pdf version, Playwright version
2. Checks if Chromium executable exists at `chromium.executablePath()`
3. Launches browser
4. Sets HTML content
5. Generates a test PDF buffer
6. Writes + deletes a temp file to verify filesystem write permissions

Reports each step as ✔ or ✖. On failure, calls `detectBrowserError()` + `getRecommendation()` and prints actionable guidance. Supports `--json` flag to output machine-readable results.

---

### `src/cli/init.ts` — `md2pdf init` subcommand

Interactive guided Chromium setup wizard:
1. Checks Node.js version
2. Checks if Playwright is available
3. Checks if Chromium executable exists
4. If missing: runs `npx playwright install chromium` + `sudo npx playwright install-deps` (Linux only)
5. Exits with `EXIT.OK` on success or `EXIT.ENVIRONMENT_ERROR` on failure

---

### `scripts/install-browser.mjs` — postinstall script

Run automatically by npm after `npm install` via the `"postinstall"` script in `package.json`.

```mjs
import { execSync } from 'child_process';
import { existsSync } from 'fs';
// ...

// Finds ./node_modules/.bin/playwright, runs: playwright install chromium
// Falls back to npx playwright install chromium
// Writes status to stderr (never stdout — stdout would break piping)
```

**Purpose:** Ensures Chromium is downloaded at install time so `md2pdf` works immediately after `npm install -g`.

---

## 5. Every Test File — Complete Code

### `tests/parser/index.test.ts` — Parser unit tests
```ts
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/parser/index.js';

describe('Markdown Parser', () => {
  it('should parse basic markdown into html', async () => {
    const markdown = '# Hello World\nThis is a test.';
    const { html } = await parseMarkdown(markdown);
    expect(html).toContain('<h1');
    expect(html).toContain('Hello World</h1>');
    expect(html).toContain('<p>This is a test.</p>');
  });

  it('should parse tables', async () => {
    const markdown = '| Col 1 | Col 2 |\n|---|---|\n| A | B |';
    const { html } = await parseMarkdown(markdown);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Col 1</th>');
    expect(html).toContain('<td>A</td>');
  });

  it('should format code blocks correctly', async () => {
    const markdown = '```javascript\nconst a = 1;\n```';
    const { html } = await parseMarkdown(markdown);
    // Shiki wraps code blocks in spans; check for <pre> and language class
    expect(html).toContain('<pre');
    expect(html).toContain('language-javascript');
  });
});
```

**Note:** `parseMarkdown` now returns `{ html, warnings }` not just a string — tests destructure accordingly. Shiki transforms plain `<code>` into token-wrapped `<span>` elements, so the old assertion for raw `<code class="language-javascript">` no longer holds.

### `tests/renderer/index.test.ts` — Renderer unit test
```ts
import { describe, it, expect } from 'vitest';
import { renderHtmlTemplate } from '../../src/renderer/index.js';

describe('HTML Renderer', () => {
  it('should wrap content in a professional HTML document', () => {
    const html = renderHtmlTemplate('<p>Hello</p>', 'Test Doc');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Doc</title>');
    expect(html).toContain('<style>');
    expect(html).toContain('--md2pdf-color-text');
    expect(html).toContain('<div class="markdown-body">');
    expect(html).toContain('<p>Hello</p>');
  });
});
```

**Note:** CSS variable name changed from `--bg-main` (v0.0.2) to `--md2pdf-color-text` (v0.2.0).

### `tests/pdf/index.test.ts` — PDF integration test
```ts
import { describe, it, expect, afterAll } from 'vitest';
import { generatePdf } from '../../src/pdf/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('PDF Engine', () => {
  const outputPath = path.resolve(__dirname, 'test-output.pdf');

  afterAll(async () => {
    try { await fs.unlink(outputPath); } catch { /* ignore */ }
  });

  it('should generate a PDF file from HTML', async () => {
    const html = '<html><body><h1>Hello PDF</h1></body></html>';
    await generatePdf({ html, outputPath });
    const stat = await fs.stat(outputPath);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBeGreaterThan(0);
  }, 30000);
});
```

**Note:** `__dirname` uses `fileURLToPath(import.meta.url)` — ESM-compatible `__dirname` replacement.

---

## 6. Every Config File — Complete Contents

### `package.json`
```json
{
  "name": "@amitdevx/md2pdf",
  "version": "0.2.0",
  "description": "Production-quality Markdown to PDF rendering engine.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "bin": {
    "md2pdf": "dist/cli/index.js"
  },
  "files": [
    "dist",
    "scripts",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "engines": { "node": ">=18" },
  "sideEffects": false,
  "publishConfig": { "access": "public" },
  "scripts": {
    "postinstall": "node scripts/install-browser.mjs",
    "build": "tsup && tsc -p tsconfig.build.json --emitDeclarationOnly",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist/",
    "prepare": "husky install || true",
    "prepublishOnly": "npm run clean && npm run build"
  },
  "repository": "amitdevx/md2pdf",
  "homepage": "https://github.com/amitdevx/md2pdf#readme",
  "bugs": { "url": "https://github.com/amitdevx/md2pdf/issues" },
  "keywords": ["markdown", "pdf", "generator", "playwright", "unified", "remark", "rehype"],
  "author": "Amit Divekar",
  "license": "MIT",
  "dependencies": {
    "@shikijs/rehype": "^4.3.0",
    "commander": "^11.1.0",
    "gray-matter": "^4.0.3",
    "mermaid": "^11.16.0",
    "ora": "^5.4.1",
    "pdf-lib": "^1.17.1",
    "picocolors": "^1.0.0",
    "playwright": "^1.40.0",
    "rehype-slug": "^6.0.0",
    "rehype-stringify": "^10.0.0",
    "remark-gfm": "^4.0.0",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.0.0",
    "shiki": "^4.3.0",
    "unified": "^11.0.4",
    "unist-util-visit": "^5.1.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "@types/hast": "^3.0.4",
    "@types/node": "^20.10.0",
    "eslint": "^9.0.0",
    "husky": "^8.0.3",
    "lint-staged": "^15.1.0",
    "prettier": "^3.1.0",
    "tsup": "^8.0.1",
    "typescript": "^5.3.2",
    "typescript-eslint": "^8.0.0",
    "vitest": "^0.34.6"
  },
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"]
  }
}
```

**Key changes vs v0.0.2:**
- `"postinstall": "node scripts/install-browser.mjs"` — auto-downloads Chromium on install
- `"files"` now includes `"scripts"` (install-browser.mjs must be shipped)
- `"repository"` is now shorthand `"amitdevx/md2pdf"` string (not an object)
- New runtime deps: `@shikijs/rehype`, `gray-matter`, `mermaid`, `pdf-lib`, `rehype-slug`, `shiki`, `unist-util-visit`
- New dev dep: `@types/hast` (for custom rehype plugins typed against hast AST)

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src", "tests"],
  "exclude": ["node_modules", "dist"]
}
```

### `tsconfig.build.json`
```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "tests"]
}
```

### `tsup.config.ts`
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['cjs', 'esm'],
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  outDir: 'dist',
});
```

### `vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
});
```

### `eslint.config.js`
```js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/*', 'node_modules/*'],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  }
);
```

### `prettier.config.js`
```js
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  printWidth: 100,
  tabWidth: 2
};
```

---

## 7. Dependency Graph

### Runtime Dependencies (v0.2.0)

```
@amitdevx/md2pdf
├── commander@^11.1.0          ← CLI argument parsing
├── ora@^5.4.1                  ← Terminal spinner
├── picocolors@^1.0.0           ← Terminal color output
├── playwright@^1.40.0          ← Headless Chromium: PDF + Mermaid rendering
├── unified@^11.0.4             ← Core processing pipeline
├── remark-parse@^11.0.0        ← Markdown → mdast
├── remark-gfm@^4.0.0           ← GitHub Flavored Markdown
├── remark-rehype@^11.0.0       ← mdast → hast bridge
├── rehype-slug@^6.0.0          ← Heading id attributes (for TOC links)
├── rehype-stringify@^10.0.0    ← hast → HTML string
├── @shikijs/rehype@^4.3.0      ← Syntax highlighting (rehype plugin)
├── shiki@^4.3.0                ← Shiki core (peer/runtime dep)
├── unist-util-visit@^5.1.0     ← AST traversal utility (for plugins)
├── gray-matter@^4.0.3          ← YAML frontmatter parsing
├── mermaid@^11.16.0            ← Diagram rendering (injected into Playwright page)
└── pdf-lib@^1.17.1             ← PDF metadata patching post-generation
```

### Dev Dependencies

```
├── typescript@^5.3.2
├── tsup@^8.0.1
├── vitest@^0.34.6
├── eslint@^9.0.0
├── @eslint/js@^9.0.0
├── typescript-eslint@^8.0.0
├── prettier@^3.1.0
├── husky@^8.0.3
├── lint-staged@^15.1.0
├── @types/node@^20.10.0
└── @types/hast@^3.0.4         ← TypeScript types for hast AST
```

### Data Flow (v0.2.0)

```
User input (.md)
     │
     ├─→ gray-matter ──→ frontmatter (YAML) + markdown (body)
     │
     ├─→ remark-parse ──→ mdast
     │        │
     │        ├─→ remark-gfm (GFM extensions)
     │        └─→ remark-rehype ──→ hast
     │                                │
     │                                ├─→ rehype-slug (adds heading IDs)
     │                                ├─→ rehypePageBreaks (page break divs)
     │                                ├─→ rehypeToc (optional TOC prepend)
     │                                ├─→ rehypeMermaidDetector
     │                                │      → fills mermaidBlocks[]
     │                                │      → replaces <pre> with <div id>
     │                                ├─→ rehypeExpandDetails (open attr)
     │                                ├─→ @shikijs/rehype (syntax highlighting)
     │                                └─→ rehype-stringify ──→ HTML string
     │
     ├─→ renderHtmlTemplate(html, title)
     │      → DOCTYPE + Google Fonts CDN links + baseCss + printCss
     │
     ├─→ playwright.chromium.launch() (shared browser)
     │        │
     │        ├─→ processBeforeRender()
     │        │      → renderMermaidBlocks() [separate browser page, HiDPI]
     │        │            → mermaid.render() per block in browser context
     │        │            → SVG with responsive sizing
     │        │      → inlineMermaidSvgs() → replaces placeholder divs
     │        │
     │        └─→ generatePdf()
     │               → page.setContent(processedHtml)
     │               → waitForLoadState('networkidle', 3s)
     │               → document.fonts.ready
     │               → page.pdf({ format, margin, header, footer })
     │               → PDF written to disk
     │
     └─→ injectMetadata(pdf-lib)
            → title, author, subject, keywords, creator, producer, date
            → returns pageCount
```

---

## 8. Build System

### Build Pipeline

```sh
npm run build
# Equivalent to:
# tsup && tsc -p tsconfig.build.json --emitDeclarationOnly
```

### Output Structure (v0.2.0)

```
dist/
├── index.js                  ← ESM library entry
├── index.cjs                 ← CJS library entry
├── index.d.ts                ← Type declarations (convert, ConvertOptions, ConvertResult, PdfMetadata)
├── index.js.map
├── cli/
│   ├── index.js              ← ESM CLI binary
│   ├── index.cjs
│   ├── index.d.ts
│   ├── doctor.js / .cjs / .d.ts
│   └── init.js / .cjs / .d.ts
├── core/index.d.ts
├── parser/index.d.ts
├── renderer/
│   ├── index.d.ts
│   └── pipeline.d.ts
├── pdf/
│   ├── index.d.ts
│   └── metadata.d.ts
├── assets/css.d.ts
├── plugins/
│   ├── toc.d.ts
│   ├── page-breaks.d.ts
│   └── mermaid/
│       ├── index.d.ts
│       ├── detector.d.ts
│       ├── renderer.d.ts
│       ├── inliner.d.ts
│       └── theme-map.d.ts
├── errors/
│   ├── index.d.ts
│   ├── detect.d.ts
│   └── recommendations.d.ts
└── types/index.d.ts
```

### All npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `postinstall` | `node scripts/install-browser.mjs` | Auto-download Chromium after npm install |
| `build` | `tsup && tsc -p tsconfig.build.json --emitDeclarationOnly` | Full production build |
| `dev` | `tsup --watch` | Development watch mode |
| `test` | `vitest run` | Run all tests once |
| `test:watch` | `vitest` | Watch-mode tests |
| `lint` | `eslint src/ tests/` | Lint check |
| `lint:fix` | `eslint src/ tests/ --fix` | Lint + auto-fix |
| `typecheck` | `tsc --noEmit` | Type check without emitting |
| `clean` | `rm -rf dist/` | Delete build output |
| `prepare` | `husky install \|\| true` | Install git hooks |
| `prepublishOnly` | `npm run clean && npm run build` | Clean build before publish |

---

## 9. CI/CD Pipelines

### CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:** push to `main`, pull request to `main`

**Matrix:** Node 18.x, 20.x on ubuntu-latest

**Steps:**
1. Checkout code
2. Setup Node.js with npm cache
3. `npm ci`
4. `npx playwright install --with-deps chromium`
5. `npm run typecheck`
6. `npm run lint`
7. `npm run test`
8. `npm run build`
9. Upload `dist/` artifact (Node 20.x only)

### Release Pipeline (`.github/workflows/release.yml`)

**Triggers:** GitHub Release published

**Steps:**
1. Checkout code
2. Setup Node.js 20.x with npm registry URL
3. `npm ci`
4. `npm run build`
5. `npm publish --access public` with `NPM_TOKEN` secret

---

## 10. Coding Standards & Conventions

### TypeScript
- Strict mode enabled (`"strict": true`)
- Target: ES2022, Module: ESNext, moduleResolution: Bundler
- All imports use `.js` extension (ESM convention, even for `.ts` source files)
- `@typescript-eslint/no-explicit-any` = `warn` (not yet error — becomes error at v0.9.0)

### Code Style (Prettier)
- Semicolons: **yes** | Quotes: **single** | Trailing commas: **ES5** | Print width: **100** | Tab: **2**

### Git Conventions
- Commit format: **Conventional Commits** (`feat:`, `fix:`, `docs:`, etc.)
- Pre-commit: `lint-staged` runs ESLint fix + Prettier on staged `.ts` files

### Code Philosophy
- No emojis in source code, comments, log messages, CLI output, or git commits
- Comments explain *why*, not *what*
- Functions under 100 lines with single responsibility
- Never silently ignore errors (only explicitly in Mermaid renderer fallback and PDF font timeout)

---

## 11. Public API Surface

### Current (v0.2.0)

```ts
// src/index.ts
export { convert } from './core/index.js';
export type { ConvertOptions, ConvertResult, PdfMetadata } from './types/index.js';
```

### Usage

```ts
import { convert } from '@amitdevx/md2pdf';

const result = await convert({
  input: 'README.md',
  output: 'README.pdf',
  toc: true,
  tocDepth: 3,
  paper: 'A4',
  margin: '20mm',
  header: true,
  footer: true,
  mermaid: { theme: 'default', timeout: 10000 },
  pageBreaks: { h1NewPage: false, hrAsPageBreak: false },
  metadata: {
    title: 'My Document',
    author: 'Amit Divekar',
    subject: 'Documentation',
    keywords: 'docs, pdf',
  },
});

console.log(result.outputPath);    // absolute path to generated PDF
console.log(result.pageCounts);    // number of pages
console.log(result.renderTimeMs);  // milliseconds
console.log(result.warnings);      // Shiki/unified warnings
console.log(result.metadata);      // PdfMetadata as applied
```

### CLI

```sh
# Basic
md2pdf input.md

# With options
md2pdf input.md -o output.pdf \
  --toc --toc-depth 3 \
  --header --footer \
  --paper A4 --margin 20mm \
  --mermaid-theme default \
  --h1-new-page \
  --theme github

# Subcommands
md2pdf doctor           # health check
md2pdf doctor --json    # machine-readable health check
md2pdf init             # guided Chromium install
```

### Frontmatter Support

These YAML frontmatter keys are recognized at the top of any `.md` file:

```yaml
---
title: My Document Title
author: Amit Divekar
subject: Technical Documentation
keywords: [api, reference, typescript]
date: 2026-07-02
theme: github
publish: false  # set to false to skip conversion (throws ERR_CONFIG_ERROR)
mermaid:
  theme: dark
  timeout: 15000
---
```

---

## 12. Type System

### All Current Types (v0.2.0)

```ts
// src/types/index.ts

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;      // comma-separated string
  creator?: string;       // defaults to "md2pdf <version>"
  producer?: string;      // defaults to "Playwright"
  creationDate?: Date;
}

export interface ConvertOptions {
  input: string;
  output: string;
  theme?: string;
  paper?: 'A4' | 'Letter' | 'Legal';
  margin?: string;
  toc?: boolean;
  tocDepth?: number;
  tocTitle?: string;
  metadata?: PdfMetadata;
  header?: boolean | { enabled?: boolean; template?: string };
  footer?: boolean | { enabled?: boolean; template?: string };
  pageBreaks?: {
    h1NewPage?: boolean;
    hrAsPageBreak?: boolean;
  };
  mermaid?: {
    theme?: 'default' | 'dark' | 'base' | 'neutral';
    timeout?: number;
  };
}

export interface ConvertResult {
  outputPath: string;
  pageCounts: number;
  renderTimeMs: number;
  warnings: string[];
  metadata?: PdfMetadata;
}
```

```ts
// src/pdf/index.ts (internal, not exported)
export interface PdfOptions {
  html: string;
  outputPath: string;
  format?: 'A4' | 'Letter' | 'Legal';
  margin?: string;
  marginTop?: string;
  marginBottom?: string;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  browser?: Browser;
}
```

```ts
// src/plugins/mermaid/detector.ts (internal)
export interface MermaidBlock {
  id: string;
  source: string;
  theme?: string;
  line?: number;
}
```

```ts
// src/errors/index.ts (internal, thrown)
export class Md2PdfError extends Error {
  code: Md2PdfErrorCode;
  title: string;
  reason: string;
  context: ErrorContext;
  originalError?: Error | unknown;
}
```

---

## 13. Current CSS / Theme System

### State (v0.2.0)

CSS is **extracted** from `src/renderer/index.ts` into `src/assets/css.ts` as two exported string constants:
- `baseCss` — typography, layout, tables, code, images, TOC, footnotes, task lists, details
- `printCss` — `@media print` overrides + page break classes

### CSS Variables (v0.2.0 — fully renamed)

All variables use `--md2pdf-*` prefix. Old `--text-main`, `--bg-main` etc. are gone.

```css
--md2pdf-font-family-body
--md2pdf-font-family-heading
--md2pdf-font-family-mono
--md2pdf-font-size
--md2pdf-line-height
--md2pdf-color-text
--md2pdf-color-heading
--md2pdf-color-link
--md2pdf-color-code-bg
--md2pdf-color-border
--md2pdf-color-blockquote-border
--md2pdf-code-border-radius
```

### CSS Coverage (v0.2.0)

| Element | Styled? | Notes |
|---------|---------|-------|
| Body typography | ✅ | Inter font, 11pt, 1.7 line height |
| Headings h1-h4 | ✅ | Modular scale (2.027/1.602/1.266/1em), h1/h2 borders |
| Paragraphs | ✅ | 16px bottom margin, widows/orphans: 2 |
| Links | ✅ | `#0066cc`, no underline, hover underline |
| Blockquotes | ✅ | Left border, italic, background tint |
| Code blocks | ✅ | Shiki-highlighted, page-break-inside: avoid |
| Inline code | ✅ | Background tint, border-radius |
| Tables | ✅ | Zebra striping, th background, page-break-inside: avoid |
| Images | ✅ | max-width: 100%, centered block, page-break-inside: avoid |
| Figures/captions | ✅ | Centered caption, font-size 85%, page-break avoidance |
| HR | ✅ | Thick line |
| Lists (ul/ol) | ✅ | 3-level bullet styles, 2em padding |
| Task lists | ✅ | No double-bullet, checkbox positioned absolute |
| TOC | ✅ | Nested `<ul>`, level-specific colors, bold L1 links |
| Footnotes | ✅ | 9pt, separator line, hidden `.sr-only` |
| Details/summary | ✅ | Bordered box, forced `open` attribute for PDF |
| Print CSS | ✅ | color-adjust, no box-shadow, code wrap, page-break classes |
| Mermaid containers | ✅ | Centered flex, margin 20px, page-break-inside: avoid |
| Obsidian callouts | ❌ | Not yet supported (v0.4.0) |
| Math/KaTeX | ❌ | Not yet supported (v0.3.0) |

---

## 14. Golden Document Testing Strategy

### What It Is
A set of permanent, curated Markdown fixtures covering every rendering concern. Every release renders them and compares against approved snapshots, failing CI on regressions.

### Current Fixtures in `tests/fixtures/`

| Fixture | Tests |
|---------|-------|
| `basic.md` | Headings, paragraphs, emphasis, links, blockquotes |
| `code-blocks.md` | Multiple languages, Shiki highlighting |
| `tables.md` | Wide tables, aligned columns |
| `images.md` | Local images, sizing |
| `nested-lists.md` | Deep nesting, task lists |
| `footnotes.md` | GFM footnote variants |
| `toc.md` | TOC generation and depth |
| `headers-footers.md` | Running headers/footers |
| `page-breaks.md` | `<!-- pagebreak -->`, `--hr-page-break` |
| `metadata.md` | YAML frontmatter metadata |
| `mermaid-flowchart.md` | Basic flowchart |
| `mermaid-sequence.md` | Sequence diagram |
| `mermaid-class.md` | Class diagram |
| `mermaid-er.md` | ER diagram |
| `mermaid-state.md` | State diagram |
| `mermaid-charts.md` | Pie / Gantt charts |
| `mermaid-mixed.md` | Multiple diagrams in one doc |
| `mermaid-narrative.md` | Mermaid in prose |
| `mermaid-errors.md` | Invalid Mermaid source (error fallback) |
| `long-document.md` | Pagination stress test |

### Future Fixtures (not yet created)

| Fixture | Added In |
|---------|----------|
| `math.md` | v0.3.0 |
| `obsidian.md` | v0.4.0 |
| `github-readme.md` | v0.6.0 |
| `academic.md` | v0.6.0 |
| `unicode.md` | v0.9.0 |
| `rtl.md` | v0.9.0 |

### Snapshot Storage
```
tests/snapshots/<fixture-name>/<theme>.pdf
tests/snapshots/<fixture-name>/<theme>.png
tests/output/    ← current render (gitignored)
tests/diff/      ← pixel-diff images (gitignored)
```

---

## 15. Full Development Roadmap

### Version Timeline

```
v0.0.1  ✅ Foundation — core pipeline, basic output
v0.0.2  ✅ Packaging & CI — npm publish, GitHub Actions

v0.1.0  ✅ Professional Rendering — Shiki highlighting, typography, print CSS
v0.1.1  ✅ TOC + Footnotes + PDF Metadata (gray-matter, pdf-lib, rehype-slug)
v0.1.2  ✅ Headers/Footers + Page Breaks (running header, footer, <!-- pagebreak -->)
v0.1.3  ✅ Headers/Footers polish + HTML escaping + dynamic version
v0.1.4  ✅ postinstall Chromium auto-download (scripts/install-browser.mjs)
v0.1.5  ✅ postinstall guard fix (npm_config_global check removed)
v0.1.6  ✅ CLI validation improvements (--paper, --margin, stdin, trailing slash, .md check)

v0.2.0  ✅ Mermaid — all diagram types, SVG HiDPI rendering, per-diagram theme,
              browser reuse, error fallback divs, mermaid-mixed, doctor + init subcommands

v0.2.1  📋 Mermaid improvements — edge cases, caching, background color fix

v0.3.0  📋 KaTeX — inline/display math, numbering, macros, chemistry

v0.4.0  📋 Obsidian Core — wiki links, callouts, YAML frontmatter extras, tags
v0.4.1  📋 Obsidian Embeds — ![[embeds]], transclusion, attachments

v0.5.0  📋 Configuration — md2pdf.config.ts, defineConfig, profiles, Zod validation
v0.6.0  📋 Themes — 7 built-in themes, custom CSS, CSS custom properties
v0.7.0  📋 Plugin Infrastructure — public API for 5 plugin types
v0.8.0  📋 Performance — caching, parallelism, browser reuse pool
v0.9.0  📋 Stabilization — API freeze, docs completion, test hardening
v0.9.x  📋 Bug fix patch releases
v1.0.0  📋 Stable release
```

### Per-Version Dependency Additions

| Version | New Dependencies |
|---------|-----------------|
| v0.1.0 | `shiki`, `@shikijs/rehype`, `rehype-slug`, `unist-util-visit` |
| v0.1.1 | `gray-matter`, `pdf-lib`, `@types/hast` |
| v0.2.0 | `mermaid` (injected into Playwright browser context at runtime) |
| v0.3.0 | `remark-math`, `rehype-katex`, `katex` |
| v0.5.0 | `jiti`, `js-yaml`, `zod` |
| v0.8.0 | `p-limit` |

---

## 16. Dependencies — What Each Does

### `unified@^11.0.4`
Core processing pipeline. Chains parsers, transformers, and compilers.

### `remark-parse@^11.0.0`
Parses Markdown text → `mdast` (Markdown AST). Handles headings, paragraphs, links, images, code, lists, blockquotes.

### `remark-gfm@^4.0.0`
GFM extensions: tables, task lists, strikethrough, autolinks, footnotes.

### `remark-rehype@^11.0.0`
Bridges `mdast` → `hast`. `allowDangerousHtml: true` passes raw HTML through.

### `rehype-slug@^6.0.0`
Adds stable `id` attributes to h1-h6 (e.g. `id="getting-started"`) so TOC anchor links work.

### `rehype-stringify@^10.0.0`
Serializes `hast` → HTML string.

### `@shikijs/rehype@^4.3.0` + `shiki@^4.3.0`
Server-side syntax highlighting. `github-light` theme. Non-fatal errors pushed to `warnings[]`.

### `unist-util-visit@^5.1.0`
AST traversal utility used by all custom rehype plugins (TOC, page-breaks, Mermaid detector, details expander).

### `gray-matter@^4.0.3`
Strips and parses YAML frontmatter from Markdown. Returns `{ data, content }`.

### `mermaid@^11.16.0`
Diagram rendering library. NOT bundled into the output — loaded at runtime inside a Playwright browser page via `require.resolve('mermaid/dist/mermaid.min.js')` + `page.addScriptTag`. Supports all diagram types: flowchart, sequence, class, ER, state, Gantt, pie, etc.

### `pdf-lib@^1.17.1`
Post-processes the written PDF to inject metadata (title, author, subject, keywords, creator, producer, creationDate). Also used to count pages.

### `playwright@^1.40.0`
Headless Chromium. Used for:
1. Mermaid rendering (`renderMermaidBlocks` — separate HiDPI page context)
2. PDF generation (`generatePdf` — `page.pdf()` via Chrome's print engine)
3. `md2pdf doctor` — validates browser health

### `commander@^11.1.0`
CLI framework. Parses args, defines options, registers subcommands.

### `ora@^5.4.1`
Terminal spinner. Suppressed in `--json-errors` mode.

### `picocolors@^1.0.0`
Zero-dependency terminal colors. Used for success/error/warning CLI output.

---

## 17. Future Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `remark-math` | v0.3.0 | Parses `$...$` and `$$...$$` math delimiters |
| `rehype-katex` | v0.3.0 | Converts math nodes to KaTeX HTML |
| `katex` | v0.3.0 | KaTeX rendering engine + fonts |
| `jiti` | v0.5.0 | Runtime TS config file loading |
| `js-yaml` | v0.5.0 | YAML config parsing |
| `zod` | v0.5.0 | Config schema validation |
| `p-limit` | v0.8.0 | Concurrency limiting for batch renders |

---

## 18. Directory Purpose Map

| Directory | Purpose | Shipped to npm? | Gitignored? |
|-----------|---------|-----------------|-------------|
| `src/` | TypeScript source | ❌ | ❌ |
| `dist/` | Compiled JS + `.d.ts` | ✅ | ✅ |
| `scripts/` | postinstall + dev scripts | ✅ | ❌ |
| `tests/` | Test suite | ❌ | ❌ |
| `tests/fixtures/` | Golden document `.md` sources | ❌ | ❌ |
| `tests/snapshots/` | Approved PDF/PNG snapshots | ❌ | ❌ |
| `tests/output/` | Current render output | ❌ | ✅ |
| `tests/diff/` | Pixel-diff failure images | ❌ | ✅ |
| `tests/benchmarks/` | Performance benchmarks | ❌ | ❌ |
| `docs/` | Documentation | ❌ | ❌ |
| `examples/` | Demo `.md` + `.pdf` files | ❌ | ❌ |
| `templates/` | HTML page templates | ❌ | ❌ |
| `phase/` | Internal dev planning | ❌ | ✅ |
| `.github/` | CI/CD workflows | ❌ | ❌ |
| `.husky/` | Git hooks | ❌ | ❌ |
| `node_modules/` | Dependencies | ❌ | ✅ |
| `.md2pdf-cache/` | Incremental render cache (v0.8.0) | ❌ | ✅ |

---

## 19. Gitignore Rules

```gitignore
node_modules/
dist/
coverage/
.vscode/
.idea/
*.log
.env
.env.*
.npm/
playwright-report/
test-results/
artifacts/
tmp/
.cache/
*.tgz

# Internal dev planning (not shipped)
/phase/

# Golden document render output
tests/output/
tests/diff/

# Incremental render cache (v0.8.0)
.md2pdf-cache/
```

---

## 20. npm Publish Rules

### What Gets Published

```json
"files": ["dist", "scripts", "README.md", "LICENSE", "CHANGELOG.md"]
```

**Important:** `scripts/` is now included because `install-browser.mjs` (the `postinstall` script) must be present when users run `npm install -g @amitdevx/md2pdf`.

### What Does NOT Get Published

`src/`, `tests/`, `docs/`, `examples/`, `templates/`, `phase/`, `brain.md`, `STRUCTURE.md`, config files, `.github/`, etc.

### Publish Flow

```sh
npm run prepublishOnly    # clean + build
npm publish --access public
```

Or via GitHub Release → `release.yml` runs automatically.

---

## 21. Key Design Decisions

### Why Playwright (not pdfkit, puppeteer, or wkhtmltopdf)?
- Chrome's native print engine handles any CSS — flexbox, grid, web fonts, `@page`, `@media print`
- Mermaid requires a real browser DOM for SVG `getBBox()` text measurement
- `page.pdf()` gives pixel-perfect output

### Why one shared browser instance for Mermaid + PDF?
- Launching Chromium is expensive (~500ms). Sharing one browser across Mermaid rendering and PDF generation saves one full launch per conversion.
- Browser is closed in a `finally` block in `core/index.ts` regardless of errors.

### Why unified/remark/rehype (not markdown-it)?
- AST-based: deep extensibility without regex hacks
- Plugin ecosystem: all v0.1-v0.5 features are rehype plugins
- Separate mdast/hast stages allow plugins at each layer

### Why mermaid is injected into browser context (not pre-rendered Node-side)?
- Mermaid depends on `getBBox()` for SVG text layout — only available in a real browser DOM
- JSDOM cannot handle it
- This is the same approach used by Mermaid's own CLI tool

### Why `postinstall` auto-downloads Chromium?
- `npm install -g @amitdevx/md2pdf` must be immediately usable
- Without auto-download, users get a confusing "Executable doesn't exist" error on first run
- `md2pdf doctor` provides a health check if auto-download fails

### Why `--json-errors` flag?
- CI/CD pipelines and scripting environments need machine-readable error output
- Structured `{ success, error: { code, title, reason, context } }` JSON allows automated handling

### Why golden documents (not just unit tests)?
- Unit tests verify parsing logic; they cannot catch "the table on page 12 is broken"
- Golden documents render the full pipeline end-to-end and pixel-diff against approved output

---

## 22. Research Findings Summary

### Prior Art (why md2pdf exists)

| Tool | Problem |
|------|---------|
| **Pandoc** | Heavy Haskell binary, LaTeX dependency, hard to integrate in Node.js |
| **Marp** | Opinionated for slides, not standard documents |
| **mdBook / VitePress** | Static sites, no granular PDF export |
| **wkhtmltopdf** | Deprecated WebKit, struggles with modern CSS |
| **pdfkit** | Manual text drawing, no CSS, impossible for complex layouts |
| **markdown-pdf** | Uses PhantomJS (dead) |

### Key Technical Findings

1. **Mermaid requires a real browser** — JSDOM can't do `getBBox()` SVG text measurement
2. **`page.pdf()` is the best PDF engine** — Chrome's native print is unmatched
3. **`unified` is the right parser** — AST-based, huge plugin ecosystem
4. **Obsidian extends GFM** — wiki links, callouts need custom remark plugins
5. **KaTeX > MathJax for PDF** — synchronous rendering, smaller output
6. **Google Fonts CDN fails gracefully** — 3s timeout, `domcontentloaded` fast path

---

## 23. Known Limitations (v0.2.4)

| Issue | Impact | Fixed In |
|-------|--------|----------|
| No math support | LaTeX renders as raw text | v0.3.0 |
| No Obsidian syntax | Wiki links, callouts ignored | v0.4.0 |
| No themes | Single hardcoded style | v0.6.0 |
| No config file | Options only via CLI flags | v0.5.0 |
| No watch mode | Must manually re-run | v0.6.0 CLI |
| No directory input | Single file only | v0.6.0 CLI |
| Google Fonts CDN dependency | Offline/air-gapped fails gracefully but uses fallback fonts | v0.6.0 (local bundle) |
| Mermaid `background` color not inherited | Diagrams may have white bg on dark themes | v0.2.1 |
| No Mermaid caching | Each run re-renders all diagrams | v0.2.1 |
| Browser launched per `convert()` call | No reuse across multiple CLI invocations | v0.8.0 |
| `--json-errors` does not output success JSON | Only errors are JSON; success is silent | v0.5.0+ |

---

## 24. Quick Reference for Common Tasks

### "I need to add a new remark plugin"
1. `npm install remark-<name>`
2. Edit `src/parser/index.ts`
3. Add `.use(remarkPlugin)` after `remarkGfm`, before `remarkRehype`

### "I need to add a new rehype plugin"
1. `npm install rehype-<name>`
2. Edit `src/parser/index.ts`
3. Add `.use(rehypePlugin)` after `remarkRehype`, before `rehypeShiki` or `rehypeStringify`
4. Plugin order matters — see plugin chain in section 4

### "I need to change the CSS"
1. Edit `src/assets/css.ts`
2. Modify `baseCss` for layout/typography, `printCss` for `@media print` rules
3. CSS variables all use `--md2pdf-*` prefix

### "I need to change PDF output settings"
1. Edit `src/pdf/index.ts` → modify `page.pdf({ ... })` options
2. Or edit `src/core/index.ts` to pass new options through `generatePdf()`

### "I need to add a new CLI flag"
1. Edit `src/cli/index.ts`
2. Add `.option(...)` to the Commander chain
3. Add it to the `CliOptions` interface
4. Pass through to `ConvertOptions` in the `convert()` call

### "I need to add a CLI subcommand"
1. Create `src/cli/<name>.ts` exporting `export default new Command('<name>')`
2. Import in `src/cli/index.ts` and call `program.addCommand(<nameCmd>)`

### "I need to add a new error code"
1. Add to `Md2PdfErrorCode` enum in `src/errors/index.ts`
2. Add detection pattern to `src/errors/detect.ts`
3. Add recommendation to `src/errors/recommendations.ts`

### "I need to run the project locally"
```sh
git clone https://github.com/amitdevx/md2pdf.git
cd md2pdf
npm install
# Chromium auto-downloads via postinstall. If it fails:
npx playwright install chromium
npm run build
npm test

# Test a conversion:
node dist/cli/index.js examples/basic.md -o test.pdf

# Test Mermaid:
node dist/cli/index.js tests/fixtures/mermaid-mixed.md -o test-mermaid.pdf

# Health check:
node dist/cli/index.js doctor
```

### "I need to publish a new version"
```sh
# 1. Update version in package.json
# 2. Update CHANGELOG.md
# 3. Commit and push
# 4. Create a GitHub Release
# 5. release.yml workflow publishes to npm automatically
# NEVER bump version or push tags without explicit user request (see Section 25)
```

### "I need to understand the full pipeline for a single conversion"

```
User: md2pdf README.md --toc --mermaid-theme dark -o out.pdf

1.  CLI validates: file exists, is .md, not a directory, not stdin
2.  CLI builds ConvertOptions and calls convert()
3.  convert() reads README.md → rawMarkdown
4.  gray-matter: strips YAML frontmatter → { frontmatter, markdown }
5.  Checks publish: false guard (throws ERR_CONFIG_ERROR if set)
6.  Regex: relative ![alt](./img.png) → absolute file:///abs/path/img.png
7.  parseMarkdown(processedMarkdown, { toc: true, mermaidBlocks: [] })
    a. remarkParse: Markdown → mdast
    b. remarkGfm: GFM extensions
    c. remarkRehype: mdast → hast
    d. rehypeSlug: adds id="..." to headings
    e. rehypePageBreaks: processes <!-- pagebreak -->, h1, hr options
    f. rehypeToc: builds and prepends TOC section
    g. rehypeMermaidDetector: extracts mermaid code blocks, fills mermaidBlocks[]
    h. rehypeExpandDetails: adds `open` to all <details>
    i. rehypeShiki: highlights code blocks with github-light theme
    j. rehypeStringify: hast → HTML string
    → returns { html, warnings }
8.  renderHtmlTemplate(html, "README"):
    - Adds DOCTYPE, <html>, <head>, Google Fonts CDN links
    - Injects baseCss + printCss from src/assets/css.ts
    - Wraps in <div class="markdown-body">
9.  chromium.launch() → browser
10. processBeforeRender(html, browser, mermaidBlocks, { globalMermaidTheme: 'dark' })
    - renderMermaidBlocks(browser, blocks, 'default', 'dark', 10000)
      For each mermaid block:
        - browser.newContext({ deviceScaleFactor: 2 }) → page
        - page.addScriptTag(mermaid.min.js path)
        - page.evaluate(): mermaid.initialize({ startOnLoad: false, theme: 'dark' })
        - page.evaluate(): mermaid.render(id, source) → { svg }
        - Process SVG: strip width/style, apply responsive max-width
        → RenderedMermaid[]
    - inlineMermaidSvgs(html, renderedSvgs)
        Replaces <div id="mermaid-placeholder-N"></div> with centered SVG
    → processedHtml
11. generatePdf({ html: processedHtml, outputPath, browser, format: 'A4', margin: '20mm' })
    - browser.newContext() → page
    - page.setContent(processedHtml, { waitUntil: 'domcontentloaded' })
    - page.waitForLoadState('networkidle', { timeout: 3000 }) [soft-fail]
    - await document.fonts.ready
    - page.pdf({ path, format: 'A4', margin: 20mm, printBackground: true })
    → PDF written to out.pdf
12. browser.close()
13. injectMetadata(out.pdf, metadata)
    - pdf-lib: load PDF bytes
    - Set title, author, subject, keywords, creator: "md2pdf 0.2.0", producer: "Playwright"
    - Save modified PDF back
    → returns pageCount
14. convert() returns:
    { outputPath, pageCounts, renderTimeMs, warnings, metadata }
15. CLI spinner.succeed("Successfully generated /abs/path/out.pdf in 3421ms")
```

---

> **End of brain.md**
>
> This file is the single source of truth for any AI agent working on `@amitdevx/md2pdf`.
> It reflects the exact state of the codebase at v0.2.2, with all known audit bugs fully resolved.
> No re-analysis of other files is needed.

---

## 25. Post-Mortems & Lessons Learned

### The v0.1.1 / v0.1.2 Version Control Incident

**What happened:**
During the release of v0.1.1, the git tag `v0.1.1` was created and pushed *before* all final documentation and minor CSS bug fixes were committed. The CI/CD pipeline published the buggy and incomplete version to npm. An attempt was made to forcefully bump to `v0.1.2` without explicit user consent, violating the user's release cadence.

**Root Cause:**
- Premature tagging before the commit history was finalized and reviewed.
- Automated tools executing `npm version patch` and pushing tags directly without waiting for human review.

**Strict Rules Moving Forward:**
1. **NEVER tag a commit or bump versions** (`npm version`) unless explicitly and unambiguously requested by the user.
2. **NEVER push to remote** (`git push`) unless explicitly and unambiguously requested.
3. **Commit step-by-step**: Changes must be committed incrementally in logically grouped commits, left in the local repository for the user to review, tag, and push.
4. **Immutability of npm**: Never assume an npm version can be overwritten. Once published, a version is permanent. Reverting `package.json` versions after a tag publish causes CI failures (`403 Forbidden`).

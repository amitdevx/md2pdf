# brain.md — Complete Knowledge Base for `@amitdevx/md2pdf`

> **Purpose:** This file contains *every detail* about the md2pdf npm package.
> Any AI agent reading this file should be able to understand, modify, build, test,
> and extend the project without reading any other file.
>
> **Last updated:** 2026-06-27 (v0.0.2)

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
23. [Known Limitations (v0.0.2)](#23-known-limitations-v002)
24. [Quick Reference for Common Tasks](#24-quick-reference-for-common-tasks)

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Package name** | `@amitdevx/md2pdf` |
| **Version** | `0.0.2` |
| **Description** | Production-quality Markdown to PDF rendering engine |
| **Author** | Amit Divekar |
| **License** | MIT |
| **Repository** | `https://github.com/amitdevx/md2pdf.git` |
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

---

## 2. Architecture & Pipeline

### Core Pipeline (current v0.0.2)

```
Input .md file
      │
      ▼
┌──────────────────────────────────┐
│  src/core/index.ts  (convert())  │  ← reads file, resolves relative image paths
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  src/parser/index.ts             │  ← unified()
│  remark-parse                    │     .use(remarkParse)
│  → remark-gfm                   │     .use(remarkGfm)
│  → remark-rehype                │     .use(remarkRehype, { allowDangerousHtml: true })
│  → rehype-stringify              │     .use(rehypeStringify, { allowDangerousHtml: true })
│  → HTML string                  │     .process(markdown)
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  src/renderer/index.ts           │  ← wraps HTML in full page template
│  renderHtmlTemplate(html, title) │     injects CSS variables, typography, print styles
│  → complete HTML document        │     wraps content in <div class="markdown-body">
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  src/pdf/index.ts                │  ← chromium.launch()
│  generatePdf({ html, output })   │     page.setContent(html, { waitUntil: 'networkidle' })
│  → Playwright page.pdf()        │     await document.fonts.ready
│  → writes .pdf file to disk     │     page.pdf({ format: 'A4', printBackground: true })
└──────────────────────────────────┘
```

### CLI Pipeline

```
User runs: md2pdf input.md -o output.pdf
      │
      ▼
src/cli/index.ts
  ├── Validates input file exists
  ├── Defaults output to input.replace('.md', '.pdf')
  ├── Shows ora spinner
  └── Calls convert({ input, output })
        │
        └── (same pipeline as above)
```

### Internal Plugin Pipeline (designed in v0.1.0, not yet implemented)

```
Input Markdown
      │
      ▼
[Markdown Plugins]   ← remark plugins array (extendable)
      │
      ▼
  Markdown AST (mdast)
      │
      ▼
 remark → rehype
      │
      ▼
[HTML Plugins]       ← rehype plugins array (extendable)
      │
      ▼
  HTML String
      │
      ▼
[Render Hooks]       ← beforeRender / afterPageLoad / afterPdf
      │
      ▼
  PDF Buffer
```

---

## 3. Full File Tree

Every file in the repo (excluding `node_modules/`, `.git/`, `dist/`):

```
md2pdf/
├── brain.md                          ← THIS FILE — complete project knowledge base
├── STRUCTURE.md                      ← Concise directory map for quick orientation
├── README.md                         ← Public npm/GitHub README
├── CHANGELOG.md                      ← Version history
├── LICENSE                           ← MIT
├── package.json                      ← npm metadata, scripts, deps
├── package-lock.json                 ← Exact dependency tree
├── tsconfig.json                     ← TypeScript config (dev)
├── tsconfig.build.json               ← TypeScript config (declarations only)
├── tsup.config.ts                    ← Build config (tsup → dist/)
├── vitest.config.ts                  ← Test runner config
├── eslint.config.js                  ← Linting rules (flat config)
├── prettier.config.js                ← Code formatting rules
├── .gitignore                        ← Git exclusions
│
├── src/                              ← TypeScript source code
│   ├── README.md                     ← Module map and pipeline docs
│   ├── index.ts                      ← Public API entry point
│   ├── core/
│   │   └── index.ts                  ← convert() implementation
│   ├── cli/
│   │   └── index.ts                  ← CLI binary (bin: md2pdf)
│   ├── parser/
│   │   └── index.ts                  ← Markdown → HTML parsing
│   ├── renderer/
│   │   └── index.ts                  ← HTML template assembly (155 lines of CSS + template)
│   ├── pdf/
│   │   └── index.ts                  ← Playwright PDF generation
│   ├── types/
│   │   └── index.ts                  ← ConvertOptions interface
│   ├── plugins/                      ← Plugin directories (empty, scaffolded for future)
│   │   ├── markdown/
│   │   ├── html/
│   │   ├── obsidian/
│   │   └── renderer/
│   ├── themes/                       ← Theme directories (empty, scaffolded for future)
│   │   ├── default/
│   │   ├── github/
│   │   ├── obsidian-light/
│   │   └── obsidian-dark/
│   ├── config/                       ← Config loading (empty, scaffolded for v0.5.0)
│   ├── commands/                     ← CLI subcommands (empty, scaffolded)
│   ├── assets/                       ← Static CSS files (empty, scaffolded for v0.1.0)
│   ├── constants/                    ← Shared constants (empty, scaffolded)
│   └── utils/                        ← Utility functions (empty, scaffolded)
│
├── tests/                            ← Test suite
│   ├── README.md                     ← Test directory guide
│   ├── parser/
│   │   └── index.test.ts             ← 3 unit tests for parser
│   ├── renderer/
│   │   └── index.test.ts             ← 1 unit test for renderer
│   ├── pdf/
│   │   └── index.test.ts             ← 1 integration test for PDF generation
│   ├── cli/                          ← E2E CLI tests (empty, scaffolded)
│   ├── fixtures/
│   │   └── README.md                 ← Golden document inventory
│   ├── snapshots/
│   │   └── README.md                 ← Approved snapshot guide
│   ├── benchmarks/
│   │   └── README.md                 ← Performance benchmark spec
│   ├── output/                       ← Rendered golden doc output (GITIGNORED)
│   │   └── .gitkeep
│   └── diff/                         ← Pixel-diff images (GITIGNORED)
│       └── .gitkeep
│
├── docs/                             ← Documentation
│   ├── README.md                     ← Documentation index
│   ├── 00-research-initial.md        ← Original research & architecture doc
│   ├── 01-research.md                ← Deep prior-art analysis
│   ├── 02-architecture.md            ← Technical architecture spec
│   ├── 03-strategy.md                ← Testing & release strategy
│   └── contributing.md               ← Contribution guidelines
│
├── examples/                         ← Demo files
│   ├── README.md                     ← Example index
│   ├── basic.md                      ← Demo Markdown document
│   └── basic.pdf                     ← Demo rendered output
│
├── scripts/                          ← Developer utility scripts
│   └── README.md                     ← Script index
│
├── templates/                        ← HTML page templates
│   └── README.md                     ← Template docs
│
├── phase/                            ← Internal dev planning (GITIGNORED)
│   ├── README.md                     ← Roadmap index
│   ├── GOLDEN-DOCUMENTS.md           ← Golden document strategy
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
│       ├── ci.yml                    ← CI: lint, typecheck, test, build
│       └── release.yml               ← Release: build + npm publish
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
export type { ConvertOptions } from './types/index.js';
```

### `src/types/index.ts` — Type definitions
```ts
export interface ConvertOptions {
  input: string;
  output: string;
  theme?: string;
}
```

### `src/core/index.ts` — convert() implementation
```ts
import { parseMarkdown } from '../parser/index.js';
import { renderHtmlTemplate } from '../renderer/index.js';
import { generatePdf } from '../pdf/index.js';
import { ConvertOptions } from '../types/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function convert(options: ConvertOptions): Promise<void> {
  const { input, output } = options;

  // 1. Read Markdown
  const inputPath = path.resolve(process.cwd(), input);
  const markdown = await fs.readFile(inputPath, 'utf-8');

  // 2. Parse to HTML (fix relative image paths to absolute for Playwright)
  const dir = path.dirname(inputPath);
  const processedMarkdown = markdown.replace(/!\[([^\]]*)\]\((?!http|data:)([^)]+)\)/g, (match, alt, src) => {
    const absPath = path.resolve(dir, src);
    return `![${alt}](file://${absPath})`;
  });

  const contentHtml = await parseMarkdown(processedMarkdown);

  // 3. Render HTML with Theme
  const title = path.basename(input, path.extname(input));
  const html = renderHtmlTemplate(contentHtml, title);

  // 4. Generate PDF
  const outputPath = path.resolve(process.cwd(), output);
  await generatePdf({ html, outputPath });
}
```

**Important implementation detail:** Relative image paths like `![alt](./img.png)` are converted
to absolute `file://` URLs so Playwright can load them. This regex skips `http://` and `data:` URLs.

### `src/parser/index.ts` — Markdown → HTML
```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

export async function parseMarkdown(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return String(file);
}
```

**Key note:** `allowDangerousHtml: true` is set on both `remark-rehype` and `rehype-stringify`
so that raw HTML in Markdown (like `<details>`, `<mark>`, `<kbd>`) passes through untouched.

### `src/cli/index.ts` — CLI binary
```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { convert } from '../core/index.js';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';

const program = new Command();

program
  .name('md2pdf')
  .description('Production-quality Markdown to PDF rendering engine')
  .version('0.0.1')
  .argument('<input>', 'Input markdown file')
  .option('-o, --output <output>', 'Output PDF file')
  .action(async (input: string, options: { output?: string }) => {
    if (!fs.existsSync(input)) {
      console.error(pc.red(`Error: Input file '${input}' does not exist.`));
      process.exit(1);
    }

    const output = options.output || input.replace(/\.md$/i, '.pdf');
    const spinner = ora('Converting markdown to PDF...').start();

    try {
      await convert({ input, output });
      spinner.succeed(pc.green(`Successfully generated ${output}`));
    } catch (error) {
      spinner.fail(pc.red('Failed to generate PDF'));
      console.error(error);
      process.exit(1);
    }
  });

program.parse(process.argv);
```

**Note:** CLI version is hardcoded as `0.0.1` — should be updated to read from package.json.

### `src/pdf/index.ts` — Playwright PDF generation
```ts
import { chromium } from 'playwright';

export interface PdfOptions {
  html: string;
  outputPath: string;
  format?: 'A4' | 'Letter' | 'Legal';
}

export async function generatePdf(options: PdfOptions): Promise<void> {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set the HTML content
    await page.setContent(options.html, { waitUntil: 'networkidle' });

    // Ensure all web fonts are loaded
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // Generate PDF
    await page.pdf({
      path: options.outputPath,
      format: options.format || 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
      displayHeaderFooter: false,
    });
  } finally {
    await browser.close();
  }
}
```

**Critical notes:**
- `--no-sandbox` and `--disable-setuid-sandbox` are required for Docker/CI environments
- `waitUntil: 'networkidle'` ensures all resources (images, fonts) are loaded
- `document.fonts.ready` explicitly waits for web font loading
- Browser is **always closed** in the `finally` block (leak prevention)
- Default margins are 20mm all sides
- `displayHeaderFooter: false` — headers/footers not yet implemented

### `src/renderer/index.ts` — HTML template (155 lines, inline CSS)
```ts
export function renderHtmlTemplate(contentHtml: string, title: string = 'Document'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    /* Professional Typography and Print Defaults */
    :root {
      --text-main: #333;
      --text-muted: #666;
      --bg-main: #fff;
      --border-color: #ddd;
      --link-color: #0366d6;
      --code-bg: #f6f8fa;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-main);
      background-color: var(--bg-main);
      margin: 0;
      padding: 0;
      word-wrap: break-word;
    }

    .markdown-body {
      padding: 2em;
      max-width: 900px;
      margin: 0 auto;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
      color: #111;
      page-break-after: avoid;
    }

    h1 { font-size: 2.25em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    h2 { font-size: 1.75em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    h3 { font-size: 1.5em; }

    p, blockquote, ul, ol, dl, table, pre {
      margin-top: 0;
      margin-bottom: 16px;
    }

    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }

    blockquote {
      padding: 0 1em;
      color: var(--text-muted);
      border-left: 0.25em solid var(--border-color);
    }

    code, kbd, pre {
      font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
      font-size: 85%;
    }

    pre {
      padding: 16px;
      overflow: auto;
      line-height: 1.45;
      background-color: var(--code-bg);
      border-radius: 6px;
      page-break-inside: avoid;
    }

    pre code { padding: 0; margin: 0; background-color: transparent; border: 0; }

    code {
      padding: 0.2em 0.4em;
      margin: 0;
      background-color: var(--code-bg);
      border-radius: 6px;
    }

    table {
      border-spacing: 0;
      border-collapse: collapse;
      width: 100%;
      page-break-inside: avoid;
    }

    table th, table td {
      padding: 6px 13px;
      border: 1px solid var(--border-color);
    }

    table tr {
      background-color: var(--bg-main);
      border-top: 1px solid var(--border-color);
      page-break-inside: avoid;
    }

    table tr:nth-child(2n) { background-color: #f8f9fa; }

    img {
      max-width: 100%;
      height: auto;
      box-sizing: content-box;
      page-break-inside: avoid;
    }

    hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: var(--border-color);
      border: 0;
    }

    /* Print specific adjustments */
    @media print {
      body { font-size: 11pt; }
      .markdown-body { padding: 0; max-width: none; }
      a { text-decoration: none; color: #000; }
    }
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

**CSS notes for v0.1.0 changes:**
- CSS variables are currently named `--text-main`, `--bg-main`, etc.
- They will be renamed to `--md2pdf-color-text`, `--md2pdf-color-bg`, etc. in v0.1.0
- The inline CSS will be extracted to `src/assets/base.css` and `src/assets/print.css`
- `max-width: 900px` will be removed (PDF uses full page width with margins)
- Font stack will be upgraded to Inter + JetBrains Mono

---

## 5. Every Test File — Complete Code

### `tests/parser/index.test.ts` — Parser unit tests
```ts
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/parser/index.js';

describe('Markdown Parser', () => {
  it('should parse basic markdown into html', async () => {
    const markdown = '# Hello World\nThis is a test.';
    const html = await parseMarkdown(markdown);

    expect(html).toContain('<h1');
    expect(html).toContain('Hello World</h1>');
    expect(html).toContain('<p>This is a test.</p>');
  });

  it('should parse tables', async () => {
    const markdown = '| Col 1 | Col 2 |\n|---|---|\n| A | B |';
    const html = await parseMarkdown(markdown);

    expect(html).toContain('<table>');
    expect(html).toContain('<th>Col 1</th>');
    expect(html).toContain('<td>A</td>');
  });

  it('should format code blocks correctly', async () => {
    const markdown = '```javascript\nconst a = 1;\n```';
    const html = await parseMarkdown(markdown);

    expect(html).toContain('<pre><code class="language-javascript">const a = 1;\n</code></pre>');
  });
});
```

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
    expect(html).toContain('--bg-main: #fff;');
    expect(html).toContain('<div class="markdown-body">');
    expect(html).toContain('<p>Hello</p>');
  });
});
```

### `tests/pdf/index.test.ts` — PDF integration test
```ts
import { describe, it, expect, afterAll } from 'vitest';
import { generatePdf } from '../../src/pdf/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('PDF Engine', () => {
  const outputPath = path.resolve(__dirname, 'test-output.pdf');

  afterAll(async () => {
    try {
      await fs.unlink(outputPath);
    } catch {
      // ignore
    }
  });

  it('should generate a PDF file from HTML', async () => {
    const html = '<html><body><h1>Hello PDF</h1></body></html>';

    await generatePdf({ html, outputPath });

    const stat = await fs.stat(outputPath);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBeGreaterThan(0);
  }, 30000); // Allow 30 seconds for Playwright to launch
});
```

**Note:** The PDF test has a 30-second timeout because Playwright browser launch is slow on first run.

---

## 6. Every Config File — Complete Contents

### `package.json`
```json
{
  "name": "@amitdevx/md2pdf",
  "version": "0.0.2",
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
  "files": ["dist", "README.md", "LICENSE", "CHANGELOG.md"],
  "engines": { "node": ">=18" },
  "sideEffects": false,
  "publishConfig": { "access": "public" },
  "scripts": {
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
  "repository": { "type": "git", "url": "git+https://github.com/amitdevx/md2pdf.git" },
  "homepage": "https://github.com/amitdevx/md2pdf#readme",
  "bugs": { "url": "https://github.com/amitdevx/md2pdf/issues" },
  "keywords": ["markdown", "pdf", "generator", "playwright", "unified", "remark", "rehype"],
  "author": "Amit Divekar",
  "license": "MIT",
  "dependencies": {
    "commander": "^11.1.0",
    "ora": "^5.4.1",
    "picocolors": "^1.0.0",
    "playwright": "^1.40.0",
    "rehype-stringify": "^10.0.0",
    "remark-gfm": "^4.0.0",
    "remark-parse": "^11.0.0",
    "remark-rehype": "^11.0.0",
    "unified": "^11.0.4"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
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

**Purpose:** `npm run build` uses `tsup` for JS output, then `tsc -p tsconfig.build.json --emitDeclarationOnly` for `.d.ts` files. Tests are excluded from declaration emit.

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

**Important:** Two entry points — `src/index.ts` (library API) and `src/cli/index.ts` (binary).
`dts: false` because TypeScript declarations are generated separately by `tsc`.
`splitting: false` to keep output simple (no code-splitting chunks).

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

### Runtime Dependencies (shipped with package)

```
@amitdevx/md2pdf
├── commander@^11.1.0        ← CLI argument parsing
├── ora@^5.4.1                ← Terminal spinner (CLI UX)
├── picocolors@^1.0.0         ← Terminal color output
├── playwright@^1.40.0        ← Headless Chromium for PDF rendering
├── unified@^11.0.4           ← Core processing pipeline
├── remark-parse@^11.0.0      ← Markdown → AST (mdast)
├── remark-gfm@^4.0.0         ← GitHub Flavored Markdown extension
├── remark-rehype@^11.0.0     ← mdast → hast (HTML AST) bridge
└── rehype-stringify@^10.0.0  ← hast → HTML string
```

### Dev Dependencies (development only)

```
├── typescript@^5.3.2         ← TypeScript compiler
├── tsup@^8.0.1               ← Bundler (src/ → dist/)
├── vitest@^0.34.6            ← Test runner
├── eslint@^9.0.0             ← Linter
├── @eslint/js@^9.0.0         ← ESLint recommended rules
├── typescript-eslint@^8.0.0  ← TypeScript ESLint plugin
├── prettier@^3.1.0           ← Code formatter
├── husky@^8.0.3              ← Git hooks
├── lint-staged@^15.1.0       ← Pre-commit lint
└── @types/node@^20.10.0      ← Node.js type definitions
```

### Data Flow Between Dependencies

```
User input (.md)
     │
     ├─→ remark-parse ──→ mdast (Markdown AST)
     │                        │
     │                        ├─→ remark-gfm (adds tables, strikethrough, etc.)
     │                        │
     │                        └─→ remark-rehype ──→ hast (HTML AST)
     │                                                │
     │                                                └─→ rehype-stringify ──→ HTML string
     │
     └─→ (HTML string is injected into template via renderHtmlTemplate)
              │
              └─→ playwright (chromium.launch → page.setContent → page.pdf)
                       │
                       └─→ PDF file on disk
```

---

## 8. Build System

### Build Pipeline

```sh
npm run build
# Equivalent to:
# tsup && tsc -p tsconfig.build.json --emitDeclarationOnly
```

**Step 1 — tsup:**
- Reads `tsup.config.ts`
- Bundles `src/index.ts` → `dist/index.js` (ESM) + `dist/index.cjs` (CJS)
- Bundles `src/cli/index.ts` → `dist/cli/index.js` (ESM) + `dist/cli/index.cjs` (CJS)
- Generates source maps
- Tree-shakes unused code
- Cleans `dist/` before writing

**Step 2 — tsc:**
- Reads `tsconfig.build.json` (extends `tsconfig.json`, excludes tests)
- Emits only `.d.ts` declaration files
- Output: `dist/index.d.ts`, `dist/cli/index.d.ts`, etc.

### Output Structure

```
dist/
├── index.js                ← ESM library entry
├── index.cjs               ← CJS library entry
├── index.d.ts              ← Type declarations
├── index.js.map            ← Source map
├── cli/
│   ├── index.js            ← ESM CLI binary
│   ├── index.cjs           ← CJS CLI binary
│   ├── index.d.ts
│   └── index.js.map
├── core/
│   ├── index.d.ts
│   └── ...
├── parser/
│   ├── index.d.ts
│   └── ...
├── renderer/
│   ├── index.d.ts
│   └── ...
├── pdf/
│   ├── index.d.ts
│   └── ...
└── types/
    ├── index.d.ts
    └── ...
```

### All npm Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `tsup && tsc -p tsconfig.build.json --emitDeclarationOnly` | Full production build |
| `dev` | `tsup --watch` | Development watch mode |
| `test` | `vitest run` | Run all tests once |
| `test:watch` | `vitest` | Watch-mode tests |
| `lint` | `eslint src/ tests/` | Lint check |
| `lint:fix` | `eslint src/ tests/ --fix` | Lint + auto-fix |
| `typecheck` | `tsc --noEmit` | Type check without emitting |
| `clean` | `rm -rf dist/` | Delete build output |
| `prepare` | `husky install \|\| true` | Install git hooks (post npm install) |
| `prepublishOnly` | `npm run clean && npm run build` | Clean build before publish |

### Future Scripts (to be added)

| Script | Command | Added In |
|--------|---------|----------|
| `golden:render` | `tsx scripts/golden-render.ts` | v0.1.0 |
| `golden:diff` | `tsx scripts/golden-diff.ts` | v0.1.0 |
| `golden:approve` | `tsx scripts/golden-approve.ts` | v0.1.0 |
| `golden:check` | `tsx scripts/golden-render.ts && tsx scripts/golden-diff.ts --ci` | v0.1.0 |
| `bench` | `tsx scripts/bench.ts` | v0.8.0 |

---

## 9. CI/CD Pipelines

### CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:** push to `main`, pull request to `main`

**Matrix:** Node 18.x, 20.x on ubuntu-latest

**Steps:**
1. Checkout code
2. Setup Node.js with npm cache
3. `npm ci` — install exact deps
4. `npx playwright install --with-deps chromium` — install browser
5. `npm run typecheck` — TypeScript check
6. `npm run lint` — ESLint check
7. `npm run test` — Vitest run
8. `npm run build` — tsup + tsc
9. Upload `dist/` as artifact (Node 20.x only)

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
- Target: ES2022
- Module: ESNext with Bundler resolution
- All imports use `.js` extension (ESM convention, even for `.ts` files)
- No `any` types (warning, not error — will become error for public API at v0.9.0)

### Code Style (Prettier)
- Semicolons: **yes**
- Quotes: **single** (`'`)
- Trailing commas: **ES5** (`es5`)
- Print width: **100**
- Tab width: **2**

### ESLint
- Base: `eslint.configs.recommended` + `typescript-eslint.configs.recommended`
- Custom: `@typescript-eslint/no-explicit-any` = `warn`
- Ignores: `dist/*`, `node_modules/*`

### Git Conventions
- Commit format: **Conventional Commits** (`feat:`, `fix:`, `docs:`, etc.)
- Branch naming: `feature/add-mermaid-support`, `fix/image-resolution`, etc.
- Pre-commit hook: `lint-staged` runs ESLint fix + Prettier on staged `.ts` files

### Code Philosophy
- No emojis in source code, comments, log messages, CLI output, or git commits
- Comments explain *why*, not *what*
- Functions under 100 lines with single responsibility
- Never silently ignore errors

---

## 11. Public API Surface

### Current (v0.0.2)

```ts
// Everything exported from src/index.ts:
export { convert } from './core/index.js';
export type { ConvertOptions } from './types/index.js';
```

### Usage

```ts
import { convert } from '@amitdevx/md2pdf';

await convert({
  input: 'README.md',     // required: path to .md file
  output: 'README.pdf',   // required: path to output .pdf
  theme: 'default',       // optional: theme name (not yet implemented)
});
```

### CLI

```sh
md2pdf <input>             # converts input.md → input.pdf
md2pdf <input> -o out.pdf  # custom output path
```

### Future Exports (planned)

```ts
// v0.1.0+
export { convert } from './core/index.js';
export { defineConfig } from './config/index.js';
export type { ConvertOptions, ConvertResult } from './types/index.js';
export type { Md2PdfConfig } from './types/config.js';
export type { Theme } from './types/theme.js';

// v0.7.0+ (plugin API)
export type {
  MarkdownPlugin, HtmlPlugin, RenderPlugin,
  ThemePlugin, ExportPlugin, AnyPlugin,
  RenderContext
} from './types/plugin.js';
```

---

## 12. Type System

### Current Types

```ts
// src/types/index.ts
export interface ConvertOptions {
  input: string;   // path to Markdown file
  output: string;  // path to output PDF
  theme?: string;  // theme name (not yet used)
}

// src/pdf/index.ts (not exported)
export interface PdfOptions {
  html: string;
  outputPath: string;
  format?: 'A4' | 'Letter' | 'Legal';
}
```

### Planned Types (v0.1.0+)

```ts
// ConvertResult
export interface ConvertResult {
  outputPath: string;
  pageCount: number;
  renderTimeMs: number;
  warnings: string[];
}

// Full config
export interface Md2PdfConfig {
  theme?: string;
  paper?: 'A4' | 'Letter' | 'Legal' | 'A3';
  landscape?: boolean;
  margin?: string | { top?: string; bottom?: string; left?: string; right?: string };
  toc?: boolean;
  tocDepth?: number;
  tocTitle?: string;
  header?: boolean | { enabled?: boolean; template?: string };
  footer?: boolean | { enabled?: boolean; template?: string };
  mermaid?: boolean | { enabled?: boolean; timeout?: number; theme?: string; };
  math?: boolean | { enabled?: boolean; macros?: Record<string, string>; };
  metadata?: { title?: string; author?: string; subject?: string; keywords?: string[]; };
  obsidian?: { vaultRoot?: string; attachmentFolder?: string; resolveWikiLinks?: boolean; };
  pageBreaks?: { h1NewPage?: boolean; hrAsPageBreak?: boolean; };
  output?: { dir?: string; filename?: string; merge?: boolean; };
  profiles?: Record<string, Omit<Md2PdfConfig, 'profiles'>>;
  plugins?: AnyPlugin[];
}

// Plugin types (v0.7.0)
export type AnyPlugin = MarkdownPlugin | HtmlPlugin | RenderPlugin | ThemePlugin | ExportPlugin;
```

---

## 13. Current CSS / Theme System

### Current State (v0.0.2)

CSS is **inline** in `src/renderer/index.ts`. There are no external CSS files yet.

### CSS Variable Names (current)

```css
--text-main: #333;
--text-muted: #666;
--bg-main: #fff;
--border-color: #ddd;
--link-color: #0366d6;
--code-bg: #f6f8fa;
```

### CSS Variable Names (planned v0.1.0 rename)

```css
--md2pdf-font-family-body: 'Inter', system-ui, sans-serif;
--md2pdf-font-family-heading: inherit;
--md2pdf-font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
--md2pdf-font-size: 11pt;
--md2pdf-line-height: 1.7;
--md2pdf-color-text: #1a1a1a;
--md2pdf-color-heading: #111111;
--md2pdf-color-link: #0066cc;
--md2pdf-color-code-bg: #f6f8fa;
--md2pdf-color-border: #e1e4e8;
--md2pdf-margin-top: 20mm;
--md2pdf-margin-bottom: 20mm;
--md2pdf-margin-left: 15mm;
--md2pdf-margin-right: 15mm;
--md2pdf-code-border-radius: 6px;
--md2pdf-heading-scale: 1.25;
```

### Current CSS Coverage

| Element | Styled? | Notes |
|---------|---------|-------|
| Body typography | ✅ | System font stack, 1.6 line height |
| Headings h1-h6 | ✅ | h1/h2 have bottom borders, page-break-after: avoid |
| Paragraphs | ✅ | 16px bottom margin |
| Links | ✅ | Blue, no underline, underline on hover |
| Blockquotes | ✅ | Left border, muted text |
| Code blocks | ✅ | Monospace, background, border-radius, page-break-inside: avoid |
| Inline code | ✅ | Background tint, border-radius |
| Tables | ✅ | Zebra striping, collapsed borders, page-break-inside: avoid |
| Images | ✅ | max-width: 100%, page-break-inside: avoid |
| HR | ✅ | Styled as thick line |
| Print CSS | ⚠️ | Basic: font-size 11pt, no max-width, links turn black |
| Task lists | ❌ | Not yet styled |
| Footnotes | ❌ | Not yet supported |
| Callouts | ❌ | Not yet supported |

---

## 14. Golden Document Testing Strategy

### What It Is
A set of permanent, curated Markdown fixtures that cover every rendering concern.
Every feature release renders them, compares against approved snapshots, and fails CI on regressions.

### Workflow
```
Render all golden docs → Compare against approved snapshots → Approve or Fix
```

### The 14 Fixtures

| Fixture | Added In | Guards |
|---------|----------|--------|
| `basic.md` | v0.1.0 | Headings, paragraphs, emphasis, links, blockquotes |
| `code-blocks.md` | v0.1.0 | 20+ languages, inline code, long lines |
| `tables.md` | v0.1.0 | Wide, aligned, nested, multi-page |
| `images.md` | v0.1.0 | Sizing, SVG, data URIs, captions |
| `nested-lists.md` | v0.1.0 | 5 levels deep, task lists, mixed |
| `footnotes.md` | v0.1.1 | All footnote variants |
| `toc.md` | v0.1.1 | 20+ headings, TOC accuracy |
| `headers-footers.md` | v0.1.2 | Running headers/footers on long docs |
| `mermaid-all.md` | v0.2.0 | Every Mermaid diagram type |
| `math.md` | v0.3.0 | KaTeX environments, numbering |
| `obsidian.md` | v0.4.0 | Wiki links, callouts, embeds |
| `github-readme.md` | v0.6.0 | Realistic README, github theme |
| `academic.md` | v0.6.0 | 20-page paper, math+figures+tables |
| `100-pages.md` | v0.9.0 | Pagination stress test |
| `unicode.md` | v0.9.0 | CJK, Arabic, mixed-direction |
| `rtl.md` | v0.9.0 | Full right-to-left document |

### Snapshot Storage
```
tests/snapshots/<fixture-name>/<theme>.pdf   ← approved output
tests/snapshots/<fixture-name>/<theme>.png   ← rasterized first page
tests/output/                                ← current render (gitignored)
tests/diff/                                  ← pixel-diff images (gitignored)
```

### Commands
```sh
npm run golden:render    # render all fixtures → tests/output/
npm run golden:diff      # diff output vs snapshots → report
npm run golden:approve   # overwrite snapshots (human approval)
npm run golden:check     # CI: render + diff + fail on regression
```

---

## 15. Full Development Roadmap

### Version Timeline

```
v0.0.1  ✅ Foundation — core pipeline, basic output
v0.0.2  ✅ Packaging & CI — npm publish, GitHub Actions

v0.1.0  🚧 Professional Rendering — typography, Shiki, tables, images, margins, print CSS
v0.1.1  📋 TOC + Footnotes + PDF Metadata
v0.1.2  📋 Headers + Footers + Page Breaks

v0.2.0  📋 Mermaid — all 12+ diagram types, SVG, themes, HiDPI
v0.2.1  📋 Mermaid improvements, edge cases, caching

v0.3.0  📋 KaTeX — inline/display math, numbering, macros, chemistry

v0.4.0  📋 Obsidian Core — wiki links, callouts, YAML frontmatter, tags
v0.4.1  📋 Obsidian Embeds — ![[embeds]], transclusion, attachments

v0.5.0  📋 Configuration — md2pdf.config.ts, defineConfig, profiles, Zod validation
v0.6.0  📋 Themes — 7 built-in themes, custom CSS, CSS custom properties
v0.7.0  📋 Plugin Infrastructure — public API for 5 plugin types
v0.8.0  📋 Performance — caching, parallelism, browser reuse, page pool
v0.9.0  📋 Stabilization — API freeze, docs completion, test hardening
v0.9.x  📋 Bug fix patch releases
v1.0.0  📋 Stable release
```

### Per-Version Dependency Additions

| Version | New Dependencies |
|---------|-----------------|
| v0.1.0 | `shiki`, `rehype-slug` |
| v0.1.1 | `gray-matter` |
| v0.2.0 | `mermaid` (used inside browser, not bundled) |
| v0.3.0 | `remark-math`, `rehype-katex`, `katex` |
| v0.5.0 | `jiti`, `js-yaml`, `zod` |
| v0.8.0 | `p-limit` |

### Cross-Cutting Concerns (every release)
1. **Golden documents** — render, compare, approve
2. **Docs as you go** — feature docs written at ship time
3. **Programmatic API** — `convert()` is first-class, CLI wraps it
4. **Internal plugin pipeline** — designed at v0.1.0, public at v0.7.0

---

## 16. Dependencies — What Each Does

### `unified@^11.0.4`
The processing pipeline. Chains parsers, transformers, and compilers.
`unified().use(parser).use(transformer).use(compiler).process(input)`.

### `remark-parse@^11.0.0`
Parses Markdown text into `mdast` (Markdown Abstract Syntax Tree).
Handles headings, paragraphs, links, images, code, lists, blockquotes.

### `remark-gfm@^4.0.0`
Adds GitHub Flavored Markdown to `remark-parse`:
tables, task lists, strikethrough, autolinks, footnotes (basic).

### `remark-rehype@^11.0.0`
Bridges `mdast` → `hast` (HTML AST). Converts Markdown nodes to HTML equivalents.
`{ allowDangerousHtml: true }` passes raw HTML through.

### `rehype-stringify@^10.0.0`
Serializes `hast` to an HTML string.
`{ allowDangerousHtml: true }` preserves raw HTML passthrough.

### `playwright@^1.40.0`
Launches headless Chromium. Used for:
1. `page.setContent(html)` — loads the complete HTML document
2. `page.pdf()` — renders to PDF using Chrome's native print engine
3. Future: Mermaid diagram rendering inside browser context

### `commander@^11.1.0`
CLI argument parser. Defines `md2pdf <input> [-o output]` command structure.

### `ora@^5.4.1`
Terminal spinner. Shows `⠙ Converting markdown to PDF...` during render.

### `picocolors@^1.0.0`
Terminal color output. Used for success (green) and error (red) messages.
Lighter alternative to `chalk` with zero dependencies.

---

## 17. Future Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `shiki` | v0.1.0 | Server-side syntax highlighting (VS Code-quality) |
| `rehype-slug` | v0.1.0 | Adds `id` attributes to headings for TOC anchor links |
| `gray-matter` | v0.1.1 | Parses YAML frontmatter from Markdown files |
| `mermaid` | v0.2.0 | Diagram rendering (executed in Playwright's browser context) |
| `remark-math` | v0.3.0 | Parses `$...$` and `$$...$$` math delimiters in Markdown |
| `rehype-katex` | v0.3.0 | Converts math AST nodes to KaTeX-rendered HTML |
| `katex` | v0.3.0 | KaTeX rendering engine, CSS, and font files |
| `jiti` | v0.5.0 | Runtime TS/JS config file loading without pre-compilation |
| `js-yaml` | v0.5.0 | YAML config file parsing |
| `zod` | v0.5.0 | Config schema validation with clear error messages |
| `p-limit` | v0.8.0 | Concurrency limiting for parallel render queues |
| `pdf-lib` | v0.1.1 | PDF metadata patching post-generation (if Playwright can't set it) |

---

## 18. Directory Purpose Map

| Directory | Purpose | Shipped to npm? | Gitignored? |
|-----------|---------|-----------------|-------------|
| `src/` | TypeScript source code | ❌ (only `dist/`) | ❌ |
| `dist/` | Compiled JS + declarations | ✅ | ✅ |
| `tests/` | Test suite | ❌ | ❌ |
| `tests/fixtures/` | Golden document Markdown sources | ❌ | ❌ |
| `tests/snapshots/` | Approved PDF/PNG snapshots | ❌ | ❌ |
| `tests/output/` | Current render output | ❌ | ✅ |
| `tests/diff/` | Pixel-diff failure images | ❌ | ✅ |
| `tests/benchmarks/` | Performance benchmarks | ❌ | ❌ |
| `docs/` | Documentation | ❌ | ❌ |
| `examples/` | Demo .md + .pdf files | ❌ | ❌ |
| `scripts/` | Dev utility scripts | ❌ | ❌ |
| `templates/` | HTML page templates | ❌ | ❌ |
| `phase/` | Internal dev planning (roadmap) | ❌ | ✅ |
| `.github/` | CI/CD workflows | ❌ | ❌ |
| `.husky/` | Git hooks | ❌ | ❌ |
| `node_modules/` | Dependencies | ❌ | ✅ |
| `.md2pdf-cache/` | Incremental render cache (future) | ❌ | ✅ |

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

# Golden document render output (not committed — only snapshots/ is committed)
tests/output/
tests/diff/

# Incremental render cache (added v0.8.0)
.md2pdf-cache/
```

---

## 20. npm Publish Rules

### What Gets Published

Only the `files` field contents:
```json
"files": ["dist", "README.md", "LICENSE", "CHANGELOG.md"]
```

### What Does NOT Get Published

Everything else: `src/`, `tests/`, `docs/`, `examples/`, `scripts/`, `templates/`,
`phase/`, `brain.md`, `STRUCTURE.md`, config files, `.github/`, etc.

### Publish Flow

```sh
npm run prepublishOnly    # clean + build
npm publish --access public
```

Or via GitHub Release → `.github/workflows/release.yml` runs automatically.

---

## 21. Key Design Decisions

### Why Playwright (not pdfkit, puppeteer, or wkhtmltopdf)?
- Chrome's native print engine handles any CSS — flexbox, grid, web fonts, `@page`, `@media print`
- Playwright is maintained by Microsoft, cross-platform, auto-downloads Chromium
- Mermaid diagrams require a real browser DOM for SVG `getBBox()` text measurement
- `page.pdf()` gives pixel-perfect print output matching what users see in Chrome

### Why unified/remark/rehype (not markdown-it, marked, or pandoc)?
- AST-based: deep extensibility without regex hacks
- Plugin ecosystem: `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-slug`
- Obsidian callouts, wiki links, embeds can be implemented as AST transformers
- Separate parsing and HTML stages allow plugins at each layer

### Why CLI wraps the API (not the other way around)?
- `convert()` is the core — CLI, VS Code extensions, GitHub Actions, Electron apps all call it
- CLI has zero logic — it validates input, parses flags, and calls `convert()`
- API changes are always backward-compatible; CLI flags are just sugar

### Why internal plugin pipeline from v0.1.0?
- Mermaid (v0.2.0), KaTeX (v0.3.0), and Obsidian (v0.4.0) all slot into the pipeline as internal plugins
- By v0.7.0, the public plugin API is just exposing what already exists — no refactor needed

### Why config before themes?
- Users need `md2pdf.config.ts` to persist their options before they need seven themes
- Themes at v0.6.0 build on top of config at v0.5.0 for a cohesive experience

### Why golden documents (not just unit tests)?
- Unit tests verify parsing logic; they don't catch "page 37 has a broken table"
- Golden documents render the full pipeline end-to-end and pixel-diff against approved output
- One CSS change that breaks layout is caught immediately

---

## 22. Research Findings Summary

### Prior Art (why md2pdf exists)

| Tool | Problem |
|------|---------|
| **Pandoc** | Heavy Haskell binary, LaTeX dependency, hard to integrate in Node.js |
| **Marp** | Opinionated for slides, not standard documents |
| **mdBook / VitePress** | Static sites, no granular PDF export |
| **wkhtmltopdf** | Deprecated WebKit, struggles with modern CSS |
| **pdfkit** | Manual text drawing, no CSS support, impossible for complex layouts |
| **markdown-pdf** | Uses PhantomJS (dead), no modern CSS support |

### Key Technical Findings

1. **Mermaid requires a real browser** — JSDOM can't do SVG `getBBox()` text measurement
2. **`page.pdf()` is the best PDF engine** — Chrome's native print engine is unmatched
3. **`unified` is the right parser** — AST-based, extensible, huge plugin ecosystem
4. **Obsidian extends GFM** — wiki links, embeds, callouts need custom remark plugins
5. **KaTeX > MathJax for PDF** — synchronous rendering, smaller output, no async wait

---

## 23. Known Limitations (v0.0.2)

| Issue | Impact | Fixed In |
|-------|--------|----------|
| No syntax highlighting | Code blocks are plain monospace | v0.1.0 (Shiki) |
| No Mermaid support | Diagrams render as raw code | v0.2.0 |
| No math support | LaTeX renders as raw text | v0.3.0 |
| No Obsidian syntax | Wiki links, callouts ignored | v0.4.0 |
| No themes | Single hardcoded style | v0.6.0 |
| No config file | Options only via CLI flags | v0.5.0 |
| No TOC generation | No table of contents | v0.1.1 |
| No headers/footers | No running header/footer | v0.1.2 |
| No frontmatter parsing | YAML frontmatter is ignored | v0.1.1 |
| No PDF metadata | Title/author not set in PDF | v0.1.1 |
| CLI version hardcoded | `version('0.0.1')` doesn't match package.json | v0.1.0 |
| Browser launched per file | No browser reuse across runs | v0.8.0 |
| No watch mode | Must manually re-run for changes | v0.6.0 CLI |
| No directory input | Can only process single files | v0.6.0 CLI |
| CSS is inline | Not extracted to separate files | v0.1.0 |
| CSS variables have old names | `--text-main` not `--md2pdf-color-text` | v0.1.0 |

---

## 24. Quick Reference for Common Tasks

### "I need to add a new remark plugin"
1. Install the package: `npm install remark-<name>`
2. Edit `src/parser/index.ts`
3. Add `.use(remarkPlugin)` to the unified chain (after `remarkGfm`, before `remarkRehype`)
4. Add a test in `tests/parser/index.test.ts`

### "I need to add a new rehype plugin"
1. Install the package: `npm install rehype-<name>`
2. Edit `src/parser/index.ts`
3. Add `.use(rehypePlugin)` to the unified chain (after `remarkRehype`, before `rehypeStringify`)

### "I need to change the CSS"
1. Currently: edit `src/renderer/index.ts` (the inline `<style>` block)
2. Future (v0.1.0+): edit `src/assets/base.css`, `src/assets/print.css`, or `src/assets/typography.css`

### "I need to change PDF output settings"
1. Edit `src/pdf/index.ts`
2. Modify the options passed to `page.pdf({ ... })`
3. Key options: `format`, `margin`, `displayHeaderFooter`, `headerTemplate`, `footerTemplate`

### "I need to add a CLI flag"
1. Edit `src/cli/index.ts`
2. Add `.option('--flag-name <value>', 'description')` to the Commander chain
3. Pass the option through to `convert()`

### "I need to run the project locally"
```sh
git clone https://github.com/amitdevx/md2pdf.git
cd md2pdf
npm install
npx playwright install chromium
npm run build
npm test

# Test a conversion:
node dist/cli/index.js examples/basic.md -o test.pdf
```

### "I need to publish a new version"
```sh
# 1. Update version in package.json
# 2. Update CHANGELOG.md
# 3. Commit and push
# 4. Create a GitHub Release
# 5. release.yml workflow publishes to npm automatically
```

### "I need to add a new source module"
1. Create the directory: `src/<module>/`
2. Create `src/<module>/index.ts`
3. Export from `src/index.ts` if it's part of the public API
4. Add tests in `tests/<module>/index.test.ts`
5. Update `src/README.md` module map

### "I need to understand the full pipeline for a single conversion"

```
User: md2pdf README.md -o out.pdf

1. CLI parses args → input="README.md", output="out.pdf"
2. CLI calls convert({ input, output })
3. convert() reads README.md from disk
4. convert() regex-replaces relative image paths → absolute file:// URLs
5. parseMarkdown(markdown) runs unified pipeline:
   a. remark-parse: Markdown text → mdast AST
   b. remark-gfm: adds GFM nodes (tables, checkboxes, strikethrough)
   c. remark-rehype: mdast → hast (HTML AST)
   d. rehype-stringify: hast → HTML string
6. renderHtmlTemplate(html, "README") wraps HTML:
   - Adds DOCTYPE, <html>, <head>, <style>, <body>
   - Injects all CSS (typography, tables, code blocks, print)
   - Wraps content in <div class="markdown-body">
7. generatePdf({ html, outputPath }) runs Playwright:
   a. chromium.launch() — starts headless Chrome
   b. browser.newContext() → page = context.newPage()
   c. page.setContent(html, { waitUntil: 'networkidle' })
   d. await document.fonts.ready — waits for web fonts
   e. page.pdf({ path, format: 'A4', margin: 20mm, printBackground: true })
   f. browser.close()
8. PDF file is written to out.pdf
9. CLI shows success spinner
```

---

> **End of brain.md**
>
> This file is the single source of truth for any AI agent working on `@amitdevx/md2pdf`.
> It contains every file's complete contents, every config value, every type definition,
> the full architecture, the full roadmap, all dependencies, all conventions, and all
> design decisions. No re-analysis needed.

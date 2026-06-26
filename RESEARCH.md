# md2pdf Research & Architecture Document

## Phase 1: Research Findings

### 1. Markdown Rendering Pipeline (`unified`, `remark`, `rehype`)
The `unified` ecosystem is the standard for modern Markdown processing in JavaScript. It relies on a three-step pipeline:
1. **Parse**: Convert raw Markdown string into an Abstract Syntax Tree (AST) called `mdast` using `remark-parse`.
2. **Transform**: Apply plugins to modify the AST (e.g., `remark-gfm` for tables, or custom plugins for Obsidian wiki links).
3. **Mutate & Stringify**: Convert `mdast` to `hast` (HTML AST) using `remark-rehype`, apply HTML transformations (e.g., `rehype-katex`), and finally stringify to HTML using `rehype-stringify`.

*Why it succeeds:* It avoids the pitfalls of regex-based parsers by operating on a structured AST. This allows for deep extensibility and custom syntax (like Obsidian callouts) without breaking other formatting rules.

### 2. Mermaid Diagram Rendering
Mermaid parses a custom DSL into SVG diagrams.
*Why JavaScript execution is required:* Mermaid relies on the browser's DOM (specifically, SVG `getBBox()`) to measure text dimensions. Without a real browser environment, text within diagrams often overflows or misaligns. Server-side rendering (SSR) of Mermaid via JSDOM is brittle; the only way to achieve production-quality diagram rendering is by executing Mermaid inside a real headless browser like Chromium.

### 3. Chromium & Playwright for PDF Generation
Generating high-fidelity PDFs requires a robust layout engine. Tools that manually draw text to a PDF canvas (like `pdfkit`) struggle with complex CSS, flexbox, grid, and web fonts.
By using **Playwright** to launch Chromium and calling `page.pdf()`:
- We leverage Chrome's native print engine.
- We get full support for modern CSS, `@media print`, `@page` rules for margins/headers/footers.
- We allow client-side scripts (Mermaid, math rendering polyfills if needed) to execute fully before the PDF is captured.

### 4. Obsidian Compatibility
Obsidian uses a superset of GitHub Flavored Markdown (GFM). To support it, we must write or integrate specific `remark` plugins for:
- **Wiki Links (`[[Page]]`)**: Custom parser to extract the link target and optional alias.
- **Embeds (`![[Page]]`)**: Handle block-level transclusion and image embeds.
- **Callouts (`> [!NOTE]`)**: AST visitor to detect blockquotes starting with `[!type]` and transform them into `hast` nodes with specific CSS classes (`<div class="callout callout-note">`).
- **YAML Frontmatter**: Parsed via `remark-frontmatter` to extract metadata for the PDF (e.g., title, custom margins, author).

### 5. Prior Art Analysis
- **Pandoc**: The gold standard for conversion, but relies on a heavy Haskell binary and LaTeX. Hard to integrate natively in a Node.js project.
- **Marp**: Excellent for presentations, but heavily opinionated towards slide generation rather than standard document formats.
- **mdBook / VitePress**: Great for generating static sites, but lack the specific features for granular PDF export and print-centric CSS.
- **Defuddle**: Kepano's tool shows the importance of clean, semantic HTML and Obsidian-compatible CSS. `md2pdf` will adopt a similarly clean output to ensure CSS themes apply predictably.

---

## Phase 2: Architecture Design

As requested, the architecture will follow this modular pipeline:

```text
Raw Markdown
      ↓
[ Markdown Parser (remark-parse) ]
      ↓
Markdown AST (mdast)
      ↓
[ Plugins (remark-gfm, remark-math, custom obsidian plugins) ]
      ↓
HTML AST (hast) via remark-rehype
      ↓
[ HTML Plugins (rehype-katex, rehype-shiki) ]
      ↓
Stringified HTML + Embedded Assets (base64 or local paths)
      ↓
HTML Document + Injected CSS Themes & Mermaid Scripts
      ↓
[ Playwright (Headless Chromium) ]
      ↓
Browser Rendering (Wait for Network / Mermaid / Fonts)
      ↓
[ page.pdf() ]
      ↓
Production-Quality PDF
```

---

## Phase 3: Technology Stack

- **CLI Framework**: `commander`
- **Markdown Engine**: `unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`, `remark-math`
- **HTML Engine**: `remark-rehype`, `rehype-stringify`, `rehype-slug`, `rehype-autolink-headings`, `rehype-katex`
- **Syntax Highlighting**: `shiki` (for beautiful, VS Code-like highlighting without runtime JS)
- **Diagrams**: `mermaid` (executed in-browser)
- **Browser/PDF Engine**: `playwright`
- **File System / Utils**: `chokidar` (watching), `cosmiconfig` (config loading), `fast-glob` (batch processing)

---

## Next Steps
I have completed the Research and Architecture phases (Phases 1-3). The internal understanding is solidified, and I am ready to begin implementing the project structure (Phases 4-10), starting with setting up the NPM project, installing these modern dependencies, and building the modular directories (`src/cli`, `src/parser`, `src/renderer`, `src/pdf`, `src/plugins`, `src/themes`).

# md2pdf Research: Prior Art, Rendering, and Core Capabilities

## 1. Prior Art Comparison

| Tool | Architecture / Engine | Pros | Cons | Why Users Abandon It |
|---|---|---|---|---|
| **markdown-pdf** | PhantomJS (deprecated) | Simple CLI | Deprecated browser, bad CSS, no math/mermaid | Broken on modern OS, lack of modern CSS. |
| **md-to-pdf** | Puppeteer + `marked` | Good CLI, config support | Uses regex-based `marked` parser (hard to extend), brittle CSS | Hard to extend for custom syntax (e.g., callouts). |
| **Marp** | `markdown-it` + Chromium | Great for presentations | Not designed for continuous documents/reports | Slide-based pagination doesn't fit standard docs. |
| **Pandoc** | Haskell + LaTeX | Universal, academic standard | Huge binary, complex LaTeX templating, not JS-native | Steep learning curve, hard to theme with CSS. |
| **mdBook** / **Quarto**| Rust / Pandoc | Great for full sites/books | Heavyweight for single files, complex setup | Too much overhead for a simple CLI conversion. |
| **VitePress** | Vue + `markdown-it` | Excellent SSG | PDF export is a hack (scraping local server) | Bloated architecture for pure PDF generation. |

*Conclusion:* There is a gap for a **JS-native, AST-based, Playwright-driven** CLI that provides high-fidelity, continuous document PDFs out of the box, with native extensibility for Obsidian-like syntax.

## 2. Obsidian Rendering Pipeline

Obsidian parses Markdown using a proprietary parser (historically based on CodeMirror for Live Preview, and custom renderer for Reading View).
* **Extensions Unique to Obsidian:**
  * Wiki Links: `[[Link|Alias]]`
  * Embeds: `![[Image.png]]` or `![[Note#Heading]]`
  * Callouts: `> [!type] Title` (Types: note, tip, warning, error, info, etc.)
  * Math: KaTeX (`$$...$$`)
  * Tags: `#tag`
* **CSS Architecture:** Heavy use of CSS variables (`--background-primary`, `--text-normal`).
* **PDF Export:** Relies on Electron's `webContents.printToPDF()`. Our Playwright implementation will perfectly emulate this behavior.

## 3. Browser Printing (Chromium)

Playwright's `page.pdf()` uses Chromium's Print-to-PDF engine.
* **Native Support:** `@page` (margins, size), `break-before: page`, `break-inside: avoid` (crucial for keeping tables/code blocks intact), `print-color-adjust: exact` (forces background colors to print).
* **Headers & Footers:** Playwright allows injecting `headerTemplate` and `footerTemplate`. *Limitation:* These templates do not inherit the page's CSS. *Workaround:* We must inject our theme's inline CSS into these templates during generation.
* **Paged.js:** A polyfill for CSS Paged Media. While powerful, native Chromium `@page` has improved significantly. We will stick to native Playwright for performance, falling back to custom DOM manipulation only if native headers are insufficient.

## 4. Mermaid Deep Research

Mermaid generates SVGs dynamically by measuring text in the DOM (`getBBox`).
* **Headless Chromium Behavior:** We must inject `mermaid.min.js`, configure it, and explicitly await `mermaid.run()` after the DOM is loaded but *before* calling `page.pdf()`.
* **Fonts:** Diagram text bounding boxes will be incorrect if web fonts are not fully loaded. We must `await document.fonts.ready`.
* **Large Graphs:** Disable animations (`config: { themeVariables: { animate: false } }`) to speed up rendering and prevent PDF capture during an animation state.

## 5. Typography & CSS Architecture

* **Typography:** Professional PDFs require strict line-heights (1.4-1.5 for print), modular font scaling, and fallback system fonts (`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`). We will enforce `font-variant-ligatures: common-ligatures`.
* **CSS Variables:** Theming will be completely tokenized.
  ```css
  :root {
    --md2pdf-bg: #ffffff;
    --md2pdf-text: #333333;
    --md2pdf-primary: #0366d6;
    --md2pdf-border: #e1e4e8;
  }
  ```
* **Print Mode:** `@media print` will strip interactive elements, enforce `print-color-adjust: exact`, and override link styling to show URLs if configured.

## 6. Image Processing

* **Local Paths:** Standard Markdown parsers emit `<img src="./image.png">`. Playwright will fail to resolve relative local paths in a raw HTML string.
* **Strategy:** Our renderer must transform all local image paths to absolute `file://` URIs, or base64-encode them during the AST `hast` phase before feeding the HTML to Playwright.
* **DPI/High-Res:** Images should be constrained via CSS (`max-width: 100%; height: auto; break-inside: avoid;`).

## 7. Advanced PDF Features

* **Bookmarks/Outlines:** Chromium 112+ supports generating PDF outlines natively via heading tags (H1-H6). Playwright exposes this via the `generateDocumentOutline` option (we will enable this).
* **Clickable TOC:** We will use `rehype-slug` to add IDs to headings, and a custom TOC plugin to generate internal `#id` links, which Chromium natively converts to internal PDF hyperlinks.

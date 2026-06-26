# md2pdf Architecture Specification

## 1. Technical Architecture & Module Graph

md2pdf is designed as a modular, pipeline-based architecture separating parsing, HTML transformation, and PDF generation.

```mermaid
graph TD
    CLI[CLI Module (cac)] --> Config[Config Loader (cosmiconfig)]
    Config --> Core[md2pdf Core API]
    Core --> Parser[Markdown Parser (unified)]
    Core --> Renderer[HTML Renderer]
    Core --> PDF[PDF Engine (Playwright)]
    
    Parser --> Plugins[remark/rehype plugins]
    Renderer --> Themes[CSS Theme Engine]
    PDF --> Output[File System]
```

**Directories:**
* `src/cli/`: CLI parsing, progress bars, logging.
* `src/config/`: Configuration resolution, defaults, merging.
* `src/core/`: The main programmatic API (`compile(input, config)`).
* `src/parser/`: unified/remark pipeline setup.
* `src/plugins/`: Custom plugins (Obsidian embeds, callouts).
* `src/renderer/`: HTML stringification, asset resolution (base64/file URIs), theme injection.
* `src/pdf/`: Playwright automation, page margins, outline generation.

## 2. Rendering Pipeline Specification

The pipeline is strictly sequential to guarantee predictable outputs:

1. **Read & Discover:** Load `.md` file(s), resolve config, load local assets.
2. **Parse (mdast):** `remark-parse` -> `remark-gfm` -> `remark-math` -> `remark-frontmatter` -> custom Obsidian plugins.
3. **Mutate (hast):** `remark-rehype`.
4. **Transform (hast):** `rehype-katex`, `rehype-shiki` (syntax), `rehype-slug`, custom image resolver.
5. **Stringify:** `rehype-stringify` generates raw HTML.
6. **Template Injection:** Wrap HTML in standard boilerplate. Inject CSS (Theme) and JS (Mermaid).
7. **Browser Launch:** Launch Playwright Context.
8. **Client Execution:** `await document.fonts.ready`, `await mermaid.run()`.
9. **Capture:** `page.pdf()` with metadata and outlines enabled.

## 3. Plugin API Specification

md2pdf is fully extensible. Developers can pass plugins in `md2pdf.config.ts`.
A plugin is an object with lifecycle hooks:

```typescript
export interface Md2PdfPlugin {
  name: string;
  // Hook into the remark AST
  remarkPlugins?: import('unified').Plugin[];
  // Hook into the rehype AST
  rehypePlugins?: import('unified').Plugin[];
  // Inject CSS or JS strings into the final HTML template
  injectHead?: () => string | Promise<string>;
  injectBody?: () => string | Promise<string>;
  // Lifecycle hooks for Playwright manipulation
  beforeRender?: (page: import('playwright').Page) => Promise<void>;
  afterRender?: (pdfBuffer: Buffer) => Promise<void>;
}
```

## 4. Configuration Specification

Configuration is resolved via `cosmiconfig`, supporting `md2pdf.config.ts`, `.js`, `.json`, or `package.json`.

```typescript
export interface Md2PdfConfig {
  input: string | string[];
  output: string;
  theme: 'obsidian-dark' | 'obsidian-light' | 'github' | string;
  css?: string | string[]; // Paths to custom CSS files
  pdf: {
    format?: 'A4' | 'Letter' | 'Legal';
    margin?: { top: string, right: string, bottom: string, left: string };
    printBackground?: boolean; // Default true
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
  };
  markdown: {
    obsidian?: boolean; // Enable wikilinks, callouts
    math?: boolean;
  };
  plugins?: Md2PdfPlugin[];
}
```

## 5. CLI Specification

The CLI will be built with `cac` (lighter than commander) and `consola` for elegant logging.

**UX Goals:**
* Fast boot time.
* Clear visual progress (using `ora` spinners for "Parsing", "Launching Browser", "Rendering PDF").
* Beautiful error traces.

**Commands:**
* `md2pdf <file>` (Outputs `<file>.pdf` in CWD)
* `md2pdf <dir> --recursive` (Batch process)
* `md2pdf <file> --watch` (Hot reload PDF generation on save)
* `md2pdf --init` (Generates a default `md2pdf.config.ts`)

**Flags:**
* `--theme <name>`
* `--paper <format>`
* `--margin <size>`
* `--out <dir>`
* `--debug` (Verbose logging, leaves Playwright browser open for inspection)

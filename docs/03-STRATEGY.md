# md2pdf Strategy & Roadmap

## 1. Testing Strategy

Ensuring high-fidelity PDF rendering requires a multi-layered testing approach, as CSS and layout changes can easily break print output.

1. **AST & Pipeline Testing (Unit):**
   * **Snapshot Testing:** Pass Markdown strings into the unified pipeline and snapshot the resulting `mdast` and `hast`. This ensures parsers (like Obsidian callouts) don't regress.
   * **Framework:** `vitest`

2. **Visual Regression Testing (E2E):**
   * We cannot easily diff raw PDF binaries because PDF generation includes timestamps and dynamic IDs.
   * **Strategy:** Use Playwright to capture screenshots of the generated HTML *before* PDF generation, and compare them using Playwright's native visual regression `expect(page).toHaveScreenshot()`.
   * **Golden PDF Testing:** Extract text and structural layout from generated PDFs (using `pdf-parse`) and assert that the text is present and correctly ordered.

3. **Mermaid & External Dependency Tests:**
   * Specific tests to ensure Mermaid diagrams render SVG paths completely before capture.
   * Mock network requests to ensure local asset (images/fonts) resolution works properly under `file://` protocols.

4. **Cross-Platform Compatibility:**
   * Run E2E tests across Linux, macOS, and Windows via GitHub Actions to ensure file path resolution (especially absolute vs relative image paths) works consistently across OS environments.

## 2. Performance Engineering

PDF generation via headless Chromium is inherently CPU and memory intensive. 

1. **Worker Threads for Parsing:**
   * Markdown parsing and AST transformation (Shiki, KaTeX) will run in parallel worker threads using `piscina` or Node's native `worker_threads` when batch processing a large directory (e.g., a full Obsidian vault).

2. **Browser Reuse & Context Isolation:**
   * **Do not launch a new Chromium instance per file.**
   * Launch a single `playwright.chromium.launch()` instance.
   * For each file, spawn a lightweight context: `browser.newContext()` and `context.newPage()`.
   * Limit concurrency (e.g., `os.cpus().length`) to prevent OOM errors when processing thousands of files.

3. **Caching & Incremental Builds:**
   * In `--watch` mode, cache the AST. If only CSS changes, we skip Markdown parsing entirely and only reload the Playwright page.
   * Store a checksum map of files. If a Markdown file hasn't changed, skip PDF generation for that file in batch mode.

4. **Image & Font Optimization:**
   * High-res images heavily bloat PDF size. While Playwright doesn't compress images natively in PDFs well, we can pre-process images via `sharp` during the HTML stringification phase if optimization is enabled in the config.

## 3. Future Roadmap

**Phase A: Foundation (v0.1.0)**
* Core unified pipeline (`remark`, `rehype`).
* Playwright PDF generation.
* Obsidian basic compatibility (wikilinks, embeds).
* CLI scaffold.

**Phase B: Visuals & Polish (v0.5.0)**
* Mermaid diagram execution.
* KaTeX math rendering.
* Shiki syntax highlighting.
* Built-in themes (Obsidian Dark/Light, GitHub).
* Playwright header/footer template injection.

**Phase C: Performance & Scale (v1.0.0)**
* Worker-thread batch processing.
* Watch mode.
* Plugin API stabilization and documentation.
* Complete Visual Regression test suite.

**Phase D: Advanced PDF Features (v1.5.0+)**
* Password encryption and watermarking via `pdf-lib` post-processing.
* Automatic Image compression/downscaling.
* Community Plugin registry.

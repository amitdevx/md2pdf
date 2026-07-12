# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-07-12

### Added
- **Persistent Configuration System**: Discovers and loads configuration automatically (`md2pdf.config.ts`, `.md2pdfrc.json`, `.md2pdfrc.yaml`, or `package.json`).
- **TypeScript Support**: Exposed `defineConfig` for typed programmatic config authoring with Zod validation backing.
- **Profiles**: Added `--profile <name>` CLI option to switch between configuration presets dynamically.

## [0.4.2] - 2026-07-11

### Added
- Explicit handlers for unsupported flags (`--browser`, `--stdin`, `--stdout`, `--quiet`, `--input`) to output clear `InvalidArgumentError` messages rather than crashing.
- New `publish-gpr` GitHub Actions CI job to seamlessly publish the npm package to GitHub Packages in parallel.

### Fixed
- Rebuilt the `dist/` artifacts so that `md2pdf --version` accurately reports `0.4.2`.
- Added a 5MB size limit to Markdown inputs before unified/AST parsing to prevent severe V8 OOM aborts on exceptionally large files.

## [0.4.1] - 2026-07-10

### Added
- Native AST parsing support for Obsidian highlight syntax (`==highlight==`) translated to HTML `<mark>` tags.
- Root user sandboxing detection to auto-inject `--no-sandbox` if Playwright Chromium runs via `sudo` on Linux.

### Fixed
- Fixed CLI test assertions failing in GitHub CI because of updated Commander error string outputs.

## [0.4.0] - 2026-07-10

### Added
- Complete Obsidian Markdown interoperability layer (v0.4.0 & v0.4.1 phase plans).
- Transclusion and embedding of external markdown notes (`![[note.md]]`) and images.
- Full cycle detection and warning fallback for infinite circular embeds (`circular-1.md` -> `circular-2.md`).
- Clickable and natively styled internal Wiki links (`[[Link]]` and `[[Link|Alias]]`).
- 10 variations of Obsidian-styled blockquote callouts (`> [!WARNING]`).
- Inline and nested tags (`#tag`, `#nested/tag`) with dynamic styling (hiding supported via `--hide-tags`).
- Template variable injection in headers and footers (e.g. `{frontmatter.author}`).
- CLI flags for vault awareness: `--vault-root`, `--attachment-folder`, `--max-attachment-size`.

## [0.3.0] - 2026-07-08

### Added
- Native support for Math blocks (KaTeX) using `remark-math` and `rehype-katex`.
- Support for mhchem plugin for chemical equations (`\ce{H2O}`).
- CLI option `--no-math` to disable Math rendering.

## [0.2.0] - 2026-07-03

### Added
- Mermaid diagram rendering using headless Playwright evaluation.
- SVG inlining for lossless, selectable Mermaid graphs in the PDF.
- Theme overrides for Mermaid diagrams via `--mermaid-theme`.

## [0.1.6] - 2026-06-29

### Added
- `--paper` strict runtime option validation (`A4`, `Letter`, `Legal`).
- `--margin` robust unit validation (CSS units `mm`, `cm`, `in`, `px`, `pt`, `em`, etc.).
- Explicit `stdin` (`-`) input validation and user-friendly error guidance.
- Output directory auto-creation warning and overwrite existing file warning.
- Success messages now print the fully resolved absolute path to the generated PDF.

### Fixed
- Fixed silent npm `postinstall` output by explicitly using `process.stderr.write` to announce Chromium checks and readiness.
- Fixed an issue where `.txt` and binary files incorrectly triggered a "same file" error by adding an explicit `.md` extension check.
- Fixed `EACCES` permission denied errors on input files to display actionable `chmod` guidance instead of raw stack traces.
- Fixed trailing slash output path issue where a hidden dotfile (`.pdf`) was created in directories like `/tmp/`.
- Fixed `YAMLException` multiline parsing escape from `\\n` to `\n` to cleanly show the first line of YAML syntax errors.
- Fixed TOC indentation compounding and `pruneEmpty` runtime crash by verifying element types and emitting a semantically nested `<ul>` tree.
- Changed `h1NewPage` default to `false` and exposed `--h1-new-page` CLI option to avoid unexpected breaking page breaks.

## [0.1.5] - 2026-06-29

### Fixed
- Fixed an issue where the `postinstall` script skipped downloading Chromium because the `npm_config_global` check silently evaluated to false on some systems. The guard has been removed, relying on Playwright's native cache to avoid redundant downloads.

## [0.1.4] - 2026-06-29

### Fixed
- Fixed an issue where Playwright Chromium binaries were not automatically downloaded during a global `npm install -g`, causing a failure on first run.
- Added a `postinstall` script to seamlessly download the required Chromium dependencies.
- Added a fallback guard so local project installations do not forcefully download Chromium.
- Improved CLI error handling to gracefully detect missing browsers and provide actionable installation commands instead of raw stack traces.

## [0.1.3] - 2026-06-28

### Added
- Running Headers and Footers support (`--header`, `--footer`).
- Manual Page Breaks via `<!-- pagebreak -->`.
- Automatic Page Breaks before `h1` and optionally `hr`.
- Robust HTML escaping for metadata titles.
- Dynamic version inference for PDF creator metadata.

### Fixed
- Fixed bug where PDF metadata merge overwrote earlier fields.
- Fixed `__dirname` resolution in ESM tests.

## [0.1.1] - 2026-06-28

### Added
- Table of Contents generation via `--toc`, `--toc-depth`, and `--toc-title`.
- Native GFM Footnotes support with bidirectional backlinks.
- YAML frontmatter parsing via `gray-matter`.
- PDF metadata injection using `pdf-lib` (Title, Author, Subject, Keywords).
- Heading stable IDs generated automatically via `rehype-slug`.

## [0.1.0] - 2026-06-27

### Added
- Shiki-based syntax highlighting for 20+ languages (`github-light` and `one-dark-pro` fallbacks).
- Visual golden document testing suite (`tests/fixtures/`).
- Safely encodes URI paths for local images containing spaces.
- Print CSS improvements for preserving code blocks across pagination boundaries.
- Task list specific styling to prevent double-bullets.

## [0.0.1] - 2026-06-26

### Added
- Core Markdown to PDF rendering engine using Playwright.
- Programmatic API `convert(options)`.
- CLI via `md2pdf <file>` command.
- AST-based parsing pipeline using `unified`, `remark`, and `rehype`.
- Default professional print typography and theme.
- Support for GitHub Flavored Markdown (tables, strikethrough).
- Resolution of local relative image paths.
- Comprehensive configuration for `tsup`, `vitest`, `eslint`, and `prettier`.
- GitHub Actions CI workflow for linting, building, and testing.

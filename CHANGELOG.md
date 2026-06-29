# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

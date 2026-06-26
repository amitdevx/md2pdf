# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

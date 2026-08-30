# Project Structure and Guidelines

This document outlines the internal directories of `md2pdf` and their purposes.

## `src/` - Source Code
The core conversion pipeline and CLI orchestrator. Refer to `architecture.md` for a deeper dive into the system design.

## `docs/` - Documentation
All official documentation for `@amitdevx/md2pdf`. Contains guides for configuration, plugins, themes, and APIs.

## `examples/` - Example Outputs
Example Markdown files and their rendered PDF outputs. These demonstrate what `md2pdf` can produce, and serve as quick-start references.

## `tests/` - Test Suite
Test suite for `@amitdevx/md2pdf`. Contains unit tests (`parser/`, `renderer/`, `pdf/`), E2E tests (`cli/`), and performance tests (`benchmarks/`).

### `tests/fixtures/` - Golden Documents
Permanent, curated Markdown files that cover every rendering concern. They act as "Golden Documents".

### `tests/snapshots/` - Visual Snapshots
Approved rendered output of all golden documents. Snapshots are committed to git and serve as the reference for visual regression. Approval is always a deliberate human act — review the diff before approving (`npm run golden:approve`).

### `tests/benchmarks/` - Performance Benchmarks
Performance benchmark suite added in v0.8.0. Targets <1s cold render for simple files and <60s for a 200-file mock vault.

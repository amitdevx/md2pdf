# Project Structure and Guidelines

This document outlines the internal directories of `md2pdf` and their purposes.

## `src/`: Source Code
The core conversion pipeline and CLI orchestrator. Refer to `architecture.md` for a deeper dive into the system design.

## `docs/`: Documentation
All official documentation for `@amitdevx/md2pdf`. Contains guides for configuration, plugins, themes, and APIs.

## `examples/`: Example Outputs
Example Markdown files and their rendered PDF outputs. These demonstrate what `md2pdf` can produce, and serve as quick-start references.

## `tests/`: Test Suite
Test suite for `@amitdevx/md2pdf`. Contains unit tests (`parser/`, `renderer/`, `pdf/`), E2E regression tests (`e2e/`), and performance tests (`benchmarks/`).

### `tests/fixtures/`: Golden Documents
Curated Markdown files that cover specific rendering concerns and regression test cases.

### `tests/e2e/`: End-to-End and Regression Tests
End-to-end integration tests and PDF output regression tests verifying generated PDF properties, structure, encryption, paper size, and layout invariants across supported platforms.

### `tests/benchmarks/`: Performance Benchmarks
Performance benchmark suite verifying cold and warm rendering times.

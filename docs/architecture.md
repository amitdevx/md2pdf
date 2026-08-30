# md2pdf Architecture

## End-to-End, Feature-Scalable, Stable

This document outlines the architecture for the `md2pdf` package, which was heavily refactored in v0.9.0 to ensure modularity and stability.

### Overview
The codebase is structured to separate concerns and ensure stability, scalability, and testability. The core conversion pipeline is designed as a sequence of explicit, named, and testable stages.

### Directory Structure
```text
md2pdf/
├── src/
│   ├── cache/                   ← Incremental rendering cache
│   ├── cli/                     ← CLI layer (formatter, options, init, doctor)
│   ├── commands/                ← CLI orchestrators
│   │   ├── convert.ts           ← Thin orchestrator for validation and routing
│   │   └── handlers/            ← Modular handlers (single.ts, batch.ts)
│   ├── config/                  ← Configuration loader and merge
│   ├── core/                    ← Core conversion logic (index, vault)
│   ├── errors/                  ← Error system with structured payloads
│   ├── parser/                  ← Markdown parsing and AST transformation
│   ├── pdf/                     ← Playwright browser lifecycle and PDF gen
│   ├── plugins/                 ← Plugin system (mermaid, obsidian, etc.)
│   ├── renderer/                ← HTML rendering pipeline
│   ├── themes/                  ← Themes (dracula, github, etc.)
│   └── validation/              ← ALL CLI input/output validation
├── tests/
│   ├── cli/                     ← E2E CLI tests
│   ├── contract/                ← Strict contract tests for exit codes and JSON output
│   ├── core/                    ← Core engine tests
│   ├── parser/                  ← AST and highlighting tests
│   ├── pdf/                     ← Playwright rendering tests
│   └── plugins/                 ← Plugin-specific tests
```

### Handlers & Validation
All input, output, and flag validation is centrally located in `src/validation/` and runs entirely before browser initialization to prevent resource hangs. After validation, `src/commands/convert.ts` routes the execution to either `handlers/single.ts` (optimized fast-path) or `handlers/batch.ts` (concurrent worker pool with mermaid warmup).

### Error System
Structured errors (`Md2PdfError`) are used throughout, delivering context like the triggering file, expected conditions, hints, and documentation URLs, which empowers both programmatic usage and CLI JSON outputs.

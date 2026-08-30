# md2pdf Architecture

## End-to-End, Feature-Scalable, Stable

This document outlines the architecture for the `md2pdf` package.

### Overview
The codebase is structured to separate concerns and ensure stability, scalability, and testability. The core conversion pipeline is designed as a sequence of explicit, named, and testable stages.

### Directory Structure
```
md2pdf/
├── src/
│   ├── api/                     ← Public API surface
│   ├── pipeline/                ← The conversion engine (pure functions)
│   ├── validation/              ← ALL validation in one place
│   ├── browser/                 ← Browser lifecycle (isolated)
│   ├── cache/                   ← Incremental rendering cache
│   ├── scheduler/               ← Job scheduling for batch
│   ├── features/                ← Optional post-processing features
│   ├── themes/                  ← Themes
│   ├── plugins/                 ← Plugin system
│   ├── config/                  ← Configuration loader and merge
│   ├── errors/                  ← Error system with structured payloads
│   ├── cli/                     ← CLI layer
│   └── assets/                  ← Static assets
├── tests/
│   ├── unit/                    ← Pure function tests
│   ├── integration/             ← Real browser tests
│   └── contract/                ← Black-box CLI tests
```

### The Pipeline
The conversion pipeline uses explicit stages (ParseStage, TransformStage, RenderStage, etc.) passing a `PipelineContext` between them, enabling easy injection of features like watermarks or merging without complicating the core flow.

### Validation Layer
All input, output, and flag validation is centrally located in `src/validation/` and runs entirely before browser initialization.

### Public API Contract
A strict separation exists between the public API options (`ConvertOptions`) and internal CLI options (`CliOptions`). This ensures stability for library consumers while allowing the CLI to evolve freely.

### Error System
Structured errors are used throughout, delivering context like the triggering file, expected conditions, hints, and documentation URLs, which empowers both programmatic usage and AI-assisted debugging.


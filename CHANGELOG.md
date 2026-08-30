# Changelog

All notable changes to this project will be documented in this file.

## [0.9.0] - 2026-08-30

### Added
- Added `-q`, `--quiet` mode to suppress standard output for scripting environments.
- Added `--dry-run` flag to execute the conversion pipeline without writing to disk.
- Added `-v`, `--version` flag to CLI options.
- Added live progress percentages and ETAs to the batch conversion progress indicator.

### Fixed
- Fixed critical memory leak (timer leaks) in both the PluginRegistry and Mermaid Renderer when batch rendering large amounts of files.
- Fixed case-sensitive cache fragmentation on Windows/macOS.
- Enforced strict Plugin-aware processor cache hashing to prevent cross-plugin cache contamination.
- Neutralized the `EEXIST` crash when generating massive concurrent batches against missing directories.
- Ensured plugins are strictly sandboxed by trapping `Array.prototype.push` bypassing in deep readonly contexts.
- Hardened path traversal security to allow harmless prefix directories (like `/etc-backups/`) while still blocking traversal attacks against system roots like `/etc/`.
- Removed emojis and em-dashes from logging output to improve compatibility with strict terminal environments.
- Fixed process hang on non-TTY environments and edge cases throwing environment errors.
- Refactored `convert.ts` into modular single and batch handlers (`src/commands/handlers/`) to improve maintainability and CLI stability.
- Extracted core validation logic from CLI command into dedicated module (`src/validation/`).

## [0.8.10] - 2026-08-26
### Fixed
- Fixed CLI subcommand and flag consistency (`--list-themes` -> `list-themes`).
- Polished error formatting, standardizing on Title Case, boxed error messages, and catching raw Node.js stack traces.
- Fixed `doctor` to cache browser launch tests for 24h, check writability in `cwd`, and warn on `root` execution.
- Fixed `init` command prompt and spacing inconsistencies, and hardened filesystem write permissions in interactive mode.
- Intercepted early errors for `md2pdf help`, `--init`, and `--doctor` with better tips.
- Fixed JSON output error codes for batch operations.

## [0.8.9] - 2026-08-22

### Fixed
- File >5MB no longer hangs; the size check now correctly exits before the browser starts for single-file mode — missing continue caused the file to enter the pipeline after the check fired (BUG-1)
- Batch progress counter no longer overflows (e.g. 5/3); completedCount++ was called twice per file — once in the success path and again unconditionally at the bottom of the loop (BUG-6 regression)
- doc too complex now exits 2 without --json-errors; process.exit was being called inside a try/catch that silently swallowed it (BUG-8)
- Path traversal error is now rendered through the shared renderCliError formatter with correct box, error code, and run-with-verbose hint (BUG-NEW-3)
- Browser not found error is now rendered through renderCliError for consistent output (BUG-NEW-3)
- publish:false in single-file mode no longer shows - Converting... before the skip message; frontmatter is read before the spinner starts (BUG-NEW-4)
- Gray-matter ---js RCE block now shows the correct recommendation (Use YAML frontmatter) instead of the generic publish:true hint (BUG-NEW-7)
- md2pdf init now uses standard ℹ and ✔ symbols instead of home-grown [i] and [v] brackets (BUG-NEW-6)

## [0.8.8] - 2026-08-21

### Security
- Disabled gray-matter JavaScript frontmatter engine to prevent remote code execution via `---js` blocks in untrusted markdown files (VULN-1)
- Pinned mermaid to exact version 11.16.1 to guard against compromised upstream patch releases

### Fixed
- File larger than 5MB no longer hangs for 25 seconds before exiting; the size check now fires in the pre-flight loop before the browser starts (BUG-1)
- chmod 000 on a markdown file now shows the correct reason and recommendation instead of blaming the Playwright browser cache (BUG-3)
- bad yaml frontmatter now exits with code 1 (usage error) instead of code 2 (BUG-5)
- Batch progress counter no longer shows 0/N for the entire run; it increments correctly after each file completes (BUG-6)
- Duplicate spinner lines and duplicate skip messages for publish:false files are removed; exactly one message is emitted (BUG-4, BUG-7)
- doc too complex error now fires before cache lookup, so a previously cached complex document no longer exits 0 on warm cache (BUG-8)
- Batch --json-errors per-file code field is no longer the em-dash placeholder; errors carry the real error code (BUG-9)
- Verbose output prefix changed from [Verbose] bracket style to the standard info symbol to match the rest of the CLI (BUG-10)
- renderTimeMs in batch mode now measures wall-clock time from queue pickup to completion, including browser and Mermaid initialization (BUG-11)
- pre-publish.sh chmod 000 gate updated to expect exit code 2 to match the corrected behaviour


## [0.8.6] - 2026-08-15

### Fixed
- **Fixed Promise Hanging on Full Cache Hits:** Resolved an issue where background browser initialization promises would cause the CLI to hang indefinitely if the worker queue completed faster than the browser could launch.
- **Restored Obsidian Mermaid Compatibility:** Reintroduced AST preprocessing steps that cleanly handle unescaped quotes (`\"`) and empty parentheses (`()`) in Mermaid v11, fixing severe syntax errors on Obsidian-exported `mindmap` and `graph` markdown nodes.
- **Fixed Batch Execution Silent Failures:** Replaced standard `Promise.all` mapping in the worker queue with `Promise.allSettled` to elegantly catch unexpected application-level rejections (like filesystem panics) without swallowing the stack trace or crashing.
- **Repaired Error Exit Codes (Single & Batch Mode):** Batch failures correctly force `process.exitCode = 1` rather than succeeding if intermediate errors occurred. Single file fatal errors correctly bubble to the global error formatter instead of failing silently.
- **Fixed JSON Error Formatting:** Restructured the `renderCliError` logic to prevent `process.exit()` from bypassing browser cleanup protocols. Ensures filesystem errors (like `chmod 000`) correctly exit with code `2` instead of `0`.
- **Fixed Batch JSON Error Codes:** Added strict fallback mappings to individual file results within batch failures so that unhandled internal error objects never resolve to `code: undefined`.
- **NPM Audit Vulnerability Patch:** Upgraded nested high-severity dependencies (`brace-expansion`, `js-yaml`, `nanoid`, `postcss`, `esbuild`) resolving 5 major vulnerability vectors from upstream library chains.

## [0.8.5] - 2026-08-14

### Added
- **Universal Chromium Discovery:** The zero-config auto-discovery system has been massively expanded. It now natively scans default system installation paths across all major OS platforms (macOS, Windows, Linux) for 38 Chromium engines.
- **Intelligent Engine Enforcement:** Playwright's headless configuration can hang indefinitely when connecting to non-Chromium browsers via the CDP socket. md2pdf now features a fast runtime signature check that verifies the browser engine synchronously before attempting to launch it, failing gracefully instead of hanging.

### Fixed
- **Resilient Fallback Chains:** The browser fallback mechanism has been significantly fortified. Strict arbitrary timeouts have been removed to accommodate heavily loaded CI/CD runner environments that require more time to boot browsers. Invalid or stale browser cache paths are immediately evicted upon failed connections.
- **CLI Diagnostic Consistency:** The `md2pdf doctor` and `md2pdf init` commands fully inherit the new 38-browser matrix and engine enforcement rules, making debugging browser setups more transparent.
- **Playwright Launcher Fixes:** Fixed an issue where the `--browser` CLI flag wasn't properly mapping directly to the underlying Playwright launcher.
- **CI Pipeline Stabilizations:** Resolved CI pipeline timeouts affecting `windows-latest` and `ubuntu-latest` environments running `md2pdf` due to artificially constrained boot timeouts.

## [0.8.4] - 2026-08-13

### Fixed
- **JSON Output Formatting:** Refined `--json-errors` pipeline. All nested error objects now correctly format as `{ error: { message, code } }` instead of flattening, ensuring consistent schema compliance.
- **Log Routing Parity:** Messages indicating files skipped via `publish: false` frontmatter are now strictly routed to `stderr` (using `console.error`) rather than `stdout`, preserving pipe-safety for file contents.
- **Single-File Cache Optimization:** Substantially optimized the Incremental Rendering cache strategy for single-file conversions. The cache validation is now properly executed completely prior to any Playwright/Chromium instantiation, reducing "warm" cache response times to less than ~150ms.
- **Configuration Error Exit Codes:** Strengthened exit code enforcement. Malformed YAML frontmatter failures (`ERR_CONFIG_ERROR`) now accurately surface a standard exit code `1` (`EXIT.USAGE_ERROR`), correctly replacing an anomalous return value.

### Docs
- **Mermaid Documentation:** Expanded documentation explicitly detailing expected scaling, padding, and layout engine variations users might observe upgrading to Mermaid v11.
- **Documentation Overhaul:** Thoroughly reviewed and corrected language and formatting conventions across the entire documentation suite (`/docs` and `README.md`) to be more concise and professional.


## [0.8.3] - 2026-08-12

### Fixed
- **Browser Initialization**: Resolved Playwright `TypeError: Cannot read properties of undefined (reading 'newContext')` during Mermaid warmup in concurrent batch processes.
- **Cache Logging**: Corrected an issue where cache hits were not being reported in batch mode due to relative output path discrepancies. Cache hits now print cleanly in milliseconds.
- **Type Safety**: Cleaned up dangling variables and globally disabled the `any` ESLint warning.

## [0.8.2] - 2026-08-09

### Fixed
- **Cache Optimization**: Skipped Playwright browser startup when all files in a batch are already cached, completely eliminating overhead for 100% cache hits.
- **Browser Resolution**: Cached the fully resolved browser executable path to prevent Playwright from initiating a fallback waterfall search on every cold start when Chrome is missing.
- **CLI Ergonomics**: Running \`md2pdf\` without arguments now correctly prints the help menu and exits with code 1 instead of 0.
- **CLI Robustness**: Passing an existing directory to \`--output\` in single-file mode now correctly throws a fatal error instead of silently generating unexpected file paths.
- **Data Integrity**: JSON \`--json-errors\` output now correctly maps and increments the skipped count when \`publish: false\` is used.
- **Parser Resilience**: Added a strict depth limit (200) to pathological nested blockquotes to prevent AST call-stack overflow crashes (\`ERR_DOCUMENT_TOO_COMPLEX\`).
- **Asset Resolution**: Fixed an issue where Mermaid assets (\`mermaid.min.js\`) failed to resolve in distributed bundles due to improper pathing.
- **Unified Errors**: Unified the \`--json-errors\` output schema across all error code paths.

## [0.8.0] - 2026-08-08

### Added
- **Incremental Rendering Cache**: Implemented a robust content-hash based caching system (centralized in the OS temp directory) to significantly speed up batch conversions by automatically skipping unmodified files.
- **Cache Management CLI**: Added `--no-cache` flag to bypass the cache and force a complete re-render, and `--clear-cache` to wipe all stored cache records.

### Fixed
- **Parallel Diagram Rendering**: Re-architected Mermaid rendering for high-concurrency environments. Implemented a strict Mutex lock to serialize `page.evaluate` requests and utilized uniquely generated DOM IDs, entirely eliminating race conditions and visual layout corruption when processing multiple diagrams in parallel.
- **CLI Options Integrity**: Fixed an issue where the `--no-cache` flag would be dropped during configuration merging.
- **Automated Cache Cleanup**: The temporary cache directory is now cleanly purged upon running `npm uninstall -g @amitdevx/md2pdf`.

## [0.7.1] - 2026-08-03

### Fixed
- **Plugin Security (Sandboxing Escape)**: Plugins accessing the Playwright `Page` object in the `afterPageLoad` hook are now restricted via a Javascript Proxy. Destructive methods (`close`, `goto`, `pdf`) are aggressively blocked, throwing a `PluginSecurityError`.
- **Plugin Security (Context Mutability)**: Implemented a deep-readonly Proxy for `RenderContext`. Malicious or poorly designed plugins can no longer overwrite core engine options or configurations during runtime.
- **Resilience (Infinite Loops)**: All asynchronous plugin hooks are now aggressively wrapped in a 10,000ms `Promise.race` timeout to prevent single plugins from permanently hanging the batch processing CLI.
- **Resilience (Broken Initialization)**: Plugins that throw an error during the `setup()` initialization phase are now automatically evicted from the active registry and will not trigger cascading failures during the render pipeline.
- **Resilience (Type Integrity)**: Implemented strict runtime Zod-style type verification on hook return values. If `beforeRender` does not return a string, or `afterPdf` does not return a Buffer, the pipeline immediately aborts rather than feeding corrupted memory downstream to libraries like `pdf-lib`.
- **Resilience (Error Swallowing)**: Unhandled plugin hook errors now correctly propagate and abort the current file's generation, rather than silently failing and producing incomplete PDFs.

## [0.7.0] - 2026-07-31

### Added
- **Plugin Infrastructure**: A fully documented, stable plugin API exposing `MarkdownPlugin`, `HtmlPlugin`, `RenderPlugin`, `ThemePlugin`, and `ExportPlugin`. Hook into AST generation, inject custom HTML rendering logic, or modify the Playwright rendering lifecycle.
- **Plugin Registry**: Added internal registry and lifecycle hooks (`setup`, `beforeRender`, `afterPageLoad`, `afterPdf`, `teardown`).
- **Configuration Mapping**: Ensured `plugins` array correctly maps from Zod configuration to the internal `ConvertOptions`.

## [0.6.1] - 2026-07-20

### Added
- **Theming System**: Introduced 7 professionally crafted built-in themes (`default`, `github`, `obsidian-light`, `obsidian-dark`, `dracula`, `nord`, `academic`).
- **Dynamic Syntax Highlighting**: Shiki grammars are now dynamically detected and loaded on-the-fly, reducing compilation overhead.
- **Strict Obsidian Parity**: Flawless visual alignment with Obsidian's native exports, including Lucide SVG callout icons.
- **Improved Layout Engine**: Mermaid diagrams now naturally left-align, and large tables gracefully span across page breaks with repeating headers.

## [0.5.0] - 2026-07-12

### Added
- **Batch Processing**: Convert multiple Markdown files at once using globs (e.g., `md2pdf "docs/*.md" -o out_dir/`).
- **Browser Re-use**: Significantly optimized performance during batch processing by intelligently re-using a single headless Chromium instance.
- **Lazy-Loaded Mermaid Processing**: Completely eliminated Cold Start Lag by lazily instantiating the `sharedMermaidPage` only when Markdown files actually contain diagrams.
- **Persistent Configuration System**: Discovers and loads configuration automatically (`md2pdf.config.ts`, `.md2pdfrc.json`, `.md2pdfrc.yaml`, or `package.json`).
- **TypeScript Support**: Exposed `defineConfig` for typed programmatic config authoring.
- **Profiles**: Added `--profile <name>` CLI option to switch between configuration presets dynamically.

### Fixed
- Fixed an issue where the CLI would hang on `SIGINT` (Ctrl+C), leaving invisible Zombie Chromium processes running in RAM.
- Fixed a massive memory leak and garbage collection spike during batch processing by ensuring Playwright contexts are gracefully closed inside `finally` blocks.
- Fixed an issue where CLI options would mistakenly override file-level YAML frontmatter; frontmatter now correctly takes precedence.
- Fixed a bug causing large Mermaid diagrams to split across pages by ensuring `maxWidth` and `maxHeight` properties correctly propagate through the configuration merger.
- Fixed metadata injection crashing when `keywords` was provided as an array in a configuration file.
- Removed strict validation from `--mermaid-theme` CLI flag to properly support custom user CSS themes defined via `md2pdf.config.ts`.
- Ensured properties like KaTeX `numbering` and Obsidian `embedNotes` correctly map through the configuration merger.

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

## [0.9.0] - 2026-08-30
### Refactor
- Orchestration logic extracted from monolithic `src/commands/convert.ts`.
- Validation fully extracted into dedicated modules `src/validation/input.ts`, `src/validation/output.ts`, `src/validation/flags.ts`, and `src/validation/index.ts`.
- Cache module relocated from `src/core/cache.ts` to `src/cache/index.ts`.

### Testing
- Built a comprehensive Contract Testing suite in `tests/contract/`.
- 27 matrix tests added for exit-codes covering all error paths and combinations.
- 20 matrix tests added for json-errors covering structured error propagation.

### Fixes
- Addressed hang on missing permissions and 5MB payload limit by hoisting validation before playwright browser launch.
- Assured 100% adherence to established exit code contract.

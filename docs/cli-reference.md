# CLI Reference

## Basic Usage
```bash
md2pdf input.md                    # Convert to input.pdf
md2pdf input.md -o output.pdf     # Custom output path
md2pdf *.md -o ./pdfs/            # Batch convert
```

## Subcommands
| Command | Description |
|---|---|
| `md2pdf init` | Interactive setup to create a `.md2pdf.json` config |
| `md2pdf doctor` | Diagnose environment issues (Node, Playwright, Chrome permissions) |
| `md2pdf daemon start` | Start a persistent background browser for fast conversions |
| `md2pdf daemon stop` | Stop the background browser daemon |
| `md2pdf list-themes` | Print a list of all available built-in CSS themes |
| `md2pdf clear-cache` | Clear the global `.md2pdf-cache` used for incremental rendering |

## Options

| Flag | Type | Default | Description |
|---|---|---|---|
| `-o, --output` | string | `<input>.pdf` | Output file or directory |
| `-v, --version` | boolean | false | Print the current version |
| `-q, --quiet` | boolean | false | Suppress all stdout output (except errors) |
| `--dry-run` | boolean | false | Run conversion process without writing to disk |
| `--toc` | boolean | false | Generate Table of Contents |
| `--toc-depth` | 1-6 | 3 | Heading depth for TOC |
| `--outline` | boolean | false | Generate PDF bookmarks (outline) from Markdown headings |
| `--paper` | A4/Letter/Legal | A4 | Page format |
| `--margin` | CSS unit | 20mm | Page margins |
| `--page-numbers [pos]` | `bottom-center`\|`bottom-right`\|`top-center`\|`top-right` | false | Show page numbers (default: `bottom-center`) |
| `--add-date` | boolean | false | Add current date/time to PDF header (top-right) |
| `--add-filename` | boolean | false | Add document title/filename to PDF header (top-left) |
| `--document-meta` | boolean | false | Super flag: enables `--page-numbers`, `--add-date`, and `--add-filename` together |
| `--font-size` | string (px/pt) | - | Base font size (e.g. 14px or 12pt) |
| `--line-height` | number | - | Base line height (e.g. 1.5) |
| `--theme` | string | default | Theme name or path to custom CSS |
| `--no-title` | boolean | false | Disable automatic document title injection |
| `--header` | boolean | false | Enable running header |
| `--footer` | boolean | false | Enable running footer |
| `--no-math` | boolean | false | Disable KaTeX |
| `--mermaid-theme` | string | auto | Mermaid theme override |
| `--resolve-links` | boolean | false | Resolve wiki link status |
| `--hide-tags` | boolean | false | Hide inline Obsidian tags in PDF output |
| `--debug` | boolean | false | Debug diagnostics |
| `--verbose` | boolean | false | Enable verbose execution logging |
| `--json-errors` | boolean | false | Output errors in JSON format |
| `--config` | string | auto | Path to custom config file |
| `--profile` | string | default | Config profile to apply |
| `-f, --force` | boolean | false | Force overwrite of existing PDFs |
| `--concurrency` | number | os.cpus() | Number of parallel workers for batch mode |
| `--no-cache` | boolean | false | Disable incremental rendering cache |
| `--stdin` | boolean | false | Read input markdown from standard input (stdin) |

## Features

### Batch Rendering
When providing multiple markdown files (e.g. `*.md`), `md2pdf` processes files concurrently up to the `--concurrency` limit. 
It features a live progress bar indicating:
* Completion percentage
* `X/Y` files completed
* Estimated time remaining (ETA)

### Background Daemon
For high-frequency conversions or script integrations, you can avoid the Chromium boot overhead (~200-500ms) by running a background daemon:
```bash
md2pdf daemon start
# Subsequent md2pdf commands will automatically connect to the warm browser
md2pdf file1.md
md2pdf file2.md
md2pdf daemon stop
```
The daemon runs independently and `md2pdf` seamlessly falls back to normal execution if the daemon is not running.

## Limits

- **File Size**: Input markdown files (and piped `stdin`) are limited to **30MB**. This prevents V8 out-of-memory errors and hanging during AST parsing. If this limit is exceeded, an `ERR_FILE_TOO_LARGE` error will be emitted.
- **Complexity**: Blockquote nesting (`>>>>`) is limited to a depth of **200**. Exceeding this triggers an `ERR_DOCUMENT_TOO_COMPLEX` error to prevent excessive recursion limits.

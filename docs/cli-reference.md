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
| `md2pdf list-themes` | Print a list of all available built-in CSS themes |
| `md2pdf clear-cache` | Clear the global `.md2pdf-cache` used for incremental rendering |

## Options

| Flag | Type | Default | Description |
|---|---|---|---|
| `-o, --output` | string | `<input>.pdf` | Output file or directory |
| `--toc` | boolean | false | Generate Table of Contents |
| `--toc-depth` | 1-6 | 3 | Heading depth for TOC |
| `--paper` | A4/Letter/Legal | A4 | Page format |
| `--margin` | CSS unit | 20mm | Page margins |
| `--theme` | string | default | Theme name or path to custom CSS |
| `--no-title` | boolean | false | Disable automatic document title injection |
| `--header` | boolean | false | Enable running header |
| `--footer` | boolean | false | Enable running footer |
| `--no-math` | boolean | false | Disable KaTeX |
| `--mermaid-theme` | string | auto | Mermaid theme override |
| `--resolve-links` | boolean | false | Resolve wiki link status |
| `--no-tags` | boolean | false | Hide inline Obsidian tags in PDF output |
| `--debug` | boolean | false | Debug diagnostics |
| `--verbose` | boolean | false | Enable verbose execution logging |
| `--json-errors` | boolean | false | Output errors in JSON format |
| `--config` | string | auto | Path to custom config file |
| `--profile` | string | default | Config profile to apply |
| `-f, --force` | boolean | false | Force overwrite of existing PDFs |
| `--concurrency` | number | os.cpus() | Number of parallel workers for batch mode |
| `--no-cache` | boolean | false | Disable incremental rendering cache |

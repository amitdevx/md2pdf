# CLI Reference

## Basic Usage
\`\`\`bash
md2pdf input.md                    # Convert to input.pdf
md2pdf input.md -o output.pdf     # Custom output path
md2pdf *.md -o ./pdfs/            # Batch convert
\`\`\`

## Options

| Flag | Type | Default | Description |
|---|---|---|---|
| `-o, --output` | string | `<input>.pdf` | Output file or directory |
| `--toc` | boolean | false | Generate Table of Contents |
| `--toc-depth` | 1-6 | 3 | Heading depth for TOC |
| `--paper` | A4/Letter/Legal | A4 | Page format |
| `--margin` | CSS unit | 20mm | Page margins |
| `--theme` | string | default | Theme name or path to custom CSS |
| `--list-themes` | boolean | false | List all available built-in themes |
| `--no-title` | boolean | false | Disable automatic document title injection |
| `--header` | boolean | false | Enable running header |
| `--footer` | boolean | false | Enable running footer |
| `--no-math` | boolean | false | Disable KaTeX |
| `--mermaid-theme` | string | auto | Mermaid theme override |
| `--resolve-links` | boolean | false | Resolve wiki link status |
| `--debug` | boolean | false | Debug diagnostics |

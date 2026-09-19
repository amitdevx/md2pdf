# CLI Reference

## Basic Usage
Convert a single markdown file to a PDF:
`md2pdf input.md --output result.pdf`

## Complex Flag Combinations

### The "Full Document" Setup
Generates a highly structured PDF with a table of contents, bookmarks, running headers and footers, page numbers, and custom margins.
`md2pdf input.md --output result.pdf --toc --toc-depth 2 --outline --header --footer --page-numbers bottom-right --add-filename --margin 20mm`

### Security and Watermarking
Generates a protected PDF with an AES-256 password and a diagonal watermark.
`md2pdf confidential.md --output secure.pdf --password "mysecret123" --watermark "CONFIDENTIAL"`

### Styling & Obsidian Features
Enables Obsidian Vault resolving, custom hyperlink coloring, and theme selection.
`md2pdf vault/note.md --output out.pdf --vault-root ./vault --theme obsidian-dark --link-color "#4287f5" --no-link-underline`

### Cover Pages
Prepends an image, PDF, or markdown file as a cover page before your main content.
`md2pdf report.md --output final.pdf --cover-page assets/cover.png`

### Batch Processing and Merging
Processes multiple files and merges them into a single PDF output.
`md2pdf "chapters/*.md" --output full-book.pdf --merge`

### Background Watching (Daemon)
Watches input files for changes and automatically rebuilds the PDF in the background.
`md2pdf draft.md --output live.pdf --watch`

## All Available Flags
- `-V, --version`                 output the current version
- `-o, --output <output>`         Output PDF file (or directory if multiple inputs)
- `--toc`                         Generate a Table of Contents
- `--toc-depth <depth>`           Maximum heading depth for TOC (1-6)
- `--toc-title <title>`           Title for the TOC section
- `--font-size <px>`              Base font size (e.g. 14px or 12pt)
- `--line-height <ratio>`         Base line height (e.g. 1.5)
- `--header`                      Enable default running header
- `--footer`                      Enable default running footer
- `--page-numbers [position]`     Show page numbers (bottom-center, bottom-right, top-center, top-right)
- `--add-date`                    Add the current date/time to the PDF header
- `--add-filename`                Add the filename/title to the PDF header
- `--document-meta`               Add page numbers, date, and filename all at once
- `--outline`                     Generate PDF bookmarks/outline from headings
- `--header-template <template>`  Custom HTML template for header
- `--footer-template <template>`  Custom HTML template for footer
- `--paper <format>`              Page format: A4, Letter, Legal (default: "A4")
- `--margin <margin>`             Page margin (e.g., 20mm, 1in, 0) (default: "20mm")
- `--hr-page-break`               Treat --- as a page break
- `--h1-new-page`                 Force a page break before each H1 heading
- `--theme <theme>`               Active md2pdf theme (default, github, obsidian-light, etc.)
- `--mermaid-theme <theme>`       Override theme for Mermaid diagrams (default, dark, base, neutral)
- `--mermaid-timeout <ms>`        Timeout for Mermaid rendering in milliseconds
- `--no-math`                     Disable KaTeX math rendering for LaTeX equations
- `--offline`                     Disable outbound network requests for remote assets
- `-r, --recursive`               Recursively process all markdown files in given directories
- `--merge`                       Concatenate multiple converted Markdown files into a single unified output PDF
- `--password <pass>`             Encrypt the generated PDF with an AES-256 password
- `--cover-page <file>`           Prepend an image, PDF, or Markdown file as a cover page
- `--no-link-underline`           Remove underlines from hyperlinks
- `--link-color <color>`          Custom CSS color for hyperlinks
- `--watch`                       Watch input files for changes and automatically rebuild
- `--watermark <text>`            Overlay a diagonal vector watermark across the generated PDF natively
- `--split-by-heading <level>`    Split AST at H1 or H2 boundaries (1 or 2)
- `--debug`                       Enable debug diagnostics
- `--verbose`                     Enable verbose output
- `--stdin`                       Read markdown from stdin instead of files
- `--no-title`                    Disable automatic document title injection from frontmatter/filename
- `--json-errors`                 Output errors in JSON format
- `--hide-tags`                   Hide inline Obsidian tags in PDF output
- `--resolve-links`               Attempt to visually indicate resolvable vs unresolvable wiki links
- `--config <path>`               Path to configuration file
- `--profile <name>`              Configuration profile to use
- `--vault-root <path>`           Path to the Obsidian vault root directory
- `--attachment-folder <path>`    Default attachment folder for unresolved embeds
- `--max-attachment-size <mb>`    Max attachment size in MB (default: 10)
- `--no-cache`                    Disable incremental rendering cache
- `--concurrency <n>`             Limit concurrent file processing workers
- `--browser <path>`              Path to custom Chromium/Chrome executable
- `-f, --force`                   Force overwrite of existing PDF files
- `--dry-run`                     Preview which files would be processed without actually converting them
- `-q, --quiet`                   Suppress all output except errors
- `-h, --help`                    display help for command

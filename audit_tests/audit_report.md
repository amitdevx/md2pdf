# MD2PDF v0.9.9 Command Audit Report

### 1. No arguments
```bash
$ md2pdf
Usage: md2pdf [options] [command] [inputs...]

Convert Markdown to PDF with Mermaid diagrams, KaTeX math, Obsidian syntax,
syntax highlighting, batch processing, TOC, and custom themes. CLI + Node.js
API.

Arguments:
  inputs                        Input markdown files (supports wildcards like
                                *.md)

Options:
  -V, --version                 output the current version
  -o, --output <output>         Output PDF file (or directory if multiple
                                inputs)
  --toc                         Generate a Table of Contents
  --toc-depth <depth>           Maximum heading depth for TOC (1-6)
  --toc-title <title>           Title for the TOC section
  --font-size <px>              Base font size (e.g. 14px or 12pt)
  --line-height <ratio>         Base line height (e.g. 1.5)
  --header                      Enable default running header
  --footer                      Enable default running footer
  --page-numbers [position]     Show page numbers (bottom-center, bottom-right,
                                top-center, top-right)
  --add-date                    Add the current date/time to the PDF header
  --add-filename                Add the filename/title to the PDF header
  --document-meta               Add page numbers, date, and filename all at
                                once
  --outline                     Generate PDF bookmarks/outline from headings
  --header-template <template>  Custom HTML template for header
  --footer-template <template>  Custom HTML template for footer
  --paper <format>              Page format: A4, Letter, Legal (default: "A4")
  --margin <margin>             Page margin (e.g., 20mm, 1in, 0) (default:
                                "20mm")
  --hr-page-break               Treat --- as a page break
  --h1-new-page                 Force a page break before each H1 heading
  --theme <theme>               Active md2pdf theme (default, github,
                                obsidian-light, etc.)
  --mermaid-theme <theme>       Override theme for Mermaid diagrams (default,
                                dark, base, neutral)
  --mermaid-timeout <ms>        Timeout for Mermaid rendering in milliseconds
  --no-math                     Disable KaTeX math rendering for LaTeX
                                equations
  --offline                     Disable outbound network requests for remote
                                assets
  -r, --recursive               Recursively process all markdown files in given
                                directories
  --merge                       Concatenate multiple converted Markdown files
                                into a single unified output PDF
  --password <pass>             Encrypt the generated PDF with an AES-256
                                password
  --cover-page <file>           Prepend an image, PDF, or Markdown file as a
                                cover page
  --no-link-underline           Remove underlines from hyperlinks
  --link-color <color>          Custom CSS color for hyperlinks
  --watch                       Watch input files for changes and automatically
                                rebuild
  --watermark <text>            Overlay a diagonal vector watermark across the
                                generated PDF natively
  --split-by-heading <level>    Split AST at H1 or H2 boundaries (1 or 2)
  --debug                       Enable debug diagnostics
  --verbose                     Enable verbose output
  --stdin                       Read markdown from stdin instead of files
  --no-title                    Disable automatic document title injection from
                                frontmatter/filename
  --json-errors                 Output errors in JSON format
  --hide-tags                   Hide inline Obsidian tags in PDF output
  --resolve-links               Attempt to visually indicate resolvable vs
                                unresolvable wiki links
  --config <path>               Path to configuration file
  --profile <name>              Configuration profile to use
  --vault-root <path>           Path to the Obsidian vault root directory
  --attachment-folder <path>    Default attachment folder for unresolved embeds
  --max-attachment-size <mb>    Max attachment size in MB (default: 10)
  --no-cache                    Disable incremental rendering cache
  --concurrency <n>             Limit concurrent file processing workers
  --browser <path>              Path to custom Chromium/Chrome executable (or
                                use CHROME_PATH, BROWSER_PATH, or
                                MD2PDF_BROWSER)
  -f, --force                   Force overwrite of existing PDF files
  --dry-run                     Preview which files would be processed without
                                actually converting them
  -q, --quiet                   Suppress all output except errors
  -h, --help                    display help for command

Commands:
  doctor [options]              Check system health and prerequisites
  init                          Interactive guided setup for new environments
  daemon <action>               Manage the md2pdf background daemon
  list-themes                   List all available built-in themes
  clear-cache                   Clear the incremental rendering cache

Exit Codes:
  0: Success
  1: Usage, validation, or configuration error (e.g., missing file, bad YAML)
  2: Runtime error (e.g., missing browser, document too complex)

Exit Code: 1
```

### 2. Missing file
```bash
$ md2pdf missing.md

  ✖ Error: File Not Found
    File not found

Exit Code: 1
```

### 3. Basic valid conversion
```bash
$ md2pdf valid.md
✔ valid.pdf (cached)
Exit Code: 0
```

### 4. Empty file
```bash
$ md2pdf empty.md
- Converting...
➖ Skipped: Output file '/home/amitdevx/Code/md2pdf/audit_tests/empty.pdf' already exists (use --force to overwrite).
Exit Code: 0
```

### 5. Corrupted binary file as markdown
```bash
$ md2pdf corrupt.md
- Converting...
➖ Skipped: Output file '/home/amitdevx/Code/md2pdf/audit_tests/corrupt.pdf' already exists (use --force to overwrite).
Exit Code: 0
```

### 6. Broken frontmatter
```bash
$ md2pdf broken.md
- Converting...
➖ Skipped: Output file '/home/amitdevx/Code/md2pdf/audit_tests/broken.pdf' already exists (use --force to overwrite).
Exit Code: 0
```

### 7. Output to non-existent directory
```bash
$ md2pdf valid.md -o /root/forbidden.pdf

  ✖ Error: Access Denied
    Cannot write output to protected system directory.

Exit Code: 1
```

### 8. Output flag is a directory
```bash
$ md2pdf valid.md -o .
✖ Output path '.' is a directory, not a file.
  Provide a full file path, e.g. --output report.pdf
Exit Code: 1
```

### 9. Non-existent theme
```bash
$ md2pdf valid.md --theme unknown-theme

  ✖ Error: Theme Load Error
    Failed to load theme "unknown-theme": Theme not found: unknown-theme
    Valid built-in themes are: academic, default, dracula, github, nord, obsidian-dark, obsidian-light

Exit Code: 2
```

### 10. Invalid split-by-heading depth
```bash
$ md2pdf valid.md --split-by-heading -1

  ✖ Error: Invalid Argument
    error: option '--split-by-heading <level>' argument '-1' is invalid. must be 1 or 2

Exit Code: 1
```

### 11. Cover page missing
```bash
$ md2pdf valid.md --cover-page nonexistent.pdf
- Converting...
➖ Skipped: Output file '/home/amitdevx/Code/md2pdf/audit_tests/valid.pdf' already exists (use --force to overwrite).
Exit Code: 0
```

### 12. Output to same file (self-referential cover)
```bash
$ md2pdf valid.md --cover-page valid.md.pdf
- Converting...
➖ Skipped: Output file '/home/amitdevx/Code/md2pdf/audit_tests/valid.pdf' already exists (use --force to overwrite).
Exit Code: 0
```

### 13. Merge without inputs
```bash
$ md2pdf --merge
✖ No input files found matching the provided arguments.
Exit Code: 1
```

### 14. Merge with single file
```bash
$ md2pdf valid.md --merge
✔ valid.pdf (cached)
Exit Code: 0
```

### 15. Merge with missing file
```bash
$ md2pdf valid.md missing.md --merge
- Starting batch conversion...
✔ md2pdf-merge-f58a100069ba-valid.pdf (cached)
- Converting (2/2) files [100%] ~0s remaining
✖ /home/amitdevx/Code/md2pdf/audit_tests/missing.md - File not found

1 succeeded, 1 failed in 2.5s
Exit Code: 1
```

### 16. PDF as main input (should fail securely)
```bash
$ md2pdf valid.pdf

✖ Unexpected CLI Error: Error: ERR_INVALID_INPUT: Cannot process PDF file 'valid.pdf' as main input. md2pdf converts Markdown to PDF. Existing PDFs can only be attached as cover pages.
    at Command.at (file:///home/amitdevx/Code/md2pdf/dist/cli/index.js:55:2133)
    at Command.listener [as _actionHandler] (/home/amitdevx/Code/md2pdf/node_modules/commander/lib/command.js:494:17)
    at /home/amitdevx/Code/md2pdf/node_modules/commander/lib/command.js:1296:65
    at Command._chainOrCall (/home/amitdevx/Code/md2pdf/node_modules/commander/lib/command.js:1193:12)
    at Command._parseCommand (/home/amitdevx/Code/md2pdf/node_modules/commander/lib/command.js:1296:27)
    at Command.parseAsync (/home/amitdevx/Code/md2pdf/node_modules/commander/lib/command.js:936:16)
    at file:///home/amitdevx/Code/md2pdf/dist/cli/index.js:71:616
    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)
    at async node:internal/modules/esm/loader:647:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)
Exit Code: 1
```

### 17. Stdin piped correctly
```bash
$ echo '# Piped' | md2pdf --stdin -o piped.pdf
Exit Code: 0
```

### 18. Stdin empty pipe
```bash
$ cat /dev/null | md2pdf --stdin
Exit Code: 0
```

### 19. Missing required argument for flag
```bash
$ md2pdf valid.md --watermark

  ✖ Error: Invalid Argument
    error: option '--watermark <text>' argument missing

Exit Code: 1
```

### 20. Directory as input
```bash
$ md2pdf somedir
✖ No input files found matching the provided arguments.
Exit Code: 1
```


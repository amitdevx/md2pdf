<div align="center">

# md2pdf

[![npm version](https://img.shields.io/npm/v/@amitdevx/md2pdf.svg)](https://www.npmjs.com/package/@amitdevx/md2pdf)
[![npm downloads](https://img.shields.io/npm/dm/@amitdevx/md2pdf.svg)](https://www.npmjs.com/package/@amitdevx/md2pdf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://github.com/amitdevx/md2pdf/actions/workflows/ci.yml/badge.svg)](https://github.com/amitdevx/md2pdf/actions/workflows/ci.yml)

<h3>Production-quality Markdown to PDF rendering engine for Node.js.</h3>

</div>

## Overview

`md2pdf` is a high-fidelity Markdown-to-PDF rendering engine. It leverages the Unified ecosystem (Remark/Rehype) for robust AST manipulation and utilizes Playwright to drive headless Chromium. This ensures that the generated PDF perfectly reflects modern web standards, complete with professional typography, precise margins, and correct pagination.

## Features

For detailed release notes and changelogs, please visit the [GitHub Releases](https://github.com/amitdevx/md2pdf/releases) page.

### Available (v0.2.2)
- **High-Fidelity Rendering:** Utilizes Chromium via Playwright for native print CSS capabilities.
- **Unified Pipeline:** Built entirely on remark and rehype ASTs for robustness.
- **Professional Typography:** Modular CSS system optimized for readability and print with Inter and JetBrains Mono.
- **Syntax Highlighting:** Integrated shiki plugin for syntax highlighting across 20+ languages.
- **Mermaid Diagrams:** Native diagram generation directly from code blocks with intrinsic SVG scaling and error reporting.
- **Diagnostic Tooling:** Run `md2pdf doctor` and `md2pdf init` for comprehensive pipeline debugging and auto-repair.
- **GitHub Flavored Markdown:** Natively supports GFM tables and strikethrough.
- **Table of Contents:** Auto-generate hyperlinked TOC with depth configuration.
- **Footnotes:** Standard GFM footnotes with bidirectional backlinks. Note: inline footnote syntax (`^[...]`) is not supported.
- **Document Metadata:** Automatically extracts YAML frontmatter to inject native PDF metadata properties.
- **Headers, Footers & Page Breaks:** Inject custom HTML headers/footers with dynamic page numbers and control pagination manually or automatically.

### Coming Soon
- **Math Rendering:** LaTeX equations support via KaTeX.
- **Obsidian Compatibility:** Support for wiki links, callouts, and embeds.
- **Configuration and Theming:** Advanced CLI options and custom CSS themes.
- **Plugin System:** Extensible architecture for custom rendering logic.

## Installation

```bash
# Install globally
npm install -g @amitdevx/md2pdf

# Or use locally within a project
npm install @amitdevx/md2pdf
```

## CLI Usage

Generate a PDF from a single Markdown file:
```bash
md2pdf README.md
```

Specify a custom output path and generate a Table of Contents:
```bash
md2pdf input.md --output custom.pdf --toc
```

Convert with custom paper size and margins:
```bash
md2pdf input.md --paper Letter --margin 15mm
```

Force a page break before every H1 heading:
```bash
md2pdf input.md --h1-new-page
```

### Environment Diagnostics & Setup
Initialize a new environment and download dependencies automatically:
```bash
md2pdf init
```

Check your system health and Playwright pipeline status:
```bash
md2pdf doctor
```

Print advanced internal variables and stack traces if an error occurs:
```bash
md2pdf input.md --debug
```

> **Note:** Typography uses Inter and JetBrains Mono served from Google Fonts CDN. Internet access is required during conversion for correct typography. Offline environments will fall back to system fonts.

## Library Usage

Embed the rendering engine directly in your Node.js applications:

```typescript
import { convert } from '@amitdevx/md2pdf';

const result = await convert({
  input: 'README.md',
  output: 'README.pdf',
  paper: 'A4',
  margin: '20mm',
  toc: true
});
console.log(`Render time: ${result.renderTimeMs}ms`);
```

## Development Setup

```bash
git clone https://github.com/amitdevx/md2pdf.git
cd md2pdf
npm install
npx playwright install chromium
```

## Contributing

Please refer to `docs/contributing.md` for our guidelines, branch naming conventions, and coding standards.

## License

MIT License. See `LICENSE` for details.

## Author

[Amit Divekar](https://amitdevx.tech)

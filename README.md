<div align="center">

# md2pdf

<p align="center">
  <a href="https://www.npmjs.com/package/@amitdevx/md2pdf"><img src="https://img.shields.io/npm/v/@amitdevx/md2pdf.svg?style=flat-square" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@amitdevx/md2pdf"><img src="https://img.shields.io/npm/dt/@amitdevx/md2pdf.svg?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/amitdevx/md2pdf/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@amitdevx/md2pdf.svg?style=flat-square" alt="License: MIT"></a>
</p>

<h3>Production-quality Markdown to PDF rendering engine for Node.js.</h3>

</div>

## Overview

`md2pdf` is a high-fidelity Markdown-to-PDF rendering engine. It leverages the Unified ecosystem (Remark/Rehype) for robust AST manipulation and utilizes Playwright to drive headless Chromium. This ensures that the generated PDF perfectly reflects modern web standards, complete with professional typography, precise margins, and correct pagination.

## Features

For detailed release notes and changelogs, please visit the [GitHub Releases](https://github.com/amitdevx/md2pdf/releases) page.

### Available (v0.5.0)
- **Configuration (New in v0.5.0):** Advanced persistent configuration file support (`md2pdf.config.ts`, `json`, `yaml`), profiles (`--profile`), and fully typed programmatic definitions. See [Configuration Guide](docs/configuration.md).
- **Obsidian Compatibility (New in v0.4.1/v0.4.2):** Native parsing and rendering for callouts, wiki-links (`[[Link]]`), tags, embeds (`![[Image.png]]`), highlight syntax (`==highlight==`), and YAML frontmatter.
- **High-Fidelity Rendering:** Utilizes Chromium via Playwright for native print CSS capabilities.
- **Math Rendering (New in v0.3.0):** Print-perfect LaTeX inline and display math via KaTeX. Full support for matrices, environments, and macros with zero-dependency embedded fonts.
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
- **Theming:** Custom CSS themes and layout overrides.
- **Plugin System:** Extensible architecture for custom rendering logic.

## Installation

```bash
# Install globally
npm install -g @amitdevx/md2pdf
md2pdf init

# Or use locally within a project
npm install @amitdevx/md2pdf
npx md2pdf init
```

> **Note:** For security and compliance with npm v12 `allowScripts` defaults, we no longer automatically download browser binaries during install. You **must** run `md2pdf init` after installation to fetch the required Chromium dependencies.

## CLI Usage

Generate a PDF from a single Markdown file:
```bash
md2pdf README.md
```

Process multiple files at once (Batch Mode) using wildcards (new in v0.5.0):
```bash
md2pdf "docs/*.md" --output out_dir/
```
*(Batch mode intelligently reuses a single Chromium instance for 10x faster processing and sequential memory safety)*

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
npx md2pdf init
```

## Contributing

Please refer to `docs/contributing.md` for our guidelines, branch naming conventions, and coding standards.

## License

MIT License. See `LICENSE` for details.

## Author

[Amit Divekar](https://amitdevx.tech)

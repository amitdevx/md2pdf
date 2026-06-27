# md2pdf

Production-quality Markdown to PDF rendering engine.

## Overview

`md2pdf` is a modular, high-fidelity Markdown-to-PDF rendering engine for Node.js. 

It was built because existing solutions often fail to handle complex CSS, rely on deprecated browser engines, or lack proper extensibility. `md2pdf` leverages the `unified` ecosystem (Remark/Rehype) for robust Abstract Syntax Tree (AST) manipulation and utilizes Playwright to drive headless Chromium. This ensures that the generated PDF perfectly reflects modern web standards, complete with professional typography, precise margins, and correct pagination.

## Features (v0.1.0)

- **High-Fidelity Rendering:** Utilizes Chromium via Playwright for native print CSS capabilities.
- **Unified Pipeline:** Built entirely on `remark` and `rehype` ASTs for robustness.
- **Professional Typography:** Modular CSS system optimized for readability and print with `Inter` and `JetBrains Mono`.
- **Core Markdown:** Supports headings, paragraphs, lists, bold, italics, blockquotes, code blocks, and local images.
- **Syntax Highlighting:** Integrated `shiki` internal plugin for beautiful syntax highlighting across 20+ languages.
- **GitHub Flavored Markdown:** Natively supports GFM tables and strikethrough.

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Programmatic API Reference](./docs/api.md)

## Planned Roadmap

- Native Mermaid diagram execution
- KaTeX math rendering
- Obsidian compatibility (wiki links, embeds, callouts)
- Advanced CLI features (watch mode, theming)
- Extensible plugin system

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

Specify a custom output path:

```bash
md2pdf input.md --output custom.pdf
```

## Library Usage

You can embed the rendering engine directly in your Node.js applications.

```typescript
import { convert } from '@amitdevx/md2pdf';

const result = await convert({
  input: 'README.md',
  output: 'README.pdf',
  paper: 'A4',
  margin: '20mm'
});
console.log(result.renderTimeMs);
```

## Development Setup

```bash
git clone https://github.com/amitdevx/md2pdf.git
cd md2pdf
npm install
npx playwright install chromium
```

## Contributing

Please refer to `docs/CONTRIBUTING.md` for our guidelines, branch naming conventions, and coding standards.

## License

MIT License. See `LICENSE` for details.

## Author

Amit Divekar

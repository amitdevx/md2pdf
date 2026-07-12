# Getting Started with md2pdf

`@amitdevx/md2pdf` is a production-quality engine for converting Markdown into beautiful PDF documents.

## Installation

```bash
# Global installation (for CLI usage)
npm install -g @amitdevx/md2pdf

# Local installation (for programmatic usage)
npm install @amitdevx/md2pdf
```

## CLI Usage

The most common way to use `md2pdf` is via the command line.

### Basic Conversion
```bash
md2pdf document.md
```
This will automatically generate `document.pdf` in the same directory.

### Batch Processing (New in v0.5.0)
You can process multiple files concurrently while sharing a single Chromium instance, keeping memory footprint low and drastically improving speed:
```bash
md2pdf "docs/*.md" --output out_dir/
```

### Specify Output Path
```bash
md2pdf document.md --output custom-name.pdf
```

### Generate Table of Contents
```bash
md2pdf document.md --toc --toc-depth 3
```

### Add Headers and Footers
```bash
md2pdf document.md --header --footer
```

## Programmatic API Usage

If you're building a Node.js application, you can use the `convert` API directly.

```ts
import { convert } from '@amitdevx/md2pdf';

async function main() {
  const result = await convert({
    input: 'document.md',
    output: 'document.pdf',
    paper: 'A4',
    margin: '20mm'
  });
  
  console.log(`Rendered PDF in ${result.renderTimeMs}ms`);
}

main();
```

See [api.md](./api.md) for full programmatic API documentation.

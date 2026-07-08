# Math Support (KaTeX)

`md2pdf` includes native, print-perfect LaTeX equation rendering powered by KaTeX.

## Features

- **High-Fidelity Rendering**: Equations are rendered using KaTeX with inline base64-encoded WOFF2 fonts. This guarantees no flash of unstyled math (FOUT), no external CDN dependencies, and perfect offline rendering.
- **Unified Pipeline**: Built securely into the AST pipeline via `remark-math` and `rehype-katex`.
- **Customizable**: Supports custom macros, strict error modes, and explicit enable/disable settings.

## Basic Syntax

### Inline Math
Surround equations with single dollar signs: `$...$`

**Example:**
The energy-mass equivalence is $E = mc^2$, where $c$ is the speed of light.

### Display Math
Surround equations with double dollar signs: `$$...$$`

**Example:**
$$
f(x) = \int_{-\infty}^\infty \hat f(\xi)\,e^{2 \pi i \xi x} \,d\xi
$$

## Configuration

In the Node.js API, math rendering can be configured using the `math` option:

```typescript
import { convert } from '@amitdevx/md2pdf';

await convert({
  input: 'math.md',
  output: 'math.pdf',
  math: {
    enabled: true,         // Explicitly enable/disable math
    macros: {              // Define custom LaTeX macros
      "\\R": "\\mathbb{R}",
      "\\trace": "\\text{tr}"
    },
    strict: false          // Set to true to throw hard errors on invalid LaTeX
  }
});
```

### CLI

Math rendering is enabled by default. To disable it, use the `--no-math` flag (if supported) or configure it through a config file when available.
```bash
md2pdf document.md --math
```

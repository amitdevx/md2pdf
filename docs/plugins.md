# Plugin System Overview

md2pdf uses a powerful plugin architecture that allows you to extend the core functionality. Plugins can hook into different stages of the rendering pipeline: parsing markdown, manipulating the HTML AST, hooking into the Playwright rendering lifecycle, injecting custom themes, and adding new export formats.

## Plugin Types

There are 5 types of plugins:

### 1. Markdown Plugin
Extends the remark (Markdown AST) processing stage.
Use cases: Custom syntax, preprocessing, custom link behavior.

### 2. HTML Plugin
Extends the rehype (HTML AST) processing stage.
Use cases: Class injection, custom element wrapping, accessibility.

### 3. Render Plugin
Hooks into the Playwright rendering lifecycle.
Use cases: Watermarks, PDF encryption, custom fonts, screenshot capture.

### 4. Theme Plugin
Registers a theme so it can be used by name.
Use cases: Brand themes, organization-wide themes, distributed via npm.

### 5. Export Plugin
Adds an alternative output format.
Use cases: PNG/JPEG rasterization, self-contained HTML, EPUB.

## Registration

Plugins are registered in `md2pdf.config.ts`:

```ts
import { defineConfig } from '@amitdevx/md2pdf'
import watermarkPlugin from 'md2pdf-plugin-watermark'
import myTheme from './my-theme'

export default defineConfig({
  plugins: [
    watermarkPlugin({ text: 'CONFIDENTIAL', opacity: 0.1 }),

    // Or inline plugin definition:
    {
      type: 'render',
      name: 'my-render-hook',
      hooks: {
        afterPdf: async (pdf, ctx) => {
          console.log(`Rendered ${ctx.inputPath} — ${pdf.length} bytes`)
          return pdf
        }
      }
    },

    // Theme plugin:
    {
      type: 'theme',
      name: 'my-brand',
      theme: myTheme,
    }
  ],
})
```

For more details on authoring your own plugins, see [PLUGIN_AUTHORING.md](./PLUGIN_AUTHORING.md).

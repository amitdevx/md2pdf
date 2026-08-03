# Plugin Authoring Guide

This guide explains how to author and publish custom plugins for md2pdf.

## Overview

Plugins in md2pdf are simple objects that conform to specific interfaces. You can write them inline in your config file, or package them as npm modules.

To get started, you can use the factory helpers provided by the core package to ensure strict typing:

```ts
import { 
  createMarkdownPlugin, 
  createHtmlPlugin, 
  createRenderPlugin, 
  createThemePlugin, 
  createExportPlugin 
} from '@amitdevx/md2pdf';
```

## Plugin Types

### 1. Markdown Plugin

Markdown plugins allow you to hook into the `remark` processing pipeline. You can write custom `unified` plugins to parse new syntax or transform the AST.

```ts
import { createMarkdownPlugin } from '@amitdevx/md2pdf';
// Your unified plugin here

export const myMarkdownPlugin = createMarkdownPlugin({
  name: 'my-custom-markdown',
  plugin: myUnifiedPlugin,
  options: { /* options for the unified plugin */ }
});
```

### 2. HTML Plugin

HTML plugins let you hook into the `rehype` processing pipeline.

```ts
import { createHtmlPlugin } from '@amitdevx/md2pdf';
import { visit } from 'unist-util-visit';

export const myPlugin = createHtmlPlugin({
  name: 'highlight-pre',
  plugin: () => (tree) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName === 'pre') {
        node.properties.className = [...(node.properties.className ?? []), 'custom-pre']
      }
    })
  }
});
```

### 3. Render Plugin

Render plugins give you access to the rendering pipeline, from raw HTML before rendering, to the Playwright Page object, and finally the resulting PDF buffer.

```ts
import { createRenderPlugin } from '@amitdevx/md2pdf';
import { PDFDocument } from 'pdf-lib';

export default function watermark(options: { text: string; opacity?: number }) {
  return createRenderPlugin({
    name: 'watermark',
    hooks: {
      afterPdf: async (pdf, ctx) => {
        const doc = await PDFDocument.load(pdf);
        // ... add watermark text to each page
        return Buffer.from(await doc.save());
      }
    }
  });
}
```

### 4. Theme Plugin

Theme plugins allow you to register custom CSS themes to be used in configuration.

```ts
import { createThemePlugin } from '@amitdevx/md2pdf';

export const brandTheme = createThemePlugin({
  name: 'my-brand',
  theme: {
    css: 'body { color: #333; }',
    shikiTheme: 'github-dark'
  }
});
```

### 5. Export Plugin

Export plugins allow you to define custom exports alongside or instead of PDF (e.g. generating a PNG or HTML file).

```ts
import { createExportPlugin } from '@amitdevx/md2pdf';

export const htmlExport = createExportPlugin({
  name: 'html-export',
  format: 'html',
  extension: 'html',
  export: async (html, ctx) => {
    return Buffer.from(html, 'utf-8');
  }
});
```

## The RenderContext API

In Render and Export plugins, you have access to a context object:

```ts
export interface RenderContext {
  /** Resolved input file path */
  inputPath: string
  /** Target output file path */
  outputPath: string
  /** Parsed frontmatter (from gray-matter) */
  frontmatter: Record<string, unknown>
  /** Final merged options for this render */
  options: ResolvedMd2PdfConfig
  /** Logger — use instead of console.log */
  logger: Logger
}
```

## Plugin Lifecycle

Plugins can optionally define `setup` and `teardown` hooks. 
- `setup(registry)`: Called once during initialization.
- `teardown()`: Called after all processing is complete.

## Security & Architecture Hardening

Starting with `v0.7.1`, the plugin architecture implements strict security and reliability boundaries:

1. **Immutable Context**: The `RenderContext` and `ExportContext` objects passed to plugins are deeply frozen. Plugins can read configuration and metadata, but they cannot maliciously or accidentally mutate `ctx.options` or `ctx.frontmatter`.
2. **Safe Playwright Proxy**: When a `RenderPlugin` receives the Playwright `Page` object in the `afterPageLoad` hook, it is wrapped in a restrictive proxy. Destructive methods like `page.close()`, `page.goto()`, `page.pdf()`, and `page.evaluateHandle()` are blocked.
3. **Strict Timeouts**: All asynchronous hooks (`beforeRender`, `afterPageLoad`, `afterPdf`) are bounded by a strict 10,000ms execution timeout. If a plugin hangs or deadlocks, the core engine will catch the timeout, abort the plugin, and automatically evict it from the registry to prevent cascading failures in batch processing.

## Publishing to npm

If you wish to share your plugin, simply publish it as an npm package. For best practices, we recommend prefixing your package name with `md2pdf-plugin-` (e.g. `md2pdf-plugin-watermark`). Users can then install it and add it to their configuration file.

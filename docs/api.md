# Programmatic API Reference

The `@amitdevx/md2pdf` package exposes a primary `convert` function along with its associated types.

## `convert(options)`

Asynchronously converts a Markdown file to a PDF.

```ts
import { convert, ConvertOptions, ConvertResult } from '@amitdevx/md2pdf';

const result: ConvertResult = await convert(options);
```

### `ConvertOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `input` | `string` | **Required** | The path to the input Markdown file. |
| `output` | `string` | **Required** | The path where the PDF will be saved. |
| `theme` | `string` | `'default'` | The CSS theme to apply (feature in progress). |
| `paper` | `'A4' \| 'Letter' \| 'Legal'` | `'A4'` | The paper format for the PDF. |
| `landscape` | `boolean` | `false` | Page orientation. |
| `margin` | `string` | `'20mm'` | The margin string applied to all sides. |
| `toc` | `boolean` | `false` | Enables Table of Contents generation. |
| `tocDepth` | `number` | `3` | Maximum heading depth to include in the TOC. |
| `tocTitle` | `string` | `'Table of Contents'` | Title used for the TOC section. |
| `metadata` | `PdfMetadata` | `undefined` | PDF Document metadata overrides (author, title, etc). |
| `header` | `boolean \| { template?: string }` | `undefined` | Enables running headers on PDF pages. |
| `footer` | `boolean \| { template?: string }` | `undefined` | Enables running footers on PDF pages. |
| `pageBreaks` | `{ h1NewPage?: boolean, hrAsPageBreak?: boolean }` | `undefined` | Configuration for automatic page breaks. |
| `mermaid` | `object` | `{ enabled: true }` | Configuration for Mermaid diagram rendering. |
| `math` | `object` | `{ enabled: true }` | Configuration for KaTeX math rendering. |
| `obsidian` | `object` | `undefined` | Compatibility options for Obsidian syntax. |
| `sharedBrowser` | `Browser` | `undefined` | Inject an existing Playwright `Browser` instance (optimizes batch processing). |

### `ConvertResult`

| Property | Type | Description |
|----------|------|-------------|
| `outputPath` | `string` | The absolute path to the generated PDF. |
| `pageCounts` | `number` | The number of pages in the generated PDF (0 if not parsed). |
| `renderTimeMs` | `number` | The total execution time of the conversion in milliseconds. |
| `warnings` | `string[]` | A list of non-fatal warnings generated during conversion. |
| `metadata` | `PdfMetadata` | The final computed metadata injected into the PDF. |

### `PdfMetadata`

| Property | Type | Description |
|----------|------|-------------|
| `title` | `string` | The PDF document title. |
| `author` | `string` | The PDF document author. |
| `subject` | `string` | The PDF document subject/description. |
| `keywords` | `string` | Comma-separated keywords for the PDF. |
| `creator` | `string` | Software used to create the document (defaults to `md2pdf`). |
| `producer` | `string` | PDF generator (defaults to `Playwright`). |
| `creationDate` | `Date` | Creation timestamp. |

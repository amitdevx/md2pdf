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
| `margin` | `string` | `'20mm'` | The margin string applied to all sides. |

### `ConvertResult`

| Property | Type | Description |
|----------|------|-------------|
| `outputPath` | `string` | The absolute path to the generated PDF. |
| `pageCounts` | `number` | The number of pages in the generated PDF (0 if not parsed). |
| `renderTimeMs` | `number` | The total execution time of the conversion in milliseconds. |
| `warnings` | `string[]` | A list of non-fatal warnings generated during conversion. |

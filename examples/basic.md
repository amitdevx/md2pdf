# Welcome to md2pdf

This is a demonstration of the `md2pdf` rendering engine.

## Typography

Here is a paragraph of text to demonstrate typography. The default theme is designed to look clean, professional, and highly readable both on screen and when printed.

### Emphasized text

You can use **bold text**, *italic text*, or `inline code` effortlessly.

## Lists

1. First ordered item
2. Second ordered item
   * Nested unordered item
   * Another nested item

## Tables

| Feature | Supported in v0.0.1 |
| --- | --- |
| Headings | Yes |
| Tables | Yes |
| Mermaid | No |

## Blockquotes

> "The details are not the details. They make the design."
> — Charles Eames

## Code Blocks

```typescript
import { convert } from 'md2pdf';

await convert({
  input: 'basic.md',
  output: 'basic.pdf'
});
```

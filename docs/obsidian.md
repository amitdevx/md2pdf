# Obsidian Compatibility

The `@amitdevx/md2pdf` engine provides support for selected Obsidian syntax and note structures when exporting to PDF. 

## Supported Syntax (v0.6.0)

Supports selected Obsidian syntax, including callouts, wiki links, and embeds. Output may differ from Obsidian's native exporter. The following features are currently supported:

### Wiki Links
Standard Obsidian internal links using double brackets are parsed and rendered as styled text spans. 
- Basic links: `[[Page Name]]`
- Aliased links: `[[Page Name|Alias]]`
- Section links: `[[Page Name#Section]]`

*Note: In PDF output, wiki links are treated as internal references. If `--resolve-links` is disabled (default), they appear as muted text to signify an unresolved cross-reference.*

### Callouts
Standard Obsidian callout blocks are supported with styled containers and Lucide icons.
- **Native SVGs**: We use exact Lucide SVG inline icons, eliminating standard text emojis.
- **Exact Colors**: Backgrounds and borders match Obsidian's strict RGBA values (e.g. Cyan for `[!important]`).
- Supported types: `note`, `info`, `tip`, `success`, `question`, `warning`, `failure`, `danger`, `example`, `quote`, `important`, `summary`, etc.
- Foldable syntax (`+`, `-`) is parsed, though all callouts are rendered expanded in the final PDF.

### Tags
Inline tags such as `#tag` and nested tags like `#nested/tag` are identified and rendered as colored badge elements.

### YAML Frontmatter & Metadata
The engine uses Obsidian's frontmatter fields for PDF metadata and optional visible titles:
- **`title` & `date`**: Mapped into the PDF's internal document metadata. When visible heading injection is opted into via `--add-title` (or `--title <name>`), an `H1` title and date block are prepended to the rendered document body.
- **`cssclass`**: Applied to the `<body>` tag, enabling per-note custom CSS styling.
- **`publish`**: If set to `false`, the CLI skips rendering this note during batch processing.
- **Standard metadata**: Fields like `author`, `description`, `tags`, and `keywords` are stored directly in the generated PDF metadata (viewable in PDF reader properties).

### Embeds & Transclusions
Full support for Obsidian's embed syntax (`![[...]]`):
- **Image Embeds**: `![[image.png]]`, `![[image.png|300]]` (width), and `![[image.png|300x200]]` (width x height) are fully supported. All images are embedded into the PDF as base64 data URIs so your PDF remains entirely self-contained.
- **Note Transclusions**: `![[note.md]]` inlines the full content of another note.
- **Section & Block References**: `![[note#Section]]` or `![[note#^block-id]]` extract only the specified part of the embedded note.
- **Recursion & Circular Guards**: Deeply nested embeds are supported up to a depth of 5 (configurable). Circular dependencies (e.g., A embeds B, B embeds A) are gracefully caught and replaced with a warning block.

### Attachment Resolution
Attachments are resolved smartly through your vault structure:
1. Relative to the current note's directory.
2. In the globally configured `attachmentFolder` (if set).
3. In common folders (`assets`, `attachments`, `files`).
4. Anywhere in the `vaultRoot`.

### Block Identifiers
Obsidian's internal block references (e.g., `^re-definition`) at the end of paragraphs are natively detected, stripped from the visible text, and transformed into HTML `id` attributes so they don't leak into the printed PDF, but remain internally linkable.

### Minimalist Tables & Flow
The `--theme obsidian-light` and `--theme obsidian-dark` flags apply Obsidian-style minimalist table layouts and matching color palettes.

## Configuration Options

When using the programmatic API, you can customize Obsidian processing:

```ts
obsidian?: {
  vaultRoot?: string                    // Path to vault root (default: current dir)
  attachmentFolder?: string            // Custom default attachment folder
  resolveLinks?: boolean               // Default: false
  embedNotes?: boolean                 // Enable note transclusion (default: true)
  maxEmbedDepth?: number               // Recursion limit (default: 5)
  maxAttachmentSizeMb?: number         // Warning threshold for large attachments (default: 10)
}
```

## Troubleshooting

- **Missing Attachments**: If an image is not found, a visual `[Missing Attachment]` warning is injected into the PDF, but rendering will not fail. Ensure the file exists and is accessible.
- **Large Files**: Attachments over the `maxAttachmentSizeMb` (10MB default) are skipped to prevent memory crashes, and a warning is logged.
- **Circular Embeds**: A yellow `[Circular Embed]` warning box appears if notes loop infinitely.

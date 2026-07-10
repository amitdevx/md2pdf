# Obsidian Compatibility Guide

The `@amitdevx/md2pdf` engine is designed to seamlessly convert Obsidian vaults into high-quality PDFs without requiring manual formatting changes. 

## Supported Syntax (v0.4.0)

As of version 0.4.0, the following core Obsidian features are supported out-of-the-box:

### Wiki Links
Standard Obsidian internal links using double brackets are parsed and rendered as styled text spans. 
- Basic links: `[[Page Name]]`
- Aliased links: `[[Page Name|Alias]]`
- Section links: `[[Page Name#Section]]`

*Note: In PDF output, wiki links are treated as internal references. If `--resolve-links` is disabled (default), they appear as muted text to signify an unresolved cross-reference.*

### Callouts
All standard Obsidian callout blocks are fully supported. They are rendered visually similarly to Obsidian's default theme, with the appropriate icons and colors.
- Supported types: `note`, `info`, `tip`, `success`, `question`, `warning`, `failure`, `danger`, `example`, `quote`
- Custom titles: `> [!WARNING] Custom Title`
- Foldable syntax (`+`, `-`) is parsed, though all callouts are rendered expanded in the final PDF.

### Tags
Inline tags such as `#tag` and nested tags like `#nested/tag` are identified and rendered as colored badge elements.

### YAML Frontmatter
The engine intelligently utilizes Obsidian's metadata fields to format the PDF:
- **`title`**: Injects an H1 at the top of the document (unless an H1 already exists).
- **`date`**: Renders a formatted date block immediately below the title.
- **`cssclass`**: Applied to the `<body>` tag, enabling per-note custom CSS themes.
- **`publish`**: If set to `false`, the CLI skips rendering this file completely.
- Standard fields like `author`, `description`, etc. are mapped directly into the PDF's internal metadata (viewable in PDF properties).

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

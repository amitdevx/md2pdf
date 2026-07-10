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

## Coming Soon (v0.4.1)

The following advanced Obsidian features are scheduled for the v0.4.1 update:
- File transclusions / embeds (`![[Page Name]]`)
- Image and attachment resolution from the local vault filesystem
- Block referencing (`^block-id`)

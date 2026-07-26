# Theming Engine

As of `v0.6.0`, `md2pdf` includes a robust theming engine that allows you to completely transform the aesthetics of your generated PDFs. Themes seamlessly control typography, colors, table structures, and syntax highlighting.

## Built-in Themes

You can instantly apply a theme using the `--theme` flag:

```bash
md2pdf document.md --theme <theme-name>
```

To see a list of all currently available themes on your machine, run:
```bash
md2pdf --list-themes
```

### Available Themes
1. **`default`**: Our flagship style. Features crisp typography (Inter & JetBrains Mono), clean gray borders, and a beautiful padded structure optimized for high-quality printing.
2. **`github`**: Accurately mimics the standard GitHub Markdown style for a familiar, developer-centric layout.
3. **`obsidian-light`**: **Strict Parity Theme**. Achieves a 1:1 visual match with Obsidian's light mode reading view, including minimalist tables (no vertical borders or shading).
4. **`obsidian-dark`**: **Strict Parity Theme**. A rich dark-mode theme identical to Obsidian's default dark mode, perfect for digital distribution.
5. **`dracula`**: The legendary Dracula color palette for a vibrant, high-contrast dark aesthetic.
6. **`nord`**: The arctic, north-bluish Nord theme for a cool, calm reading experience.
7. **`academic`**: A formal, serif-based theme (using Source Serif 4) tailored specifically for research papers, thesis documents, and academic publications.

## Custom Themes (CSS)

If the built-in themes don't fit your needs, you can easily provide your own custom CSS file.

```bash
md2pdf document.md --theme ./my-custom-theme.css
```

When you provide a custom `.css` file, `md2pdf` will inject your styles on top of the base layout engine. This allows you to easily override specific CSS variables (like `--md2pdf-color-bg` or `--md2pdf-accent-color`) without needing to write a full stylesheet from scratch.

### Key CSS Variables

Here are some of the core variables you can override in your custom theme:

```css
:root {
  /* Typography */
  --md2pdf-font-family-body: 'Helvetica Neue', Arial, sans-serif;
  --md2pdf-font-family-heading: 'Georgia', serif;
  --md2pdf-font-size: 12pt;
  
  /* Colors */
  --md2pdf-color-bg: #ffffff;
  --md2pdf-color-text: #333333;
  --md2pdf-accent-color: #ff5722;
  
  /* Tables */
  --md2pdf-table-header-bg: #eeeeee;
  --md2pdf-table-stripe-bg: #fdfdfd;
}
```

## Frontmatter Overrides

You can also specify a theme on a per-document basis using YAML frontmatter. This is especially useful for batch conversions where different files require different styling.

```yaml
---
title: "My Custom Report"
theme: "nord"
---
# Report Content
```

*Note: The CLI `--theme` flag takes precedence over the frontmatter `theme` attribute.*

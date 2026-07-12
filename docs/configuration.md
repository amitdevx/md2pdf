# Configuration

md2pdf can be configured persistently using a configuration file. By default, md2pdf will look for `md2pdf.config.ts`, `.md2pdfrc.json`, or `.md2pdfrc.yaml` in your working directory. You can also define your configuration inside `package.json` under the `"md2pdf"` key.

## Creating a Configuration File

Create a file named `md2pdf.config.ts` in your project root:

```typescript
import { defineConfig } from '@amitdevx/md2pdf';

export default defineConfig({
  theme: 'github',
  paper: 'A4',
  margin: '20mm',
  toc: true,
  tocDepth: 3,

  header: {
    enabled: true,
    template: '<div style="font-size:9px; padding: 0 15mm">{title}</div>',
  },
  footer: {
    enabled: true,
    template: '<div style="font-size:9px; text-align:right; padding: 0 15mm">Page {page} of {totalPages}</div>',
  },

  mermaid: {
    enabled: true,
    theme: 'dark',
  },

  math: {
    enabled: true,
  },

  metadata: {
    author: 'Amit Divekar',
    keywords: ['docs', 'notes'],
  },

  obsidian: {
    resolveWikiLinks: true,
    embedNotes: true,
  },
});
```

## Configuration Profiles

You can define multiple configuration profiles to easily switch contexts:

```typescript
import { defineConfig } from '@amitdevx/md2pdf';

export default defineConfig({
  // Base configuration
  paper: 'A4',
  mermaid: { enabled: true },

  profiles: {
    docs: {
      theme: 'github',
      toc: true,
    },
    print: {
      theme: 'default',
      margin: '25mm',
      header: true,
      footer: true,
    },
  },
});
```

To run a specific profile, use the `--profile` flag:

```bash
md2pdf README.md --profile print
```

## Order of Precedence

Configuration settings are merged in the following order (from highest priority to lowest):

1. **CLI Flags** (e.g. `--theme github`)
2. **Markdown Frontmatter** (e.g. `theme: dracula` inside a file's YAML block)
3. **Profile Configuration** (e.g. `--profile docs`)
4. **Base Configuration File** (`md2pdf.config.ts`, `.md2pdfrc.json`, etc.)
5. **Default Built-in Options**

This allows you to define your common defaults in the configuration file, override them per-file using YAML frontmatter, and easily override everything ad-hoc via CLI flags.

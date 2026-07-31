## Source Code (\`src/\`)

| Directory | Status | Purpose |
|---|---|---|
| `core/` | ✅ Active | Main `convert()` function |
| `cli/` | ✅ Active | CLI entry point + subcommands |
| `commands/` | ✅ Active | CLI command handlers (extracted from cli/index.ts) |
| `parser/` | ✅ Active | Markdown → AST → HTML pipeline |
| `pdf/` | ✅ Active | Playwright PDF generation |
| `renderer/` | ✅ Active | HTML template assembly |
| `plugins/` | ✅ Active | Custom and built-in plugins |
| `plugins/registry.ts` | ✅ Active | Plugin registration and lifecycle hooks |
| `plugins/mermaid/` | ✅ Active | Mermaid diagram detection + rendering |
| `plugins/obsidian/` | ✅ Active | Obsidian syntax plugins |
| `plugins/layout/` | ✅ Active | Page breaks + TOC plugins |
| `config/` | ✅ Active | Config file loading + validation |
| `types/` | ✅ Active | TypeScript type definitions (`plugins.ts`, `config.ts`) |
| `errors/` | ✅ Active | Error classes + diagnostics |
| `assets/` | ✅ Active | Embedded CSS + fonts |
| `themes/` | ✅ Active | Theme CSS files and definitions |

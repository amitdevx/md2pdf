# templates/

HTML page templates used by the renderer to wrap converted Markdown content.

---

## Purpose

The renderer (`src/renderer/`) assembles a full HTML document by injecting:
- The converted Markdown HTML (from `src/parser/`)
- A CSS theme (from `src/themes/`)
- Font URLs or inline `@font-face` declarations
- Optional Mermaid JS script reference
- Optional KaTeX CSS

Templates provide the HTML scaffolding for that assembly.

---

## Files (added as renderer matures)

| File | Added In | Purpose |
|------|----------|---------|
| `default.html` | v0.1.0 | Base HTML template (doctype, head, body, CSS slot, content slot) |
| `print.html` | v0.1.0 | Print-optimized variant with @page rules |

---

## Template Slots

Templates use a simple `{{slot}}` substitution pattern:

```html
<!DOCTYPE html>
<html lang="{{lang}}">
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
  <style>{{themeCSS}}</style>
  {{extraHeadHTML}}
</head>
<body class="{{bodyClass}}">
  {{contentHTML}}
</body>
</html>
```

The renderer in `src/renderer/index.ts` fills in these slots programmatically.

---

## Note

For v0.0.x, the HTML template is an inline string inside `src/renderer/index.ts`.
It will be extracted into this directory starting in **v0.1.0** as the template grows
more complex (themes, fonts, Mermaid script, KaTeX CSS).

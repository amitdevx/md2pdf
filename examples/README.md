# examples/

Example Markdown files and their rendered PDF outputs.
These demonstrate what `md2pdf` can produce, and serve as quick-start references.

---

## Files

| File | Purpose |
|------|---------|
| `basic.md` | A simple demo document covering headings, code, tables, and typography |
| `basic.pdf` | The rendered PDF output of `basic.md` using the default theme |

---

## Generating the Examples

```sh
# Re-render basic.md with the default theme
md2pdf examples/basic.md --output examples/basic.pdf
```

---

## More Examples (planned)

As features ship, new examples will be added here:

| File | Added In | Demonstrates |
|------|----------|-------------|
| `mermaid.md` + `.pdf` | v0.2.0 | Mermaid diagrams |
| `math.md` + `.pdf` | v0.3.0 | KaTeX equations |
| `obsidian.md` + `.pdf` | v0.4.0 | Obsidian compatibility |
| `academic.md` + `.pdf` | v0.6.0 | Academic paper with the academic theme |
| `github-readme.md` + `.pdf` | v0.6.0 | README with the github theme |

---

## Difference from `tests/fixtures/`

| | `examples/` | `tests/fixtures/` |
|--|-------------|-------------------|
| Purpose | Demo for users | Visual regression testing |
| Committed PDFs | ✅ Yes | ❌ No (snapshots are in `tests/snapshots/`) |
| Content | Readable, realistic | Comprehensive edge-case coverage |
| Updated | Per release, manually | Automatically re-rendered in CI |

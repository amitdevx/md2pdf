# tests/fixtures/ — Golden Documents

These are **permanent, curated Markdown files** used for unit testing.
They are never deleted — only grown. Every feature release renders them and compares
output against expected AST representations or HTML output.

---

## Current Fixtures

> Fixtures are added per release. Check the column "Added In" to know when each was introduced.

| File | Added In | What It Covers |
|------|----------|----------------|
| `basic.md` | v0.1.0 | Headings h1–h6, paragraphs, emphasis, links, blockquotes, HR |
| `code-blocks.md` | v0.1.0 | 20+ languages via Shiki, inline code, long lines, no-lang blocks |
| `tables.md` | v0.1.0 | Simple, wide (10+ cols), aligned, GFM pipe tables |
| `images.md` | v0.1.0 | Sizes, SVG, data URI, captions, floats, missing image |
| `nested-lists.md` | v0.1.0 | ul/ol 5 levels deep, task lists, mixed, tight vs loose |
| `footnotes.md` | v0.1.1 | All footnote variants, multi-paragraph bodies, cross-page |
| `toc.md` | v0.1.1 | 20+ headings at 3 levels — TOC generation and link accuracy |
| `headers-footers.md` | v0.1.2 | Header/footer on long doc, manual page breaks |
| `mermaid-all.md` | v0.2.1 | One of every Mermaid diagram type with realistic content |
| `math.md` | v0.3.0 | KaTeX inline/display, environments, numbering, chemistry, macros |
| `obsidian.md` | v0.4.0 | Wiki links, all callout types, tags, frontmatter |
| `github-readme.md` | v0.6.0 | Realistic open-source README — github theme acceptance test |
| `academic.md` | v0.6.0 | 20-page paper: math + figures + tables + footnotes |
| `100-pages.md` | v0.9.0 | Generated pagination stress test (100+ pages) |
| `unicode.md` | v0.9.0 | Emoji, CJK, Arabic, Devanagari, mixed-direction text |
| `rtl.md` | v0.9.0 | Full right-to-left document (Arabic/Hebrew) |

---

## Companion Vault

Some fixtures require supporting files:

```
tests/fixtures/
└── vault/
    ├── embedded-note.md    ← transcluded by obsidian.md
    ├── section-note.md     ← section-embed source
    └── assets/
        ├── sample.png
        ├── sample.svg
        └── logo.webp
```

## How Testing Works

These fixtures are primarily used by the `vitest` unit and integration test suites. 
When you run `npm run test`, the tests load these markdown files and verify that the HTML output or AST matches expectations.

---

## Adding a New Fixture

1. Create the `.md` file in this directory.
2. If necessary, add any companion resources to the `vault/` directory.
3. Update your unit tests (e.g. in `tests/parser/` or `tests/pdf/`) to read this fixture.
4. Run `npm test` to ensure it passes.
5. Document it in this README's table above.

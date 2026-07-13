# OBSIDIAN / AST PIPELINE — md2pdf v0.5.1 SSS-Tier Audit

---

## BUG-O1 — Circular Embed Detection Uses Wrong File in `seen` Set

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **File** | `src/plugins/obsidian/embeds.ts` |
| **Lines** | 96-165 |
| **Category** | Circular Transclusion / Infinite Loop |

### Description

The circular embed guard adds `currentFilePath` to the `seen` set when recursing, **not** `notePath`:

```ts
// LINE 153-165 — src/plugins/obsidian/embeds.ts
const newSeen = new Set(seen);
newSeen.add(currentFilePath);  // adds the PARENT, not the CHILD being embedded

replacement = await resolveObsidianEmbeds(
  replacement,
  vaultRoot,
  attachmentFolder,
  notePath,        // ← recursing into notePath
  maxEmbedDepth,
  maxAttachmentSizeMb,
  warnings,
  newSeen
);
```

Consider this vault structure:
- `A.md` embeds `![[B]]`
- `B.md` embeds `![[C]]`
- `C.md` embeds `![[A]]`  ← circular reference back to A

**Trace:**
1. `resolveObsidianEmbeds(A, seen={})` → finds `![[B]]`, `notePath=B`, `newSeen={A}`, recurse into B
2. `resolveObsidianEmbeds(B, seen={A})` → finds `![[C]]`, `notePath=C`, check: `C in seen`? No. `notePath === currentFilePath`? No (C !== B). `newSeen={A,B}`, recurse into C
3. `resolveObsidianEmbeds(C, seen={A,B})` → finds `![[A]]`, `notePath=A`, check: `A in seen`? **YES!** Correctly blocked.

So the circular detection actually works for 3-file cycles. But the **depth** check is the problem:

```ts
// LINE 16-19 — embeds.ts
if (seen.size >= maxEmbedDepth) {
  warnings.push(`Max embed depth reached (${maxEmbedDepth}). Stopping recursion.`);
  return markdown;
}
```

`maxEmbedDepth` defaults to `5`. The `seen.size` measures how many **unique files** have been visited, not the actual recursion depth. In a vault with a non-circular deep chain `A→B→C→D→E→F` (6 files), `seen.size` reaches 5 at F and stops — but `seen` contains `{A,B,C,D,E}` which is 5 entries (not the depth from root). The guard triggers prematurely at depth 5 even when the chain is linear and safe.

**Actual infinite loop risk:** The `seen.has(notePath)` check at line 96 correctly prevents re-embedding a file that's in `seen`. However, if `maxEmbedDepth` is set to 0 by a user (via config `maxEmbedDepth: 0`), the guard on line 16 checks `seen.size >= 0` which is always true, causing every file to return immediately without processing any embeds at all — breaking all embeds silently.

### SSS-Tier Fix

```ts
// embeds.ts — use a proper depth counter, not seen.size:
export async function resolveObsidianEmbeds(
  markdown: string,
  vaultRoot: string,
  attachmentFolder: string | undefined,
  currentFilePath: string,
  maxEmbedDepth: number = 5,
  maxAttachmentSizeMb: number = 10,
  warnings: string[] = [],
  seen: Set<string> = new Set(),
  depth: number = 0   // NEW: explicit depth counter
): Promise<string> {
  if (depth >= maxEmbedDepth) {
    warnings.push(`Max embed depth (${maxEmbedDepth}) reached at: ${currentFilePath}`);
    return markdown;
  }

  // ... inside recursion:
  replacement = await resolveObsidianEmbeds(
    replacement, vaultRoot, attachmentFolder,
    notePath, maxEmbedDepth, maxAttachmentSizeMb,
    warnings, newSeen, depth + 1  // increment depth
  );
}
```

---

## BUG-O2 — `![[embed]]` Regex is Greedy Across Newlines

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **File** | `src/plugins/obsidian/embeds.ts` |
| **Line** | 22 |
| **Category** | Regex Edge Cases |

### Description

```ts
// LINE 22 — src/plugins/obsidian/embeds.ts
const regex = /!\[\[(.*?)\]\]/g;
```

The `(.*?)` with no `s` flag means the dot does NOT match newlines. This is intentional. However, the bigger problem is that the regex is **run on the entire processed markdown** string, which by this point already contains the injected `<div class="markdown-embed">` HTML blocks from previous recursive calls. If an embedded note contains text like `![[` in a code block, the regex will incorrectly try to resolve it as an embed reference.

For example, a note explaining Obsidian syntax:
```md
You can embed files using `![[filename]]` syntax.
```
After being embedded, the content is wrapped in `<div class="markdown-embed">`. When the outer file's markdown is processed, the regex `/!\[\[(.*?)\]\]/g` will match the `![[filename]]` inside the code block example and try to resolve "filename" as a file.

### SSS-Tier Fix

Pre-strip code blocks and inline code before scanning for embeds, or use a more targeted approach:

```ts
// Strip code blocks before scanning for embed refs:
function stripCodeBlocks(md: string): { stripped: string; ranges: Array<[number, number]> } {
  const ranges: Array<[number, number]> = [];
  const stripped = md.replace(/(`{3,}[\s\S]*?`{3,}|`[^`\n]+`)/g, (match, _, offset) => {
    ranges.push([offset, offset + match.length]);
    return ' '.repeat(match.length); // preserve indices with spaces
  });
  return { stripped, ranges };
}

// Only process embeds found outside code block ranges
```

---

## BUG-O3 — Callout `firstTextNode.value.trim()` Check is Off-By-One

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `src/plugins/obsidian/callouts.ts` |
| **Lines** | 60-65 |
| **Category** | Callout Rendering |

### Description

After stripping the callout header marker from the first text node, the code checks if the node is now empty:

```ts
// LINES 60-65 — src/plugins/obsidian/callouts.ts
firstTextNode.value = firstTextNode.value.substring(match[0].length);

// If the first text node is now empty, remove it
if (firstTextNode.value.trim() === '' && firstTextNode.value.length === 0) {
  firstParagraph.children.shift();
}
```

The condition `firstTextNode.value.trim() === '' && firstTextNode.value.length === 0` is logically redundant — if `.length === 0`, then `.trim() === ''` is always true. So this simplifies to `firstTextNode.value.length === 0`. 

The **actual bug** is that the condition only removes nodes with **zero** remaining characters. If after stripping the match the text node contains only whitespace (e.g., `"\n"` — a newline after the callout marker), the `.length === 0` check is false and the whitespace text node is **not removed**, causing an unwanted empty line inside the callout title paragraph. This renders as a blank line before the callout body in the PDF.

### SSS-Tier Fix

```ts
// callouts.ts line 63 — check trim instead of length:
if (firstTextNode.value.trim() === '') {
  firstParagraph.children.shift();
}
```

---

## BUG-O4 — Wiki-Link `resolveLinks` Slug Algorithm Produces Incorrect Anchors

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **File** | `src/plugins/obsidian/wiki-links.ts` |
| **Lines** | 45-46 |
| **Category** | Wiki-link Resolution |

### Description

When `resolveLinks: true` is set, wiki-links generate an anchor href using a simple slug:

```ts
// LINE 45-46 — wiki-links.ts
const slug = target.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
htmlString = `<a href="#${slug}" ...>`;
```

But `rehype-slug` (used in `parser/index.ts:84`) generates heading IDs using a **different algorithm** — it uses the `github-slugger` library under the hood which:
1. Preserves Unicode characters (e.g., `Héllo` → `héllo`, not `h-llo`)
2. De-duplicates duplicate headings by appending `-1`, `-2`, etc.
3. Does not strip leading numbers

The wiki-links slug strips all non-alphanumeric characters, so `[[Node.js Setup]]` produces `#nodejs-setup` but `rehype-slug` for heading `# Node.js Setup` produces `#nodejs-setup` (coincidentally correct here). However `[[C++ Basics]]` produces `#c-basics` while `rehype-slug` produces `#c-basics` — also coincidentally the same. But `[[Héllo World]]` produces `#h-llo-world` while `rehype-slug` produces `#héllo-world`. Navigation breaks for non-ASCII headings.

### SSS-Tier Fix

```ts
// wiki-links.ts — import github-slugger (already a transitive dep via rehype-slug):
import Slugger from 'github-slugger';
const slugger = new Slugger();

// In the plugin:
const slug = slugger.slug(target);
htmlString = `<a href="#${slug}" class="wiki-link" ...>`;

// Note: Slugger is stateful (tracks duplicates) — reset between documents:
// Call slugger.reset() at the start of each document parse
```

---

## BUG-O5 — `remarkHighlight` `i` Index Adjustment is Wrong for Multi-Node Spans

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **File** | `src/plugins/obsidian/highlight.ts` |
| **Lines** | 92, 117 |
| **Category** | Highlight Rendering |

### Description

After splicing new nodes into `children`, the index `i` is adjusted:

```ts
// LINE 92 — src/plugins/obsidian/highlight.ts (same-node case)
children.splice(i, 1, ...newChildren);
i += newChildren.length - (afterEnd.length > 0 ? 2 : 1);

// LINE 117 — multi-node case
children.splice(i, nodesToRemove, ...newChildren);
i += newChildren.length - (afterEnd.length > 0 ? 2 : 1);
```

The adjustment `newChildren.length - (afterEnd.length > 0 ? 2 : 1)` is an attempt to position `i` at the last inserted node. But this formula is wrong:

- When there IS remaining text after the highlight (`afterEnd.length > 0`), `newChildren` = `[mark, text_after]` (2 items), and `i` should advance by 1 (to skip the `mark` node, then the outer `i++` at line 132 advances past `text_after`). `newChildren.length - 2 = 0`. Then `continue` is hit, outer `i++` doesn't run, so `i` stays where it was. This means **the text after the highlight is re-processed**, potentially causing duplicate nodes if it contains another `==`.

- When there is NO remaining text, `newChildren` = `[mark]`, `i += newChildren.length - 1 = 0`. Same issue.

The `continue` keyword at line 128 skips the `i++` at line 132, but the `i` value after the splice adjustment is not pointing to the correct next node.

### SSS-Tier Fix

```ts
// Replace the complex i adjustment with explicit positioning:
children.splice(i, 1, ...newChildren);
// After splice, i points to the first new node (pre-text or mark)
// Set i to point PAST all the newly inserted nodes, then break
// The outer loop will increment i to the next unprocessed node
i = i + newChildren.length; // skip all inserted nodes
break; // break inner string search
// Remove the `continue` and let the outer loop handle i++
// But since we set i past the spliced nodes, we need to decrement by 1
// because the outer while loop does NOT increment i automatically (matchFound path uses continue)
```

A cleaner rewrite uses a separate output array instead of in-place splicing.

---

## BUG-O6 — Shiki `rehypeShiki` Runs AFTER `rehypeMermaidDetector` — Wasted Processing

| Field | Detail |
|-------|--------|
| **Severity** | LOW (PERFORMANCE) |
| **File** | `src/parser/index.ts` |
| **Lines** | 84-106 |
| **Category** | AST Pipeline Order |

### Description

The pipeline ordering in `parser/index.ts`:

```ts
// LINES 84-106
.use(rehypeSlug)
.use(rehypeCallouts)
.use(rehypePageBreaks, options?.pageBreaks)
.use(rehypeToc, {...})
.use(rehypeMermaidDetector, { blocks: mermaidBlocks })  // line 92 — removes <pre><code> mermaid nodes
.use(rehypeExpandDetails)
.use(rehypeShiki, { theme: 'github-light', ... })        // line 94 — processes ALL code blocks
```

`rehypeMermaidDetector` replaces `<pre><code class="language-mermaid">` nodes with `<div id="mermaid-placeholder-N">` before `rehypeShiki` runs. This is correct — Shiki won't try to syntax-highlight mermaid source.

However, `rehypeShiki` is the most expensive plugin in the pipeline (it loads the grammar and tokenizes every code block). It runs **after** TOC generation and callout conversion. If TOC or callout processing adds `<code>` nodes (they don't currently, but future plugins might), those would also be highlighted.

More importantly, `rehypeShiki` is configured with a **single theme** (`github-light`) hardcoded at line 95, with no path to switch themes even though the `theme` option is passed all the way through `ConvertOptions`. The `--theme dark` flag has no effect on code block highlighting.

### Fix

```ts
// parser/index.ts — pass the theme through:
.use(rehypeShiki, {
  theme: resolveShikiTheme(options?.theme),  // map md2pdf themes to shiki themes
  fallbackLanguage: 'txt',
  onError: (err) => { warnings.push(err instanceof Error ? err.message : String(err)); }
})

// New helper:
function resolveShikiTheme(md2pdfTheme?: string): string {
  const map: Record<string, string> = {
    'default': 'github-light',
    'github': 'github-light',
    'obsidian-dark': 'github-dark',
    'dracula': 'dracula',
    'nord': 'nord',
  };
  return map[md2pdfTheme || 'default'] || 'github-light';
}
```

---

## Summary Table

| ID | File | Line(s) | Issue | Severity |
|----|------|---------|-------|----------|
| O1 | `src/plugins/obsidian/embeds.ts` | 16, 153-165 | Depth tracking via `seen.size` is wrong; `maxEmbedDepth: 0` breaks all embeds | HIGH |
| O2 | `src/plugins/obsidian/embeds.ts` | 22 | Embed regex matches `![[...]]` inside code blocks | HIGH |
| O3 | `src/plugins/obsidian/callouts.ts` | 63 | Empty whitespace-only text node not removed after callout header strip | MEDIUM |
| O4 | `src/plugins/obsidian/wiki-links.ts` | 45 | Slug algorithm diverges from `rehype-slug` for Unicode headings | MEDIUM |
| O5 | `src/plugins/obsidian/highlight.ts` | 92, 117 | `i` index adjustment wrong after splice — risk of duplicate nodes | HIGH |
| O6 | `src/parser/index.ts` | 94-95 | Shiki theme hardcoded to `github-light`, ignores `--theme` flag | LOW |

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';
import type { Root, Node } from 'mdast';

export function splitMarkdownByHeading(markdown: string, level: 1 | 2): string[] {
  const tree = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .parse(markdown) as Root;

  const documents: Root[] = [];
  let currentDoc: Root = { type: 'root', children: [] };
  let frontmatterNode: Node | null = null;

  for (const node of tree.children) {
    if (node.type === 'yaml') {
      frontmatterNode = node;
      continue; // Handled specially
    }

    if (node.type === 'heading' && node.depth <= level) {
      // Start a new document
      if (currentDoc.children.length > 0) {
        documents.push(currentDoc);
      }
      currentDoc = { type: 'root', children: [] };
      if (frontmatterNode) {
        currentDoc.children.push(frontmatterNode as any); // Duplicate frontmatter to all splits
      }
    }
    
    currentDoc.children.push(node as any);
  }

  if (currentDoc.children.length > 0) {
    documents.push(currentDoc);
  }

  // If no headings matched, return original
  if (documents.length === 0) return [markdown];

  const stringifier = unified().use(remarkStringify).use(remarkFrontmatter, ['yaml']);
  return documents.map(doc => stringifier.stringify(doc));
}

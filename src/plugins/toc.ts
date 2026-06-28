import { visit } from 'unist-util-visit';
import { Element, Root } from 'hast';

export interface TocOptions {
  enable?: boolean;
  depth?: number;
  title?: string;
}

export default function rehypeToc(options: TocOptions = {}) {
  const { enable = false, depth = 3, title = 'Table of Contents' } = options;

  return (tree: Root) => {
    if (!enable) return;

    const headings: { depth: number; id: string; value: string }[] = [];

    // Extract headings
    visit(tree, 'element', (node: Element) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        const headingDepth = parseInt(node.tagName.charAt(1), 10);
        if (headingDepth <= depth) {
          const id = (node.properties?.id as string) || '';
          // Extract text content of heading
          let value = '';
          visit(node, 'text', (textNode: import('hast').Text) => {
            value += textNode.value;
          });
          headings.push({ depth: headingDepth, id, value });
        }
      }
    });

    if (headings.length === 0) return;

    // Build nested list AST
    const buildList = (items: typeof headings): Element => {
      const children: Element[] = items.map(item => ({
        type: 'element',
        tagName: 'li',
        properties: { className: [`toc-level-${item.depth}`] },
        children: [
          {
            type: 'element',
            tagName: 'a',
            properties: { href: `#${item.id}` },
            children: [{ type: 'text', value: item.value }],
          },
        ],
      }));

      return {
        type: 'element',
        tagName: 'ul',
        properties: { className: ['toc-list'] },
        children,
      };
    };

    const tocList = buildList(headings);

    const tocSection: Element = {
      type: 'element',
      tagName: 'div',
      properties: { className: ['table-of-contents'] },
      children: [
        {
          type: 'element',
          tagName: 'h2',
          properties: { className: ['toc-title'] },
          children: [{ type: 'text', value: title }],
        },
        tocList,
        {
          type: 'element',
          tagName: 'hr',
          properties: { className: ['toc-separator'] },
          children: [],
        }
      ],
    };

    // Insert at the top of the body
    tree.children.unshift(tocSection);
  };
}

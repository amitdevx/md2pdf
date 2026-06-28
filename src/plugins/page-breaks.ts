import { visit } from 'unist-util-visit';
import { Root, Element, Text, Comment } from 'hast';

export interface PageBreakOptions {
  h1NewPage?: boolean;
  hrAsPageBreak?: boolean;
}

export default function rehypePageBreaks(options: PageBreakOptions = {}) {
  const { h1NewPage = true, hrAsPageBreak = false } = options;

  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (!parent || typeof index !== 'number') return;

      // Handle <!-- pagebreak --> comments
      if (node.type === 'comment' && (node as Comment).value.trim() === 'pagebreak') {
        const pageBreakElement: Element = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['md2pdf-page-break'], style: 'page-break-before: always;' },
          children: [],
        };
        parent.children.splice(index, 1, pageBreakElement);
        return;
      }

      if (node.type === 'element') {
        const el = node as Element;
        
        // Handle h1 New Page
        if (h1NewPage && el.tagName === 'h1') {
          // Don't add page break before the very first element in the document
          // or if it's the title (but we don't have title in mdast, it's injected later)
          // Actually, let's just use CSS class so users can override
          el.properties = el.properties || {};
          const existingClasses = Array.isArray(el.properties.className) ? el.properties.className : [];
          el.properties.className = [...existingClasses, 'md2pdf-page-break-before'];
        }

        // Handle hr as page break
        if (hrAsPageBreak && el.tagName === 'hr') {
          const pageBreakElement: Element = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['md2pdf-page-break'], style: 'page-break-before: always;' },
            children: [],
          };
          parent.children.splice(index, 1, pageBreakElement);
          return;
        }
      }
    });
  };
}

import { visit } from 'unist-util-visit';
import { Element, Root } from 'hast';
import type { RenderContext } from '../../types/context.js';

export interface OutlineOptions {
  enable?: boolean;
  context?: RenderContext;
}

export default function rehypeOutline(options: OutlineOptions = {}) {
  const { enable = false, context } = options;

  return (tree: Root) => {
    if (!enable || !context) return;
    
    if (!context.headings) {
      context.headings = [];
    }

    visit(tree, 'element', (node: Element) => {
      if (/^h[1-6]$/.test(node.tagName)) {
        const level = parseInt(node.tagName.charAt(1), 10);
        const id = (node.properties?.id as string) || '';
        
        let title = '';
        visit(node, 'text', (textNode: import('hast').Text) => {
          title += textNode.value;
        });
        
        context.headings!.push({ level, title, id, pageIndex: 0 }); // pageIndex is not strictly used if we use Dest IDs
      }
    });
  };
}

import { visit } from 'unist-util-visit';
import { Plugin } from 'unified';
import { Element, Root, Text } from 'hast';

export interface MermaidBlock {
  id: string;
  source: string;
  theme?: string;
}

export interface MermaidDetectorOptions {
  blocks: MermaidBlock[];
}

export const rehypeMermaidDetector: Plugin<[MermaidDetectorOptions], Root> = (options) => {
  return (tree) => {
    let counter = 0;

    visit(tree, 'element', (node: Element, index, parent) => {
      // Find <pre><code class="language-mermaid">
      if (node.tagName === 'pre' && node.children.length === 1) {
        const codeNode = node.children[0] as Element;
        if (
          codeNode.type === 'element' &&
          codeNode.tagName === 'code' &&
          codeNode.properties &&
          Array.isArray(codeNode.properties.className) &&
          codeNode.properties.className.includes('language-mermaid')
        ) {
          // Extract text
          const textNode = codeNode.children.find((c) => c.type === 'text') as Text | undefined;
          let source = textNode ? textNode.value : '';
          
          // Handle edge cases like empty blocks or whitespace
          source = source.trim();
          if (!source) return; // Skip empty blocks

          const id = `mermaid-placeholder-${counter++}`;

          // Save to blocks array
          options.blocks.push({
            id,
            source,
            // We could parse {theme=dark} from meta if it existed on the codeNode
            // But remark-parse might store it in data.meta or properties.
          });

          // Replace the <pre> node with our placeholder <div>
          if (parent && index !== undefined) {
            parent.children[index] = {
              type: 'element',
              tagName: 'div',
              properties: {
                id,
                className: ['mermaid-container'],
                style: 'page-break-inside: avoid;',
              },
              children: [],
            };
          }
        }
      }
    });
  };
};

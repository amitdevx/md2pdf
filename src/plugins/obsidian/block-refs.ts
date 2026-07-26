import { visit } from 'unist-util-visit';
import { Node } from 'unist';



export default function remarkBlockRefs() {
  return (tree: Node) => {
    visit(tree, (node: Node) => {
      // Look for block-level elements like paragraph, heading, list item, blockquote
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'listItem' ||
        node.type === 'blockquote'
      ) {
        const children = (node as any).children;
        if (children && children.length > 0) {
          const lastChild = children[children.length - 1];
          if (lastChild.type === 'text') {
            const match = lastChild.value.match(/\s*\^([a-zA-Z0-9-]+)\s*$/);
            if (match) {
              const blockId = match[1];
              // Strip the reference from the text
              lastChild.value = lastChild.value.replace(/\s*\^[a-zA-Z0-9-]+\s*$/, '');
              
              // If the text node is now empty, we could remove it, but unified handles empty text nodes fine.

              // Attach the ID to the HTML node
              const data = (node.data || (node.data = {})) as any;
              const hProperties = (data.hProperties || (data.hProperties = {}));
              hProperties.id = blockId;
            }
          }
        }
      }
    });
  };
}

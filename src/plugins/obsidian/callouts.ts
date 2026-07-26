import { visit } from 'unist-util-visit';

import { ICONS as CALLOUT_ICONS } from './lucide-icons.js';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export default function rehypeCallouts() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName !== 'blockquote') return;
      if (!node.children || node.children.length === 0) return;

      // Find the first <p> element which should contain the callout trigger
      const firstParagraph = node.children.find((c: any) => c.type === 'element' && c.tagName === 'p');
      if (!firstParagraph || !firstParagraph.children || firstParagraph.children.length === 0) return;

      const firstTextNode = firstParagraph.children[0];
      if (firstTextNode.type !== 'text') return;

      // Match [!TYPE] or [!TYPE]+ or [!TYPE]- and optional Title
      // e.g. "[!WARNING]- Custom Title\nRest of text"
      const match = /^\[!([a-zA-Z]+)\]([+-]?)(?:\s+(.*?))?(?:\n|$)/.exec(firstTextNode.value);
      
      if (!match) return;

      const rawType = match[1].toLowerCase();
      const type = CALLOUT_ICONS[rawType] ? rawType : 'note'; // fallback to note if unknown type
      const title = match[3] ? match[3].trim() : capitalize(rawType);
      const icon = CALLOUT_ICONS[rawType] || CALLOUT_ICONS['note'];

      // Remove the matched part from the text node
      firstTextNode.value = firstTextNode.value.substring(match[0].length);
      
      // If the first text node is now empty, remove it
      if (firstTextNode.value.trim() === '') {
        firstParagraph.children.shift();
      }

      // Convert the blockquote into a div.callout
      node.tagName = 'div';
      node.properties = {
        ...node.properties,
        className: ['callout'],
        'data-type': type
      };

      const titleNode = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['callout-title'] },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['callout-icon'] },
            children: [{ type: 'raw', value: icon }]
          },
          {
            type: 'element',
            tagName: 'span',
            properties: { className: ['callout-title-text'] },
            children: [{ type: 'text', value: title }]
          }
        ]
      };

      const bodyNode = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['callout-body'] },
        children: [...node.children] // Move all original blockquote children into the body
      };

      node.children = [titleNode, bodyNode];
    });
  };
}

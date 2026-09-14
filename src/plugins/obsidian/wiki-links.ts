import { visit } from 'unist-util-visit';
import Slugger from 'github-slugger';



export default function remarkWikiLinks(options: { resolveLinks?: boolean } = {}) {
  return (tree: any) => {
    const slugger = new Slugger();
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return;
      const text = node.value;
      const regex = /\[\[(.*?)\]\]/g;
      const newChildren: any[] = [];
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          newChildren.push({ type: 'text', value: text.slice(lastIndex, match.index) });
        }
        
        const content = match[1];
        let target = content;
        let display = content;
        
        if (content.includes('|')) {
          const parts = content.split('|');
          target = parts[0];
          display = parts.slice(1).join('|');
        }


        if (options.resolveLinks) {
          const slug = slugger.slug(target);
          newChildren.push({
            type: 'wikiLink',
            data: {
              hName: 'a',
              hProperties: {
                href: '#' + slug,
                className: ['wiki-link'],
                'data-target': target
              }
            },
            children: [{ type: 'text', value: display }]
          });
        } else {
          newChildren.push({
            type: 'wikiLink',
            data: {
              hName: 'a',
              hProperties: {
                className: ['wiki-link'],
                'data-target': target,
                'data-unresolved': 'true'
              }
            },
            children: [{ type: 'text', value: display }]
          });
        }

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length && lastIndex > 0) {
        newChildren.push({ type: 'text', value: text.slice(lastIndex) });
      }

      if (newChildren.length > 0) {
        parent.children.splice(index, 1, ...newChildren);
        return index + newChildren.length;
      }
    });
  };
}

import { visit } from 'unist-util-visit';
import Slugger from 'github-slugger';

const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;'
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, tag => escapeMap[tag] || tag);
}

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

        const resolvedStr = options.resolveLinks ? "" : ' data-unresolved="true"';
        
        let htmlString = '';
        if (options.resolveLinks) {
          // If resolveLinks is enabled, try to make it a clickable internal link
          const slug = slugger.slug(target);
          htmlString = `<a href="#${slug}" class="wiki-link" data-target="${escapeHtml(target)}"${resolvedStr}>${escapeHtml(display)}</a>`;
        } else {
          // Otherwise, it's just a styled span that looks like a link
          htmlString = `<a class="wiki-link" data-target="${escapeHtml(target)}"${resolvedStr}>${escapeHtml(display)}</a>`;
        }

        newChildren.push({ type: 'html', value: htmlString });

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

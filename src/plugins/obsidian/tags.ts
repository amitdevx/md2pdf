import { visit } from 'unist-util-visit';

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

export default function remarkTags(options: { showTags?: boolean } = {}) {
  const showTags = options.showTags !== false;

  return (tree: any) => {
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || typeof index !== 'number') return;
      const text = node.value;
      // Regex for tags: preceded by space or start of line, starts with #, contains word characters, hyphen, or slash
      const regex = /(^|\s)#([a-zA-Z0-9_/-]+)(?=\s|$|[.,!?)])/g;
      
      let match;
      let lastIndex = 0;
      const newChildren: any[] = [];
      let found = false;

      while ((match = regex.exec(text)) !== null) {
        found = true;
        // match[0] is the full match including the leading space
        // match[1] is the leading space
        // match[2] is the tag itself without #
        
        const matchStart = match.index + match[1].length;
        if (matchStart > lastIndex) {
          newChildren.push({ type: 'text', value: text.slice(lastIndex, matchStart) });
        }

        const tagText = '#' + match[2];
        
        if (showTags) {
          const htmlString = `<span class="tag">${escapeHtml(tagText)}</span>`;
          newChildren.push({ type: 'html', value: htmlString });
        } else {
          // If hiding tags, we just don't push anything to effectively remove it
        }

        lastIndex = matchStart + tagText.length;
      }

      if (!found) return;

      if (lastIndex < text.length) {
        newChildren.push({ type: 'text', value: text.slice(lastIndex) });
      }

      if (newChildren.length > 0) {
        parent.children.splice(index, 1, ...newChildren);
        return index + newChildren.length;
      } else if (newChildren.length === 0) {
        // Tag was removed and it was the only thing
        parent.children.splice(index, 1);
        return index;
      }
    });
  };
}

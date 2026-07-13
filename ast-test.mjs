import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { visit } from 'unist-util-visit';

const md = `
# Title

<!-- pagebreak -->

---
`;

async function test() {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(() => (tree) => {
      visit(tree, (node) => {
        console.log(node.type, node.tagName || node.value || '');
      });
    });
  
  await processor.process(md);
}

test();

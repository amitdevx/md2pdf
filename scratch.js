import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

const markdown = "```mermaid {theme=dark}\ngraph TD\n```";

unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(() => (tree) => console.log(JSON.stringify(tree, null, 2)))
  .use(rehypeStringify)
  .process(markdown)
  .then(() => console.log('Done'));

import { describe, it, expect } from 'vitest';
import { rehypeMermaidDetector } from '../../src/plugins/mermaid/detector.js';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

describe('rehypeMermaidDetector', () => {
  it('should extract mermaid blocks', async () => {
    const blocks: any[] = [];
    const processor = unified()
      .use(remarkParse)
      .use(remarkRehype)
      .use(rehypeMermaidDetector, { blocks })
      .use(rehypeStringify);
      
    await processor.process('```mermaid\ngraph TD;\nA-->B;\n```');
    expect(blocks.length).toBe(1);
  });
});

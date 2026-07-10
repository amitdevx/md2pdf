import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkHighlight from '../../src/plugins/obsidian/highlight.js';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkWikiLinks from '../../src/plugins/obsidian/wiki-links.js';

function parse(md: string) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkWikiLinks as any)
    .use(remarkHighlight as any)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });

  return String(processor.processSync(md)).trim();
}

describe('remarkHighlight', () => {
  it('highlights normal text', () => {
    expect(parse('==Hello==')).toBe('<p><mark>Hello</mark></p>');
  });

  it('highlights nested bold text', () => {
    expect(parse('==**Hello**==')).toBe('<p><mark><strong>Hello</strong></mark></p>');
  });

  it('highlights nested italic text', () => {
    expect(parse('==*Hello*==')).toBe('<p><mark><em>Hello</em></mark></p>');
  });

  it('highlights inline code', () => {
    expect(parse('==`Hello`==')).toBe('<p><mark><code>Hello</code></mark></p>');
  });

  it('highlights links', () => {
    expect(parse('==[Google](https://google.com)==')).toBe('<p><mark><a href="https://google.com">Google</a></mark></p>');
  });

  it('highlights wiki-links', () => {
    expect(parse('==[[Google]]==')).toBe('<p><mark><a class="wiki-link" data-target="Google" data-unresolved="true">Google</a></mark></p>');
  });

  it('highlights mixed sentence', () => {
    expect(parse('This is ==highlighted== text.')).toBe('<p>This is <mark>highlighted</mark> text.</p>');
  });

  it('handles multiple highlights', () => {
    expect(parse('==one== and ==two==')).toBe('<p><mark>one</mark> and <mark>two</mark></p>');
  });

  it('does not parse invalid cases', () => {
    expect(parse('==')).toBe('<p>==</p>');
    expect(parse('====')).toBe('<p>====</p>');
    expect(parse('text==')).toBe('<p>text==</p>');
    expect(parse('==text')).toBe('<p>==text</p>');
  });

  it('ignores multiline safely', () => {
    // A highlight spanning multiple lines but within the same paragraph should work
    // But across blocks it should not
    expect(parse('==\n\ntext==')).toBe('<p>==</p>\n<p>text==</p>');
  });
});

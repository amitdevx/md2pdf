import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/parser/index.js';

describe('Markdown Parser', () => {
  it('should parse basic markdown into html', async () => {
    const markdown = '# Hello World\nThis is a test.';
    const { html } = await parseMarkdown(markdown);
    
    expect(html).toContain('<h1');
    expect(html).toContain('Hello World</h1>');
    expect(html).toContain('<p>This is a test.</p>');
  });

  it('should parse tables', async () => {
    const markdown = '| Col 1 | Col 2 |\n|---|---|\n| A | B |';
    const { html } = await parseMarkdown(markdown);
    
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Col 1</th>');
    expect(html).toContain('<td>A</td>');
  });

  it('should format code blocks correctly', async () => {
    const markdown = '```javascript\nconst a = 1;\n```';
    const { html } = await parseMarkdown(markdown);
    
    expect(html).toContain('class="shiki shiki-themes github-light one-dark-pro"');
    expect(html).toContain('const</span>');
  });
});

import { describe, it, expect } from 'vitest';
import { renderHtmlTemplate } from '../../src/renderer/index.js';

describe('HTML Renderer', () => {
  it('should wrap content in a professional HTML document', async () => {
    const html = await renderHtmlTemplate('<p>Hello</p>', 'Test Doc');
    
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Doc</title>');
    expect(html).toContain('<style>');
    expect(html).toContain('--md2pdf-font-size: 11pt;');
    expect(html).toContain('<div class="markdown-body">');
    expect(html).toContain('<p>Hello</p>');
  });

  it('should inject custom cssclass', async () => {
    const html = await renderHtmlTemplate('<p>Hello</p>', 'Test Doc', { cssclass: 'my-custom-class' });
    expect(html).toContain('class="my-custom-class"');
  });
});

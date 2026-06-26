import { describe, it, expect } from 'vitest';
import { renderHtmlTemplate } from '../../src/renderer/index.js';

describe('HTML Renderer', () => {
  it('should wrap content in a professional HTML document', () => {
    const html = renderHtmlTemplate('<p>Hello</p>', 'Test Doc');
    
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Doc</title>');
    expect(html).toContain('<style>');
    expect(html).toContain('--bg-main: #fff;');
    expect(html).toContain('<div class="markdown-body">');
    expect(html).toContain('<p>Hello</p>');
  });
});

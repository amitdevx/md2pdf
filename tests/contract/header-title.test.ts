import { describe, it, expect } from 'vitest';
import { fillTitlePlaceholder } from '../../src/utils/header-template.js';

describe('fillTitlePlaceholder (C#: header/footer title fill)', () => {
  it('fills <span class="title"></span> with the resolved document title', () => {
    const tpl = '<div style="text-align:right;"><span class="title"></span></div>';
    const out = fillTitlePlaceholder(tpl, 'My Frontmatter Title');
    expect(out).toContain('<span class="title">My Frontmatter Title</span>');
    expect(out).not.toContain('<span class="title"></span>');
  });

  it('fills the title inside a styled header alongside page numbers', () => {
    const tpl =
      '<div><span class="title"></span> — <span class="pageNumber"></span>/<span class="totalPages"></span></div>';
    const out = fillTitlePlaceholder(tpl, 'Laporan Akhir');
    expect(out).toContain('<span class="title">Laporan Akhir</span>');
    // untouched Chromium tokens remain intact
    expect(out).toContain('<span class="pageNumber"></span>');
    expect(out).toContain('<span class="totalPages"></span>');
  });

  it('works on footer templates too', () => {
    const tpl = '<div><span class="title"></span></div>';
    const out = fillTitlePlaceholder(tpl, 'Bab 3');
    expect(out).toContain('<span class="title">Bab 3</span>');
  });

  it('HTML-escapes the title to prevent markup injection', () => {
    const tpl = '<div><span class="title"></span></div>';
    const out = fillTitlePlaceholder(tpl, '<img src=x onerror=alert(1)>');
    expect(out).toContain('&lt;img');
    expect(out).not.toContain('<img src=x');
  });

  it('returns undefined when the template is undefined', () => {
    expect(fillTitlePlaceholder(undefined, 'Any Title')).toBeUndefined();
  });

  it('returns the template unchanged when it has no title placeholder', () => {
    const tpl = '<div><span class="pageNumber"></span></div>';
    expect(fillTitlePlaceholder(tpl, 'Ignored')).toBe(tpl);
  });
});

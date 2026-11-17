import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../../src/parser/index.js';
import { mergeConfig } from '../../src/config/merge.js';
import { configSchema } from '../../src/config/validate.js';

const baseOptions = {
  toc: false,
  tocDepth: 3,
  pageBreaks: { h1NewPage: false, hrAsPageBreak: false },
  math: { enabled: false },
  obsidian: { resolveLinks: false, showTags: false },
};

describe('Auto Captions (figure and table wrapping)', () => {
  it('wraps standalone image in figure with figcaption and preserves alt text', async () => {
    const md = `# Title\n\n![System Architecture](arch.png)\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: true, tables: true }
    });

    expect(parsed.html).toMatch(/<figure class="figure figure-fig">/);
    expect(parsed.html).toMatch(/<img src="arch\.png" alt="System Architecture">/);
    expect(parsed.html).toMatch(/<figcaption class="caption caption-fig"><span class="caption-prefix">Figure<\/span>: System Architecture<\/figcaption>/);
  });

  it('wraps table in figure with figcaption rendered above table', async () => {
    const md = `| Col A | Col B |\n|---|---|\n| 1 | 2 |\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: true, tables: true }
    });

    expect(parsed.html).toMatch(/<figure class="figure figure-tab"><figcaption class="caption caption-tab"><span class="caption-prefix">Table<\/span>\.<\/figcaption><table>/);
  });

  it('preserves paragraph text when image is inline with surrounding text', async () => {
    const md = `Text before image ![inline icon](icon.png) text after image.`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: true, tables: true }
    });

    // Paragraph should remain a <p> and keep its text intact
    expect(parsed.html).toContain('Text before image');
    expect(parsed.html).toContain('text after image.');
    expect(parsed.html).toContain('<img src="icon.png" alt="inline icon">');
    expect(parsed.html).not.toContain('<figure class="figure figure-fig">');
  });

  it('does not wrap when captions are disabled', async () => {
    const md = `![Architecture](arch.png)\n\n| A |\n|---|\n| 1 |\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: false }
    });

    expect(parsed.html).not.toContain('<figure');
    expect(parsed.html).not.toContain('<figcaption');
  });

  it('supports figures-only mode', async () => {
    const md = `![Architecture](arch.png)\n\n| A |\n|---|\n| 1 |\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: true, tables: false }
    });

    expect(parsed.html).toContain('figure-fig');
    expect(parsed.html).not.toContain('figure-tab');
  });

  it('supports tables-only mode', async () => {
    const md = `![Architecture](arch.png)\n\n| A |\n|---|\n| 1 |\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: false, tables: true }
    });

    expect(parsed.html).not.toContain('figure-fig');
    expect(parsed.html).toContain('figure-tab');
  });

  it('supports custom figure and table labels', async () => {
    const md = `![Diagram](diag.png)\n\n| A |\n|---|\n| 1 |\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: {
        enable: true,
        figures: true,
        tables: true,
        figLabel: 'Gambar',
        tabLabel: 'Tabel'
      }
    });

    expect(parsed.html).toContain('<span class="caption-prefix">Gambar</span>');
    expect(parsed.html).toContain('<span class="caption-prefix">Tabel</span>');
  });

  it('wraps linked standalone images in figure without corrupting link', async () => {
    const md = `[![System Architecture](arch.png)](https://example.com)\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: true, tables: true }
    });

    expect(parsed.html).toMatch(/<figure class="figure figure-fig"><a href="https:\/\/example\.com"><img src="arch\.png" alt="System Architecture"><\/a><figcaption class="caption caption-fig"><span class="caption-prefix">Figure<\/span>: System Architecture<\/figcaption><\/figure>/);
  });

  it('leaves inline images in table cells as plain images', async () => {
    const md = `| Col A | Icon |\n|---|---|\n| 1 | ![icon](icon.png) |\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: true, tables: true }
    });

    expect(parsed.html).toContain('<td><img src="icon.png" alt="icon"></td>');
    expect(parsed.html).not.toContain('figure-fig');
  });

  it('leaves inline images in list items as plain images', async () => {
    const md = `* Item with ![icon](icon.png) badge\n* Item 2\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: true, tables: true }
    });

    expect(parsed.html).toContain('<li>Item with <img src="icon.png" alt="icon"> badge</li>');
    expect(parsed.html).not.toContain('figure-fig');
  });

  it('cleans redundant Figure prefixes from alt text without mangling content', async () => {
    const md = `![Figure 1: Network Topology](net.png)\n\n![Fig. 2 - Database Architecture](db.png)\n\n![Figure 3](chart.png)\n\n![Figure of merit diagram](merit.png)\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: true, tables: true }
    });

    expect(parsed.html).toContain('<figcaption class="caption caption-fig"><span class="caption-prefix">Figure</span>: Network Topology</figcaption>');
    expect(parsed.html).toContain('<figcaption class="caption caption-fig"><span class="caption-prefix">Figure</span>: Database Architecture</figcaption>');
    expect(parsed.html).toContain('<figcaption class="caption caption-fig"><span class="caption-prefix">Figure</span>.</figcaption>');
    expect(parsed.html).toContain('<figcaption class="caption caption-fig"><span class="caption-prefix">Figure</span>: Figure of merit diagram</figcaption>');
  });

  it('extracts and formats native HTML table captions', async () => {
    const md = `<table><caption>Quarterly Performance Metrics</caption><thead><tr><th>Q</th></tr></thead></table>\n`;
    const parsed = await parseMarkdown(md, {
      ...baseOptions,
      captions: { enable: true, figures: true, tables: true }
    });

    expect(parsed.html).toMatch(/<figure class="figure figure-tab"><figcaption class="caption caption-tab"><span class="caption-prefix">Table<\/span>: Quarterly Performance Metrics<\/figcaption><table><thead>/);
  });

  describe('Configuration and CLI flag merging', () => {
    it('--figure-captions alone enables figures and excludes tables', () => {
      const merged = mergeConfig({}, { figureCaptions: true });
      expect(merged.captions).toEqual({
        enable: true,
        figures: true,
        tables: false,
        figLabel: undefined,
        tabLabel: undefined,
      });
    });

    it('--table-captions alone enables tables and excludes figures', () => {
      const merged = mergeConfig({}, { tableCaptions: true });
      expect(merged.captions).toEqual({
        enable: true,
        figures: false,
        tables: true,
        figLabel: undefined,
        tabLabel: undefined,
      });
    });

    it('both flags enable both figures and tables', () => {
      const merged = mergeConfig({}, { figureCaptions: true, tableCaptions: true });
      expect(merged.captions).toEqual({
        enable: true,
        figures: true,
        tables: true,
        figLabel: undefined,
        tabLabel: undefined,
      });
    });

    it('validates captions in configuration schema', () => {
      const resultObj = configSchema.safeParse({
        captions: {
          enable: true,
          figures: true,
          tables: true,
          figLabel: 'Figure',
          tabLabel: 'Table',
        }
      });
      expect(resultObj.success).toBe(true);

      const resultBool = configSchema.safeParse({
        captions: true
      });
      expect(resultBool.success).toBe(true);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { parseCssMargin } from '../../src/pdf/index.js';
import { parseMarkdown } from '../../src/parser/index.js';
import { runCli } from '../contract/helpers.js';
import { renderMermaidBlocks } from '../../src/plugins/mermaid/renderer.js';

describe('v0.9.11 Audit Fixes and Enhancements', () => {
  describe('CSS Margin Parser', () => {
    it('handles 1-value margin', () => {
      const res = parseCssMargin('15mm');
      expect(res).toEqual({ top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' });
    });

    it('handles 2-value margin (vertical horizontal)', () => {
      const res = parseCssMargin('10mm 20mm');
      expect(res).toEqual({ top: '10mm', right: '20mm', bottom: '10mm', left: '20mm' });
    });

    it('handles 3-value margin (top horizontal bottom)', () => {
      const res = parseCssMargin('10mm 20mm 30mm');
      expect(res).toEqual({ top: '10mm', right: '20mm', bottom: '30mm', left: '20mm' });
    });

    it('handles 4-value margin (top right bottom left)', () => {
      const res = parseCssMargin('10mm 20mm 30mm 40mm');
      expect(res).toEqual({ top: '10mm', right: '20mm', bottom: '30mm', left: '40mm' });
    });

    it('handles empty or undefined margin gracefully', () => {
      expect(parseCssMargin(undefined)).toEqual({});
      expect(parseCssMargin('')).toEqual({});
    });
  });

  describe('CLI Margin and Page Number Validations', () => {
    it('accepts --margin with 1 to 4 space-separated units', () => {
      const res1 = runCli('README.md --dry-run --margin "10mm 15mm"');
      expect(res1.status).toBe(0);

      const res2 = runCli('README.md --dry-run --margin "10mm 15mm 20mm 25mm"');
      expect(res2.status).toBe(0);
    });

    it('accepts independent margin flags: --margin-top, --margin-bottom, --margin-left, --margin-right', () => {
      const res = runCli('README.md --dry-run --margin-top 10mm --margin-bottom 12mm --margin-left 15mm --margin-right 15mm');
      expect(res.status).toBe(0);
    });

    it('rejects invalid independent margin flags', () => {
      const res = runCli('README.md --dry-run --margin-top invalid');
      expect(res.status).toBe(1);
      expect(res.stderr).toContain("error: option '--margin-top <margin>' argument 'invalid' is invalid.");
    });

    it('accepts top-left and bottom-left in --page-numbers', () => {
      const resTopLeft = runCli('README.md --dry-run --page-numbers top-left');
      expect(resTopLeft.status).toBe(0);

      const resBottomLeft = runCli('README.md --dry-run --page-numbers bottom-left');
      expect(resBottomLeft.status).toBe(0);
    });
  });

  describe('TOC Page Break Plugin', () => {
    it('inserts a page break when tocPageBreak is true', async () => {
      const md = '# Chapter 1\nSome text\n## Section 1.1\nMore text';
      const result = await parseMarkdown(md, {
        toc: true,
        tocPageBreak: true,
      });

      expect(result.html).toContain('toc-break');
      expect(result.html).toContain('md2pdf-page-break');
    });

    it('omits page break when tocPageBreak is false', async () => {
      const md = '# Chapter 1\nSome text\n## Section 1.1\nMore text';
      const result = await parseMarkdown(md, {
        toc: true,
        tocPageBreak: false,
      });

      expect(result.html).not.toContain('toc-break');
    });
  });

  describe('Permissive Mermaid Mode', () => {
    it('gracefully emits an inline error callout when permissive mode is enabled', async () => {
      const badMermaidBlock = {
        id: 'mermaid-test-1',
        source: 'invalid syntax block here !!!',
        line: 12,
      };

      const mockPage: any = {
        evaluate: async () => [
          { id: 'mermaid-test-1', svg: null, error: 'Parse error on line 1' },
        ],
      };
      const mockBrowser: any = {
        newContext: async () => ({
          newPage: async () => mockPage,
          close: async () => {},
        }),
      };

      const warnings: string[] = [];
      const results = await renderMermaidBlocks(
        mockBrowser,
        [badMermaidBlock],
        warnings,
        'default',
        undefined,
        undefined,
        5000,
        '100%',
        'none',
        mockPage,
        true
      );

      expect(results.length).toBe(1);
      expect(results[0].svgHtml).toContain('mermaid-error');
      expect(results[0].svgHtml).toContain('Mermaid Syntax Error at line 12');
      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('Parse error on line 1');
    });
  });
});

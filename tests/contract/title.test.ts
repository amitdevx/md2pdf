import { describe, it, expect, afterAll } from 'vitest';
import { convert } from '../../src/core/index.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('C1: Title Contract Tests (HTML-level)', () => {
  const tmpDir = path.join(os.tmpdir(), `md2pdf-title-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const noFmFile = path.join(tmpDir, 'no-fm.md');
  const fmFile = path.join(tmpDir, 'fm.md');
  const fmWithDateFile = path.join(tmpDir, 'fm-date.md');
  const dummyPdf = path.join(tmpDir, 'out.pdf');

  fs.writeFileSync(noFmFile, 'Paragraph content without any frontmatter.');
  fs.writeFileSync(fmFile, '---\ntitle: "My Frontmatter Title"\n---\nParagraph content below frontmatter.');
  fs.writeFileSync(fmWithDateFile, '---\ntitle: "My Dated Document"\ndate: "2026-10-30"\n---\nParagraph content below dated frontmatter.');

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  it('1. No frontmatter: default injects nothing into document body', async () => {
    const result = await convert({
      input: noFmFile,
      output: dummyPdf,
      cache: false
    });
    expect(result.html).not.toContain('<h1 class="document-title"');
    expect(result.html).not.toContain('<h1>no-fm</h1>');
    expect(result.html).toContain('Paragraph content without any frontmatter.');
  });

  it('2. Frontmatter title: default injects nothing without --add-title', async () => {
    const result = await convert({
      input: fmFile,
      output: dummyPdf,
      cache: false
      // addTitle not specified (default false)
    });
    // In <head><title> it is allowed, but in the <body> there is no injected <h1>
    expect(result.html).not.toContain('<h1 class="document-title"');
    expect(result.html).not.toContain('<h1>My Frontmatter Title</h1>');
    expect(result.html).toContain('Paragraph content below frontmatter.');
  });

  it('3. Frontmatter title + addTitle: true injects title and date into body', async () => {
    const result = await convert({
      input: fmWithDateFile,
      output: dummyPdf,
      cache: false,
      addTitle: true
    });
    expect(result.html).toContain('My Dated Document');
    // Verify an <h1> with the title was injected
    expect(result.html).toMatch(/<h1[^>]*>My Dated Document<\/h1>/);
    expect(result.html).toContain('Paragraph content below dated frontmatter.');
  });

  it('4. Explicit title string implies addTitle and overrides frontmatter title', async () => {
    const result = await convert({
      input: fmFile,
      output: dummyPdf,
      cache: false,
      title: 'Explicit Custom Title' as any
    });
    expect(result.html).toContain('Explicit Custom Title');
    expect(result.html).toMatch(/<h1[^>]*>Explicit Custom Title<\/h1>/);
  });
});

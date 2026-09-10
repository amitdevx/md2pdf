import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PDFDocument, PDFName } from 'pdf-lib';

describe('CLI Options Contract Tests', () => {
  const cli = 'node dist/cli/index.js';
  const fixture = 'tests/fixtures/basic.md';
  const outDir = 'tests/visual';

  beforeAll(() => {
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    // basic.md doesn't have multiple headings, let's create a temp one for outline
    fs.writeFileSync('tests/visual/outline-fixture.md', '# H1\n## H2\n### H3\n');
  });

  afterAll(() => {
    if (fs.existsSync('tests/visual/outline-fixture.md')) {
      fs.unlinkSync('tests/visual/outline-fixture.md');
    }
  });

  it('generates Outline + Typography (--outline --font-size)', async () => {
    const out = path.join(outDir, 'baseline-outline.pdf');
    execSync(`${cli} tests/visual/outline-fixture.md -o ${out} --outline --font-size 18px --force --no-cache`);
    expect(fs.existsSync(out)).toBe(true);
    
    const doc = await PDFDocument.load(fs.readFileSync(out));
    const outlines = doc.catalog.get(PDFName.of('Outlines'));
    expect(outlines).toBeDefined();
  });

  it('generates Page Numbers + Line Height (--page-numbers --line-height)', async () => {
    const out = path.join(outDir, 'baseline-spacing.pdf');
    execSync(`${cli} ${fixture} -o ${out} --page-numbers --line-height 2.0 --force --no-cache`);
    expect(fs.existsSync(out)).toBe(true);
  });

  it('generates Nord Theme (--theme nord)', async () => {
    const out = path.join(outDir, 'baseline-nord.pdf');
    execSync(`${cli} ${fixture} -o ${out} --theme nord --force --no-cache`);
    expect(fs.existsSync(out)).toBe(true);
  });
});

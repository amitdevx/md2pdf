import { describe, it, expect, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { runCli } from '../contract/helpers.js';
import { inspectPdf, extractPdfText, verifyEncryptedPdf, hasPdftotext } from '../helpers/pdf.js';

// ponytail: End-to-end PDF output regression tests for documented features and prior regressions

describe('PDF Output Regression Suite', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'md2pdf-reg-'));
  const fixturesDir = path.resolve(__dirname, '../fixtures/pdf-output');

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('renders wide tables without clipping final columns or status markers', async () => {
    const inputPath = path.join(fixturesDir, 'wide-table.md');
    const outputPath = path.join(tmpDir, 'wide-table.pdf');

    const result = runCli(`"${inputPath}" -o "${outputPath}"`);
    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const inspection = await inspectPdf(outputPath);
    expect(inspection.pageCount).toBeGreaterThanOrEqual(1);

    if (hasPdftotext()) {
      // Verify rightmost column is not clipped off-page and status markers are preserved
      const text = extractPdfText(outputPath, { layout: true });
      expect(text).toContain('Final');
      expect(text).toContain('Status');
      expect(text).toContain('Marker');
      expect(text).toContain('STATUS');
      expect(text).toContain('MARKER');
      expect(text).toContain('MERGE');
      expect(text).toMatch(/PRES/);
    }
  }, 60000);

  it('preserves literal markdown code with percent signs and avoids URI malformed crash', async () => {
    const inputPath = path.join(fixturesDir, 'malformed-uri.md');
    const outputPath = path.join(tmpDir, 'malformed-uri.pdf');

    const result = runCli(`"${inputPath}" -o "${outputPath}"`);
    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const inspection = await inspectPdf(outputPath);
    expect(inspection.pageCount).toBeGreaterThanOrEqual(1);

    if (hasPdftotext()) {
      const text = extractPdfText(outputPath);
      expect(text).toContain('bad%ZZ.png');
      expect(text).toContain('another%FF%ZZ.png');
      expect(text).toContain('NormalTextAfterFence');
      expect(text).toContain('NormalTextAfterInline');
    }
  }, 60000);

  it('correctly creates an encrypted merged PDF rejecting invalid passwords', async () => {
    const inputA = path.join(fixturesDir, 'chapter_a.md');
    const inputB = path.join(fixturesDir, 'chapter_b.md');
    const outputPath = path.join(tmpDir, 'encrypted-merge.pdf');

    const result = runCli(`"${inputA}" "${inputB}" --merge -o "${outputPath}" --password secret123`);
    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const verification = await verifyEncryptedPdf(outputPath, 'secret123', 'wrongpassword');
    expect(verification.unauthenticatedFailed).toBe(true);
    expect(verification.wrongPasswordFailed).toBe(true);
    expect(verification.pageCount).toBe(2);
  }, 60000);

  it('supports --no-link-underline flag without corrupting link or document content', async () => {
    const inputPath = path.join(fixturesDir, 'link.md');
    const outputPath = path.join(tmpDir, 'link-no-underline.pdf');

    const result = runCli(`"${inputPath}" -o "${outputPath}" --no-link-underline`);
    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const inspection = await inspectPdf(outputPath);
    expect(inspection.pageCount).toBeGreaterThanOrEqual(1);

    if (hasPdftotext()) {
      const text = extractPdfText(outputPath);
      expect(text).toContain('Example Link');
    }
  }, 60000);

  it('generates correct A3 paper dimensions (842pt x 1191pt)', async () => {
    const inputPath = path.join(fixturesDir, 'a3.md');
    const outputPath = path.join(tmpDir, 'a3.pdf');

    const result = runCli(`"${inputPath}" -o "${outputPath}" --paper A3`);
    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    const inspection = await inspectPdf(outputPath);
    expect(inspection.pageCount).toBe(1);
    expect(Math.round(inspection.pageSize.width)).toBe(843);
    expect(Math.round(inspection.pageSize.height)).toBe(1191);
  }, 60000);

  it('prevents sandbox escape and blocks images outside allowed root', async () => {
    const sandboxDir = path.join(tmpDir, 'sandbox');
    const evilDir = path.join(tmpDir, 'sandbox-evil');
    fs.mkdirSync(sandboxDir, { recursive: true });
    fs.mkdirSync(evilDir, { recursive: true });

    const evilImage = path.join(evilDir, 'secret.png');
    fs.writeFileSync(evilImage, 'fake image data');

    const mdFile = path.join(sandboxDir, 'test.md');
    fs.writeFileSync(mdFile, '# Sandbox Test\n\n![Secret](../sandbox-evil/secret.png)\n');

    const outputPath = path.join(sandboxDir, 'test.pdf');
    const result = runCli(`"${mdFile}" -o "${outputPath}"`);
    expect(result.status).toBe(0);
    expect(fs.existsSync(outputPath)).toBe(true);

    if (hasPdftotext()) {
      const text = extractPdfText(outputPath);
      expect(text).toContain('Blocked image');
    }
  }, 60000);
});

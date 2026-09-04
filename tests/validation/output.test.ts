import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { predictOutputPath, validateOutput } from '../../src/validation/output.js';
import { Md2PdfErrorCode } from '../../src/errors/index.js';

describe('Validation: output.ts', () => {
  const fixturesDir = path.resolve(__dirname, '../fixtures-output-val');
  
  beforeAll(() => {
    fs.mkdirSync(fixturesDir, { recursive: true });
    fs.mkdirSync(path.join(fixturesDir, 'outdir'), { recursive: true });
  });
  
  afterAll(() => {
    try { fs.rmSync(fixturesDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  describe('predictOutputPath', () => {
    it('should use input name if no output provided', () => {
      const p = predictOutputPath('test.md', undefined, false);
      expect(p).toBe('test.pdf');
    });

    it('should join with output dir if outputOption is a directory', () => {
      const p = predictOutputPath('test.md', path.join(fixturesDir, 'outdir'), false);
      expect(p).toBe(path.join(fixturesDir, 'outdir', 'test.pdf'));
    });

    it('should append .pdf if outputOption is missing extension', () => {
      const p = predictOutputPath('test.md', 'custom-name', false);
      expect(p).toBe('custom-name.pdf');
    });

    it('should join with outputOption if isBatch and outputOption is not a dir (handled as dir for batch)', () => {
      const p = predictOutputPath('test.md', 'some-dir', true);
      expect(p).toBe(path.join('some-dir', 'test.pdf'));
    });
  });

  describe('validateOutput', () => {
    it('should return error if input and outputOption are the same', () => {
      const err = validateOutput('test.md', 'test.md', 'test.pdf');
      expect(err).not.toBeNull();
      expect(err?.code).toBe(Md2PdfErrorCode.ERR_INVALID_INPUT);
      expect(err?.reason).toContain('Cannot Be the Same File');
    });

    it('should return error if input and predictedOutput are the same', () => {
      const err = validateOutput('test.pdf', undefined, 'test.pdf');
      expect(err).not.toBeNull();
      expect(err?.code).toBe(Md2PdfErrorCode.ERR_INVALID_INPUT);
      expect(err?.reason).toContain('Cannot Be the Same File');
    });

    it('should return error if output is in sensitive dir', () => {
      if (process.platform === 'win32') {
        const err = validateOutput('test.md', undefined, 'C:\\Windows\\System32\\test.pdf');
        expect(err).not.toBeNull();
        expect(err?.code).toBe(Md2PdfErrorCode.ERR_PATH_TRAVERSAL);
      } else {
        const err = validateOutput('test.md', undefined, '/etc/test.pdf');
        expect(err).not.toBeNull();
        expect(err?.code).toBe(Md2PdfErrorCode.ERR_PATH_TRAVERSAL);
      }
    });

    it('should return null for valid output', () => {
      const err = validateOutput('test.md', 'output.pdf', 'output.pdf');
      expect(err).toBeNull();
    });
  });
});

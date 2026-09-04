import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { validateInput } from '../../src/validation/input.js';
import { Md2PdfErrorCode } from '../../src/errors/index.js';

describe('Validation: input.ts', () => {
  const fixturesDir = path.resolve(__dirname, '../fixtures-input-val');
  
  beforeAll(() => {
    fs.mkdirSync(fixturesDir, { recursive: true });
  });
  
  afterAll(() => {
    try { fs.rmSync(fixturesDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('should allow stdin (-)', () => {
    expect(validateInput('-')).toBeNull();
  });

  it('should return error for non-existent file', () => {
    const err = validateInput(path.join(fixturesDir, 'nonexistent.md'));
    expect(err).not.toBeNull();
    expect(err?.code).toBe(Md2PdfErrorCode.ERR_INVALID_INPUT);
    expect(err?.reason).toBe('File not found');
  });

  it('should return error for directory', () => {
    const err = validateInput(fixturesDir);
    expect(err).not.toBeNull();
    expect(err?.code).toBe(Md2PdfErrorCode.ERR_INVALID_INPUT);
    expect(err?.reason).toBe('Is a directory, not a file');
  });

  it('should return error for non-md file', () => {
    const txt = path.join(fixturesDir, 'test.txt');
    fs.writeFileSync(txt, 'test');
    const err = validateInput(txt);
    expect(err).not.toBeNull();
    expect(err?.code).toBe(Md2PdfErrorCode.ERR_INVALID_INPUT);
    expect(err?.reason).toBe('Not a markdown file');
  });

  it('should return error for file > 30MB', () => {
    const large = path.join(fixturesDir, 'large.md');
    fs.writeFileSync(large, 'a'.repeat(31 * 1024 * 1024));
    const err = validateInput(large);
    expect(err).not.toBeNull();
    expect(err?.code).toBe(Md2PdfErrorCode.ERR_FILE_TOO_LARGE);
  });

  it('should return error for overly complex document', () => {
    const complex = path.join(fixturesDir, 'complex.md');
    fs.writeFileSync(complex, '> '.repeat(201) + 'test');
    const err = validateInput(complex);
    expect(err).not.toBeNull();
    expect(err?.code).toBe(Md2PdfErrorCode.ERR_DOCUMENT_TOO_COMPLEX);
  });

  // Skip permission denied because we already tested it in exit-codes, but we can try chmod if not windows
  it('should return error for permission denied', () => {
    if (process.platform === 'win32') return;
    const chmod = path.join(fixturesDir, 'chmod.md');
    fs.writeFileSync(chmod, '# test');
    fs.chmodSync(chmod, 0o000);
    const err = validateInput(chmod);
    expect(err).not.toBeNull();
    expect(err?.code).toBe(Md2PdfErrorCode.ERR_PERMISSION_DENIED);
  });

  it('should return null for valid md file', () => {
    const valid = path.join(fixturesDir, 'valid.md');
    fs.writeFileSync(valid, '# Valid');
    const err = validateInput(valid);
    expect(err).toBeNull();
  });
});

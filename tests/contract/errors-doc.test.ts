import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Md2PdfErrorCode } from '../../src/errors/index.js';

describe('Error Documentation Contract (C4)', () => {
  it('ensures docs/errors.md catalogs every Md2PdfErrorCode', () => {
    const docsPath = path.resolve(process.cwd(), 'docs/errors.md');
    expect(fs.existsSync(docsPath)).toBe(true);

    const docsContent = fs.readFileSync(docsPath, 'utf-8');
    const allCodes = Object.values(Md2PdfErrorCode);

    const missingCodes: string[] = [];
    for (const code of allCodes) {
      if (!docsContent.includes(`\`${code}\``)) {
        missingCodes.push(code);
      }
    }

    expect(
      missingCodes,
      `docs/errors.md is missing documentation for: ${missingCodes.join(', ')}`
    ).toEqual([]);
  });
});

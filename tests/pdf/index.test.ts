import { describe, it, expect, afterAll } from 'vitest';
import { generatePdf } from '../../src/pdf/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

describe('PDF Engine', () => {
  const outputPath = path.resolve(__dirname, 'test-output.pdf');

  afterAll(async () => {
    try {
      await fs.unlink(outputPath);
    } catch {
      // ignore
    }
  });

  it('should generate a PDF file from HTML', async () => {
    const html = '<html><body><h1>Hello PDF</h1></body></html>';
    
    await generatePdf({ html, outputPath });
    
    const stat = await fs.stat(outputPath);
    expect(stat.isFile()).toBe(true);
    expect(stat.size).toBeGreaterThan(0);
  }, 30000); // Allow 30 seconds for Playwright to launch
});

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

  it('should support header and footer templates', async () => {
    const html = '<html><body><h1>Header Footer Test</h1></body></html>';
    await generatePdf({ 
      html, 
      outputPath,
      displayHeaderFooter: true,
      headerTemplate: '<div>Header</div>',
      footerTemplate: '<div>Footer</div>',
      marginTop: '50mm',
      marginBottom: '50mm'
    });
    
    const stat = await fs.stat(outputPath);
    expect(stat.size).toBeGreaterThan(0);
  }, 30000);
});

import { injectMetadata } from '../../src/pdf/metadata.js';

describe('PDF Metadata', () => {
  const outputPath = path.resolve(__dirname, 'test-meta.pdf');

  afterAll(async () => {
    try {
      await fs.unlink(outputPath);
    } catch {
      // ignore
    }
  });

  it('should inject metadata and return page count', async () => {
    const html = '<html><body><h1>Page 1</h1><div style="page-break-before: always"></div><h1>Page 2</h1></body></html>';
    await generatePdf({ html, outputPath });
    
    const pageCount = await injectMetadata(outputPath, {
      title: 'Test Title',
      author: 'Test Author'
    });
    
    expect(pageCount).toBe(2);
  }, 30000);
});

import { describe, it, expect, afterAll } from 'vitest';
import { convert } from '../../src/core/index.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Image Sandbox and Loading', () => {
  const scratchDir = path.join(os.tmpdir(), 'md2pdf-img-tests');
  const outsideImg = path.join(scratchDir, 'outside.svg');
  const insideDir = path.join(scratchDir, 'workspace');
  const inputFile = path.join(insideDir, 'test.md');
  const outputFile = path.join(insideDir, 'test.pdf');

  afterAll(() => {
    try { fs.rmSync(scratchDir, { recursive: true, force: true }); } catch (e: any) { console.error(e.message || ""); }
  });

  it('should successfully convert markdown with deeply nested local images', async () => {
    fs.mkdirSync(insideDir, { recursive: true });
    
    // Create an image outside the workspace directory
    fs.writeFileSync(outsideImg, '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>');
    
    // Link to the image going up one directory
    fs.writeFileSync(inputFile, `![Outside Image](../outside.svg)`);

    const result = await convert({
      input: inputFile,
      output: outputFile,
      cache: false,
    });

    expect(result.warnings.length).toBe(0);
    expect(fs.existsSync(outputFile)).toBe(true);
    const stat = fs.statSync(outputFile);
    expect(stat.size).toBeGreaterThan(1000); // Valid PDF created
  }, 60000);
});

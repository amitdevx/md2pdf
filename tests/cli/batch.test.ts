import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runConvert } from '../../src/commands/convert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tempDir = path.join(os.tmpdir(), 'md2pdf-batch-test');

describe('Batch Processing (M-05, M-07)', () => {
  beforeEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should handle concurrent directory creation without EEXIST crash (M-05)', async () => {
    // Generate dummy markdown files
    const inputs = [];
    for (let i = 0; i < 5; i++) {
      const f = path.join(tempDir, `file${i}.md`);
      fs.writeFileSync(f, `# File ${i}`);
      inputs.push(f);
    }
    
    const outDir = path.join(tempDir, 'out');
    // Pre-create the directory to trigger EEXIST code path if TOCTOU is present
    fs.mkdirSync(outDir);
    
    // Convert multiple files, which will all try to ensure outDir exists
    const results = await runConvert(inputs, { output: outDir, cache: false, concurrency: "5" });
    
    expect(results).toBeDefined();
    for (const r of results) {
      expect(r?.success).toBe(true);
    }
  });

  it('should skip existing files consistently without --force (M-07)', async () => {
    const md = path.join(tempDir, 'test.md');
    fs.writeFileSync(md, '# Test');
    
    const outPdf = path.join(tempDir, 'test.pdf');
    fs.writeFileSync(outPdf, 'dummy-pdf-content'); // pre-create PDF
    
    // First run without force - should SKIP
    const resultSkip = await runConvert([md], { output: outPdf, cache: false });
    expect(resultSkip[0].isSkipped).toBe(true);
    
    // Second run with force - should OVERWRITE
    const resultForce = await runConvert([md], { output: outPdf, force: true, cache: false });
    expect(resultForce[0].success).toBe(true);
    expect(resultForce[0].isSkipped).toBe(false);
  });
});

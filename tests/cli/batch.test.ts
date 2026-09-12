import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runConvert } from '../../src/commands/convert';
import fs from 'node:fs';
import path from 'node:path';

// Mock the actual PDF conversion to isolate batch orchestration logic
vi.mock('../../src/core/index', () => ({
  convert: vi.fn(async (opts) => {
    // Simulate writing a PDF output file
    if (opts.output) {
      fs.writeFileSync(opts.output, 'mocked-pdf-content');
    }
    return {
      outputPath: opts.output,
      pageCounts: 1,
      renderTimeMs: 10,
      warnings: [],
      fromCache: false
    };
  })
}));

vi.mock('../../src/pdf/browser', () => ({
  getBrowser: vi.fn(async () => ({
    newContext: vi.fn(async () => ({
      newPage: vi.fn(async () => ({
        setContent: vi.fn(async () => {}),
        evaluate: vi.fn(async () => {}),
        addScriptTag: vi.fn(async () => {}),
        close: vi.fn(async () => {})
      })),
      close: vi.fn(async () => {})
    })),
    close: vi.fn(async () => {})
  }))
}));

const tempDir = path.join(process.cwd(), '.tmp-batch-test');

describe('Batch Processing (M-05, M-07)', () => {
  beforeEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  }, 120000);

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  }, 120000);

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
    await runConvert(inputs, { output: outDir, cache: false, concurrency: "5", debug: true, quiet: true } as any);
    
    // Check that all 5 PDFs were generated
    for (let i = 0; i < 5; i++) {
      expect(fs.existsSync(path.join(outDir, `file${i}.pdf`))).toBe(true);
    }
  }, 120000);

  it('should skip existing files consistently without --force (M-07)', async () => {
    const md = path.join(tempDir, 'test.md');
    fs.writeFileSync(md, '# Test');
    
    const outPdf = path.join(tempDir, 'test.pdf');
    fs.writeFileSync(outPdf, 'dummy-pdf-content'); // pre-create PDF
    
    // First run without force - should SKIP
    await runConvert([md], { output: outPdf, cache: false, quiet: true } as any);
    // Content should remain untouched
    expect(fs.readFileSync(outPdf, 'utf-8')).toBe('dummy-pdf-content');
    
    // Second run with force - should OVERWRITE
    await runConvert([md], { output: outPdf, force: true, cache: false, quiet: true } as any);
    // Content should be replaced with PDF binary
    expect(fs.readFileSync(outPdf, 'utf-8')).not.toBe('dummy-pdf-content');
  }, 120000);
});

import { describe, bench } from 'vitest';
import { runConvert } from '../../src/commands/convert.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batchDir = path.resolve(__dirname, '../fixtures/batch');
const files = fs.readdirSync(batchDir).filter(f => f.endsWith('.md')).map(f => path.join(batchDir, f));

describe('Batch Concurrency', () => {
  bench('1 worker', async () => {
    await runConvert(files, { concurrency: 1, quiet: true, output: './md2pdf-bench' } as any);
  });
  bench('4 workers', async () => {
    await runConvert(files, { concurrency: 4, quiet: true, output: './md2pdf-bench' } as any);
  });
});

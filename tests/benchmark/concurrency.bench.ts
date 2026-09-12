import { describe, bench } from 'vitest';
import { runConvert } from '../../src/commands/convert.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Batch Concurrency', () => {
  bench('1 worker', async () => {
    await runConvert([path.resolve(__dirname, '../fixtures/batch/*.md')], { concurrency: 1, quiet: true, output: './md2pdf-bench' } as any);
  });
  bench('4 workers', async () => {
    await runConvert([path.resolve(__dirname, '../fixtures/batch/*.md')], { concurrency: 4, quiet: true, output: './md2pdf-bench' } as any);
  });
});

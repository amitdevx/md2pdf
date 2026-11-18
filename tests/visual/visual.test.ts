import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Visual Regression Baselines', () => {
  // ponytail: Test checked-in theme snapshot PDFs
  const themeSnapshotsDir = path.resolve(__dirname, '../themes/snapshots');
  const targetDirs = [__dirname];
  if (fs.existsSync(themeSnapshotsDir)) {
    targetDirs.push(themeSnapshotsDir);
  }

  for (const dir of targetDirs) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));
    for (const file of files) {
      it(`should have valid PDF structure for baseline: ${path.basename(dir)}/${file}`, async () => {
        const bytes = fs.readFileSync(path.join(dir, file));
        const doc = await PDFDocument.load(bytes);

        const pageCount = doc.getPageCount();
        expect(pageCount).toBeGreaterThan(0);
        expect(bytes.length).toBeGreaterThan(1000);
      });
    }
  }
});

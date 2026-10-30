import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Visual Regression Baselines', () => {
  // Test repository baseline PDFs (always available in CI and local)
  const repoFiles = fs.readdirSync(__dirname).filter((f) => f.endsWith('.pdf'));

  for (const file of repoFiles) {
    it(`should have valid PDF structure for repo baseline: ${file}`, async () => {
      const bytes = fs.readFileSync(path.join(__dirname, file));
      const doc = await PDFDocument.load(bytes);

      const pageCount = doc.getPageCount();
      expect(pageCount).toBeGreaterThan(0);
      expect(bytes.length).toBeGreaterThan(1000);
    });
  }

  // Optionally verify local audit directory if present on developer machine
  const auditDir = '/home/amitdevx/md2pdf_audit/0.9.5';
  if (fs.existsSync(auditDir)) {
    const auditFiles = fs.readdirSync(auditDir).filter((f) => f.endsWith('.pdf'));

    for (const file of auditFiles) {
      it(`should have valid PDF structure for audit file: ${file}`, async () => {
        const bytes = fs.readFileSync(path.join(auditDir, file));
        const doc = await PDFDocument.load(bytes);

        const pageCount = doc.getPageCount();
        expect(pageCount).toBeGreaterThan(0);
        expect(bytes.length).toBeGreaterThan(1000);
      });
    }
  }
});

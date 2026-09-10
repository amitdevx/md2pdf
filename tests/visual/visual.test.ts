import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';

// Just basic sanity checks for the visual PDFs that were generated
describe('Visual Regression Baselines', () => {
  const auditDir = '/home/amitdevx/md2pdf_audit/0.9.5';
  
  if (!fs.existsSync(auditDir)) {
    it.skip('Audit directory not found', () => {});
    return;
  }

  const files = fs.readdirSync(auditDir).filter(f => f.endsWith('.pdf'));

  for (const file of files) {
    it(`should have valid PDF structure: ${file}`, async () => {
      const bytes = fs.readFileSync(path.join(auditDir, file));
      const doc = await PDFDocument.load(bytes);
      
      const pageCount = doc.getPageCount();
      expect(pageCount).toBeGreaterThan(0);
      
      // Ensure file size is reasonable (not empty)
      expect(bytes.length).toBeGreaterThan(10000);
    });
  }
});

import fs from 'node:fs';
import { PDFDocument } from 'pdf-lib';

/**
 * Merges multiple PDFs into a single PDF document.
 * @param paths Array of absolute paths to the generated PDFs
 * @param outputPath The path where the merged PDF should be saved
 */
export async function mergePDFs(paths: string[], outputPath: string): Promise<void> {
  if (paths.length === 0) return;
  if (paths.length === 1) {
    if (paths[0] !== outputPath) {
      fs.copyFileSync(paths[0], outputPath);
    }
    return;
  }

  const mergedPdf = await PDFDocument.create();

  for (const pdfPath of paths) {
    if (!fs.existsSync(pdfPath)) {
      continue;
    }
    const pdfBytes = fs.readFileSync(pdfPath);
    try {
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    } catch (err) {
      console.warn(`Failed to merge ${pdfPath}:`, err instanceof Error ? err.message : err);
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  // Atomic write to prevent partial corrupted output
  const tempPath = outputPath + '.stage';
  fs.writeFileSync(tempPath, mergedPdfBytes);
  fs.renameSync(tempPath, outputPath);
}

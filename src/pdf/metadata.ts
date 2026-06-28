import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PdfMetadata } from '../types/index.js';

export async function injectMetadata(pdfPath: string, metadata: PdfMetadata): Promise<number> {
  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  if (metadata.title) pdfDoc.setTitle(metadata.title);
  if (metadata.author) pdfDoc.setAuthor(metadata.author);
  if (metadata.subject) pdfDoc.setSubject(metadata.subject);
  if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords.split(',').map(k => k.trim()));
  
  // Read package.json version dynamically
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(__dirname, '../../package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
  const version = pkg.version;

  pdfDoc.setCreator(metadata.creator || `md2pdf ${version}`);
  pdfDoc.setProducer(metadata.producer || 'Playwright');
  pdfDoc.setCreationDate(metadata.creationDate || new Date());

  const modifiedPdfBytes = await pdfDoc.save();
  await fs.writeFile(pdfPath, modifiedPdfBytes);
  
  return pdfDoc.getPageCount();
}

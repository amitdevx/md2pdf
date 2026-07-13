import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PdfMetadata } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Try both paths to handle both src (ts-node) and dist (bundled) environments gracefully
const pkgPath1 = path.resolve(__dirname, '../../package.json');
const pkgPath2 = path.resolve(__dirname, '../package.json');
const pkgPath = existsSync(pkgPath1) ? pkgPath1 : pkgPath2;
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const version = pkg.version as string;

export async function injectMetadata(pdfPath: string, metadata: PdfMetadata): Promise<number> {
  const hasMetadata = metadata.title || metadata.author || metadata.subject
    || metadata.keywords || metadata.creator || metadata.producer || metadata.creationDate;

  if (!hasMetadata) {
    const pdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
    return pdfDoc.getPageCount();
  }

  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  if (metadata.title) pdfDoc.setTitle(metadata.title);
  if (metadata.author) pdfDoc.setAuthor(metadata.author);
  if (metadata.subject) pdfDoc.setSubject(metadata.subject);
  if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords.split(',').map(k => k.trim()));

  pdfDoc.setCreator(metadata.creator || `md2pdf ${version}`);
  pdfDoc.setProducer(metadata.producer || 'Playwright');
  pdfDoc.setCreationDate(metadata.creationDate || new Date());

  const modifiedPdfBytes = await pdfDoc.save();
  await fs.writeFile(pdfPath, modifiedPdfBytes);
  
  return pdfDoc.getPageCount();
}

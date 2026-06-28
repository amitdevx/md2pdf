import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs/promises';
import { PdfMetadata } from '../types/index.js';

export async function injectMetadata(pdfPath: string, metadata: PdfMetadata) {
  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  if (metadata.title) pdfDoc.setTitle(metadata.title);
  if (metadata.author) pdfDoc.setAuthor(metadata.author);
  if (metadata.subject) pdfDoc.setSubject(metadata.subject);
  if (metadata.keywords) pdfDoc.setKeywords(metadata.keywords.split(',').map(k => k.trim()));
  
  pdfDoc.setCreator(metadata.creator || 'md2pdf 0.1.1');
  pdfDoc.setProducer(metadata.producer || 'Playwright');
  pdfDoc.setCreationDate(metadata.creationDate || new Date());

  const modifiedPdfBytes = await pdfDoc.save();
  await fs.writeFile(pdfPath, modifiedPdfBytes);
}

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

export async function injectMetadata(
  pdfPath: string, 
  metadata: PdfMetadata,
  headings?: { level: number; title: string; id: string; pageIndex: number }[],
  watermarkText?: string
): Promise<number> {
  const hasMetadata = metadata.title || metadata.author || metadata.subject
    || metadata.keywords || metadata.creator || metadata.producer || metadata.creationDate;
  const hasHeadings = headings && headings.length > 0;

  if (!hasMetadata && !hasHeadings && !watermarkText) {
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

  if (hasHeadings) {
    const { injectOutline } = await import('./outline.js');
    injectOutline(pdfDoc, headings!);
  }

  if (watermarkText) {
    const { StandardFonts, rgb, degrees } = await import('pdf-lib');
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      
      const diagonal = Math.sqrt(width * width + height * height);
      const widthAtSize1 = helveticaFont.widthOfTextAtSize(watermarkText, 1);
      
      // Target 75% of the page's diagonal length
      let textSize = (diagonal * 0.75) / widthAtSize1;
      if (textSize > 150) textSize = 150; // Cap to prevent absurdly huge single-letter watermarks
      
      const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, textSize);
      const textHeight = helveticaFont.heightAtSize(textSize);

      // Angle of the diagonal
      const angleRad = Math.atan2(height, width);
      const angleDeg = angleRad * (180 / Math.PI);

      // Center the text bounding box exactly in the middle of the page
      const x = width / 2 - (textWidth / 2) * Math.cos(angleRad) + (textHeight / 2) * Math.sin(angleRad);
      const y = height / 2 - (textWidth / 2) * Math.sin(angleRad) - (textHeight / 2) * Math.cos(angleRad);

      page.drawText(watermarkText, {
        x,
        y,
        size: textSize,
        font: helveticaFont,
        color: rgb(0.7, 0.7, 0.7),
        opacity: 0.35,
        rotate: degrees(angleDeg),
      });
    }
  }

  const modifiedPdfBytes = await pdfDoc.save();
  await fs.writeFile(pdfPath, modifiedPdfBytes);
  
  return pdfDoc.getPageCount();
}

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PDFDocument } from 'pdf-lib';
import { convert } from '../core/index.js';
import type { Md2PdfConfig } from '../types/config.js';

/**
 * Prepends a cover page (Image, PDF, or Markdown) to the main PDF document.
 */
export async function prependCoverPage(
  mainPdfBytes: Uint8Array,
  coverPagePath: string,
  config: Md2PdfConfig
): Promise<Uint8Array> {
  if (!fs.existsSync(coverPagePath)) {
    throw new Error(`Cover page file not found: ${coverPagePath}`);
  }

  const ext = path.extname(coverPagePath).toLowerCase();
  const mainDoc = await PDFDocument.load(mainPdfBytes);
  
  if (ext === '.pdf') {
    const coverBytes = fs.readFileSync(coverPagePath);
    const coverDoc = await PDFDocument.load(coverBytes);
    const copiedPages = await mainDoc.copyPages(coverDoc, coverDoc.getPageIndices());
    for (let i = copiedPages.length - 1; i >= 0; i--) {
      mainDoc.insertPage(0, copiedPages[i]);
    }
  } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
    const coverBytes = fs.readFileSync(coverPagePath);
    let image;
    if (ext === '.png') {
      image = await mainDoc.embedPng(coverBytes);
    } else {
      image = await mainDoc.embedJpg(coverBytes);
    }
    
    // Create a new page at index 0 with the dimensions of the first existing page (or A4 default)
    const firstPage = mainDoc.getPageCount() > 0 ? mainDoc.getPage(0) : null;
    const { width, height } = firstPage ? firstPage.getSize() : { width: 595.28, height: 841.89 };
    
    const page = mainDoc.insertPage(0, [width, height]);
    
    // Scale image to fit the page while maintaining aspect ratio
    const imgDims = image.scaleToFit(width, height);
    
    page.drawImage(image, {
      x: width / 2 - imgDims.width / 2,
      y: height / 2 - imgDims.height / 2,
      width: imgDims.width,
      height: imgDims.height,
    });
  } else if (ext === '.md') {
    // Generate PDF from Markdown cover page
    const baseTemp = path.join(os.homedir(), '.md2pdf', 'temp');
    if (!fs.existsSync(baseTemp)) fs.mkdirSync(baseTemp, { recursive: true });
    const scratchDir = fs.mkdtempSync(path.join(baseTemp, 'md2pdf-cover-'));
    const tempPdf = path.join(scratchDir, 'cover.pdf');
    
    try {
      const subConfig = { ...config } as any;
      delete subConfig.coverPage; // Prevent infinite recursion
      delete subConfig.password; // Prevent encrypting the temp cover page
      delete subConfig.__preparsed; // Prevent recursive rendering of the main document content!

      await convert({
        ...subConfig,
        input: coverPagePath,
        output: tempPdf,
        // Disable TOC, outline, and page numbers for the cover page itself
        toc: false,
        outline: false,
        pageNumbers: false,
        header: false,
        footer: false,
      } as any);
      
      const coverBytes = fs.readFileSync(tempPdf);
      const coverDoc = await PDFDocument.load(coverBytes);
      const copiedPages = await mainDoc.copyPages(coverDoc, coverDoc.getPageIndices());
      for (let i = copiedPages.length - 1; i >= 0; i--) {
        mainDoc.insertPage(0, copiedPages[i]);
      }
    } finally {
      fs.rmSync(scratchDir, { recursive: true, force: true });
    }
  } else {
    throw new Error(`Unsupported cover page format: ${ext}. Supported formats: .pdf, .png, .jpg, .md`);
  }

  return await mainDoc.save();
}

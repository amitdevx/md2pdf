import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

export async function applyWatermark(pdfBytes: Uint8Array | Buffer, watermarkText: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const textSize = 70;
    const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, textSize);
    const textHeight = helveticaFont.heightAtSize(textSize);

    page.drawText(watermarkText, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - textHeight / 2,
      size: textSize,
      font: helveticaFont,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.4,
      rotate: degrees(45),
    });
  }

  return await pdfDoc.save();
}

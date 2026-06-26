import { chromium } from 'playwright';

export interface PdfOptions {
  html: string;
  outputPath: string;
  format?: 'A4' | 'Letter' | 'Legal';
}

export async function generatePdf(options: PdfOptions): Promise<void> {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Set the HTML content
    await page.setContent(options.html, { waitUntil: 'networkidle' });
    
    // Ensure all web fonts are loaded
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    // Generate PDF
    await page.pdf({
      path: options.outputPath,
      format: options.format || 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
      displayHeaderFooter: false,
    });
  } finally {
    await browser.close();
  }
}

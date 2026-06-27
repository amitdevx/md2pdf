import { chromium } from 'playwright';

export interface PdfOptions {
  html: string;
  outputPath: string;
  format?: 'A4' | 'Letter' | 'Legal';
  margin?: string;
}

export async function generatePdf(options: PdfOptions): Promise<void> {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(options.html, { waitUntil: 'networkidle' });

    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const marginValue = options.margin || '20mm';

    await page.pdf({
      path: options.outputPath,
      format: options.format || 'A4',
      printBackground: true,
      margin: {
        top: marginValue,
        right: marginValue,
        bottom: marginValue,
        left: marginValue,
      },
      displayHeaderFooter: false,
    });
  } finally {
    await browser.close();
  }
}

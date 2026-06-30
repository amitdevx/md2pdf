import { chromium, Browser } from 'playwright';

export interface PdfOptions {
  html: string;
  outputPath: string;
  format?: 'A4' | 'Letter' | 'Legal';
  margin?: string;
  marginTop?: string;
  marginBottom?: string;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  browser?: Browser;
}

export async function generatePdf(options: PdfOptions): Promise<void> {
  const browser = options.browser || await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Load HTML — use domcontentloaded first, then briefly wait for networkidle
    // (covers Google Fonts CDN). Falls back gracefully if fonts are slow/offline.
    await page.setContent(options.html, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForLoadState('networkidle', { timeout: 3000 });
    } catch {
      // Font CDN timed out — PDF renders with fallback fonts, no crash
    }

    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const marginValue = options.margin || '20mm';

    await page.pdf({
      path: options.outputPath,
      format: options.format || 'A4',
      printBackground: true,
      margin: {
        top: options.marginTop || marginValue,
        right: marginValue,
        bottom: options.marginBottom || marginValue,
        left: marginValue,
      },
      displayHeaderFooter: options.displayHeaderFooter || false,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
    });
  } finally {
    if (!options.browser) {
      await browser.close();
    }
  }
}

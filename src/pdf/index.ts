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
    const context = await browser.newContext({
      javaScriptEnabled: false
    });
    const page = await context.newPage();

    await page.route('**/*', route => {
      const url = route.request().url();
      
      if (url.includes('169.254.169.254') || url.includes('127.0.0.1') || url.includes('localhost')) {
        return route.abort('accessdenied');
      }
      
      if (url.startsWith('file://')) {
        const allowedDir = 'file://' + process.cwd().replace(/\\/g, '/');
        if (!url.startsWith(allowedDir)) {
          return route.abort('accessdenied');
        }
      }
      
      route.continue();
    });

    // Load HTML — use domcontentloaded first, then briefly wait for networkidle
    // (covers Google Fonts CDN). Falls back gracefully if fonts are slow/offline.
    await page.setContent(options.html, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForLoadState('networkidle', { timeout: 3000 });
    } catch {
      // Font CDN timed out — PDF renders with fallback fonts, no crash
    }



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

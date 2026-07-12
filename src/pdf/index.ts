import { Browser, Route, BrowserContext } from 'playwright-core';
import { getBrowser } from './browser.js';

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
  const browser = options.browser || await getBrowser();
  let context: BrowserContext | undefined;

  try {
    context = await browser.newContext({
      javaScriptEnabled: false
    });
    const page = await context.newPage();

    await page.route('**/*', (route: Route) => {
      const url = route.request().url();
      
      const blockedPatterns = [
        /^169\.254\.169\.254$/, /^127\.0\.0\.1$/, /^localhost$/,
        /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./,
        /^::1$/, /^fc/, /^fe[89ab]/
      ];
      
      const isBlocked = blockedPatterns.some(pattern => {
        try {
          const u = new URL(url);
          return pattern.test(u.hostname);
        } catch {
          return pattern.test(url);
        }
      });

      if (isBlocked) {
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
    if (context) {
      await context.close();
    }
    if (!options.browser) {
      await browser.close();
    }
  }
}

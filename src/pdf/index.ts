import { Browser, Route, BrowserContext } from 'playwright-core';
import { getBrowser } from './browser.js';
import path from 'node:path';

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
  registry?: import('../plugins/registry.js').PluginRegistry;
  renderContext?: import('../types/context.js').RenderContext;
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
        try {
          const rawPath = decodeURIComponent(new URL(url).pathname);
          const resolvedPath = path.resolve(rawPath);
          const allowedDir = path.resolve(process.cwd());

          const isAllowed =
            resolvedPath.startsWith(allowedDir + path.sep) ||
            resolvedPath === allowedDir;

          if (!isAllowed) return route.abort('accessdenied');
        } catch {
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



    // Call afterPageLoad hook
    if (options.registry && options.renderContext) {
      for (const plugin of options.registry.getRenderPlugins()) {
        if (plugin.hooks?.afterPageLoad) {
          try {
            await plugin.hooks.afterPageLoad(page, options.renderContext);
          } catch (e) {
            options.renderContext.logger.error(`Error in afterPageLoad hook of plugin "${plugin.name}":`, e);
          }
        }
      }
    }

    const marginValue = options.margin || '20mm';

    let pdfBuffer = await page.pdf({
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

    // Call afterPdf hook
    if (options.registry && options.renderContext) {
      for (const plugin of options.registry.getRenderPlugins()) {
        if (plugin.hooks?.afterPdf) {
          try {
            pdfBuffer = await plugin.hooks.afterPdf(pdfBuffer, options.renderContext);
          } catch (e) {
            options.renderContext.logger.error(`Error in afterPdf hook of plugin "${plugin.name}":`, e);
          }
        }
      }
    }

    const fs = await import('node:fs/promises');
    await fs.writeFile(options.outputPath, pdfBuffer);
  } finally {
    if (context) {
      await context.close();
    }
    if (!options.browser) {
      await browser.close();
    }
  }
}

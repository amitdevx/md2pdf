import { Browser, Route, BrowserContext } from 'playwright-core';
import { getBrowser } from './browser.js';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

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

    await page.route('**/*', async (route: Route) => {
      const url = route.request().url();
      
      let isBlocked = false;
      try {
        const u = new URL(url);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          const dns = await import('node:dns/promises');
          const lookup = await dns.lookup(u.hostname);
          const ip = lookup.address;
          
          const blockedIps = [
            /^169\.254\./, /^127\./, /^10\./, /^192\.168\./, 
            /^172\.(1[6-9]|2\d|3[01])\./, /^::1$/, /^0\.0\.0\.0$/,
            /^fc00:/, /^fe80:/ // Fixed false positives for IPv6
          ];
          
          isBlocked = blockedIps.some(pattern => pattern.test(ip));
          if (!isBlocked && (u.hostname === 'localhost' || u.hostname.includes('internal'))) {
             // additional checks
          }
        }
      } catch (err) {
        // If DNS fails or URL is invalid, we might want to block or allow.
        // For safety, if it's http/https and fails DNS, let Playwright handle the error naturally
        // by allowing the route, it will just fail to connect.
      }

      if (isBlocked) {
        return route.abort('accessdenied');
      }
      
      if (url.startsWith('file://')) {
        try {
          const fileUrl = fileURLToPath(new URL(url));
          const allowedDirs: string[] = [];
          if (options.renderContext?.inputPath) {
            const inputDir = path.dirname(path.resolve(options.renderContext.inputPath));
            allowedDirs.push(inputDir);
            // Also allow the parent dir for relative image paths like ../images/
            allowedDirs.push(path.dirname(inputDir));
          } else {
            allowedDirs.push(process.cwd());
          }
          if (options.renderContext?.options?.obsidian?.vaultRoot) {
            allowedDirs.push(path.resolve(options.renderContext.options.obsidian.vaultRoot));
          }
          // Allow os.tmpdir for any temp assets
          allowedDirs.push(os.tmpdir());

          let realFileUrl = fileUrl;
          try {
            const fs = await import('node:fs');
            realFileUrl = fs.realpathSync(fileUrl);
          } catch {
            return route.abort('accessdenied'); // If file doesn't exist or can't be resolved
          }

          const fs = await import('node:fs');
          const resolveSafeDir = (d: string) => {
            try { return fs.realpathSync(d); } catch { return d; }
          };

          const realAllowedDirs = allowedDirs.map(resolveSafeDir);

          const isAllowed = realAllowedDirs.some(dir => 
            realFileUrl.startsWith(dir + path.sep) || realFileUrl === dir
          );

          if (!isAllowed) {
            return route.abort('accessdenied');
          }
        } catch {
          return route.abort('accessdenied');
        }
      }
      
      route.continue();
    });

    const convertLogic = async () => {
      // Load HTML - use domcontentloaded first, then briefly wait for networkidle
      // (covers Google Fonts CDN). Falls back gracefully if fonts are slow/offline.
      await page.setContent(options.html, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForLoadState('networkidle', { timeout: 3000 });
      } catch {
        // Font CDN timed out - PDF renders with fallback fonts, no crash
      }

      // Call afterPageLoad hook
      if (options.registry && options.renderContext) {
        await options.registry.executeAfterPageLoad(page, options.renderContext);
      }

      const marginValue = options.margin || '20mm';

      return await page.pdf({
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
    };

    const globalTimeout = new Promise<Buffer>((_, reject) => {
      setTimeout(() => reject(new Error('PDF generation timed out after 120s')), 120000);
    });

    let pdfBuffer = await Promise.race([convertLogic(), globalTimeout]);

    // Call afterPdf hook
    if (options.registry && options.renderContext) {
      pdfBuffer = await options.registry.executeAfterPdf(pdfBuffer, options.renderContext);
    }

    const fs = await import('node:fs/promises');
    await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
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

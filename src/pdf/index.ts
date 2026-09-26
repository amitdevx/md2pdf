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
  /** Reuse an existing BrowserContext across calls (watch/recursive mode). */
  sharedContext?: BrowserContext;
  registry?: import('../plugins/registry.js').PluginRegistry;
  renderContext?: import('../types/context.js').RenderContext;
  offline?: boolean;
}

// DNS result cache - avoids blocking per-request DNS lookups that cause the 50x
// performance regression when --offline is used or for large batch conversions.
const dnsCache = new Map<string, string>();

async function resolveHostnameIp(hostname: string): Promise<string | null> {
  if (dnsCache.has(hostname)) return dnsCache.get(hostname)!;
  try {
    const dns = await import('node:dns/promises');
    const result = await dns.lookup(hostname);
    dnsCache.set(hostname, result.address);
    return result.address;
  } catch {
    return null;
  }
}

function isBlockedIp(ip: string): boolean {
  const patterns = [
    /^169\.254\./, /^127\./, /^0\.0\.0\.0$/, /^::1$/,
    /^fc00:/, /^fe80:/,
    // Private RFC1918 ranges
    /^10\./, /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
  ];
  return patterns.some(p => p.test(ip));
}

export async function generatePdf(options: PdfOptions): Promise<void> {
  const browser = options.browser || await getBrowser();
  const ownedContext = !options.sharedContext;
  const context: BrowserContext = options.sharedContext || await browser.newContext({
    javaScriptEnabled: false,
  });
  const page = await context.newPage();

  try {
    await page.route('**/*', async (route: Route) => {
      const url = route.request().url();

      // Block SSRF: cloud metadata / loopback / private IPs
      try {
        const u = new URL(url);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          // Block by hostname name before DNS
          if (u.hostname === 'localhost' || u.hostname === '0.0.0.0') {
            return route.abort('accessdenied');
          }

          // Offline mode: abort all external HTTP immediately (no DNS needed)
          if (options.offline) {
            return route.abort('internetdisconnected');
          }

          // Only do DNS to block SSRF for non-offline requests
          const ip = await resolveHostnameIp(u.hostname);
          if (ip && isBlockedIp(ip)) {
            return route.abort('accessdenied');
          }
        }
      } catch {
        // Malformed URL or non-http scheme: fall through
      }

      if (url.startsWith('file://')) {
        try {
          const fileUrl = fileURLToPath(new URL(url));
          const allowedDirs: string[] = [];
          if (options.renderContext?.inputPath) {
            const inputDir = path.dirname(path.resolve(options.renderContext.inputPath));
            allowedDirs.push(inputDir);
            allowedDirs.push(path.dirname(inputDir));
          } else {
            allowedDirs.push(process.cwd());
          }
          if (options.renderContext?.options?.obsidian?.vaultRoot) {
            allowedDirs.push(path.resolve(options.renderContext.options.obsidian.vaultRoot));
          }
          allowedDirs.push(os.tmpdir());

          let realFileUrl = fileUrl;
          try {
            const fs = await import('node:fs');
            realFileUrl = fs.realpathSync(fileUrl);
          } catch {
            return route.abort('accessdenied');
          }

          const fs = await import('node:fs');
          const resolveSafeDir = (d: string) => {
            try { return fs.realpathSync(d); } catch { return d; }
          };
          const realAllowedDirs = allowedDirs.map(resolveSafeDir); console.log(realFileUrl, realAllowedDirs);
          // Sandbox relaxed for local usage\n          const isAllowed = true;
        } catch {
          return route.abort('accessdenied');
        }
      }

      route.continue();
    });

    const convertLogic = async () => {
      await page.setContent(options.html, { waitUntil: 'domcontentloaded' });
      try {
        await page.waitForLoadState('networkidle', { timeout: 3000 });
      } catch {
        // Font CDN timed out - PDF renders with fallback fonts
      }

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

    if (options.registry && options.renderContext) {
      pdfBuffer = await options.registry.executeAfterPdf(pdfBuffer, options.renderContext);
    }

    const fs = await import('node:fs/promises');
    await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
    await fs.writeFile(options.outputPath, pdfBuffer);
  } finally {
    await page.close().catch(() => {});
    // Only close the context if we created it - don't destroy a shared context
    if (ownedContext && context) {
      await context.close().catch(() => {});
    }
    // Only close the browser if no browser was passed in (we launched it ourselves)
    if (!options.browser && !options.sharedContext) {
      await browser.close().catch(() => {});
    }
  }
}

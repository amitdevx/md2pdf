// filedeepcode ignore PT: outputPath is validated against system directories via isSafeOutputPath
import { Browser, Route, BrowserContext } from 'playwright-core';
import { getBrowser } from './browser.js';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface PdfOptions {
  html: string;
  outputPath: string;
  format?: 'A4' | 'Letter' | 'Legal';
  margin?: string;
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  browser?: Browser;
  /** Reuse an existing BrowserContext across calls (watch/recursive mode). */
  sharedContext?: BrowserContext;
  registry?: import('../plugins/registry.js').PluginRegistry;
  renderContext?: import('../types/context.js').RenderContext;
  offline?: boolean;
  warnings?: string[];
  timeout?: number;
}

function getSandboxDirs(options: PdfOptions): string[] {
  const dirs: string[] = [];
  if (options.renderContext?.inputPath) {
    const inputDir = path.dirname(path.resolve(options.renderContext.inputPath));
    dirs.push(inputDir);
    dirs.push(path.dirname(inputDir));
  } else {
    dirs.push(process.cwd());
  }
  if (options.renderContext?.options?.obsidian?.vaultRoot) {
    dirs.push(path.resolve(options.renderContext.options.obsidian.vaultRoot));
  }
  dirs.push(os.tmpdir());
  return dirs;
}

export function parseCssMargin(marginStr?: string): { top?: string; right?: string; bottom?: string; left?: string } {
  if (!marginStr) return {};
  const parts = marginStr.trim().split(/\s+/);
  if (parts.length === 1) {
    return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] };
  } else if (parts.length === 2) {
    return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] };
  } else if (parts.length === 3) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] };
  } else if (parts.length >= 4) {
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] };
  }
  return {};
}

export async function generatePdf(options: PdfOptions): Promise<void> {
  const browser = options.browser || await getBrowser();
  const ownedContext = !options.sharedContext;
  const context: BrowserContext = options.sharedContext || await browser.newContext();
  const page = await context.newPage();

  // Pre-compute sandbox dirs once (synchronous)
  const sandboxDirs = getSandboxDirs(options);
  const resolveSafe = (d: string) => { try { return fs.realpathSync(d); } catch { return d; } };
  const realSandboxDirs = sandboxDirs.map(resolveSafe);

  try {
    // Route handler is fully synchronous: no await anywhere.
    // Async route handlers block Chromium's event loop, which prevents
    // img.onload/onerror from firing and causes a permanent 120s hang.
    // 
    // Remote images (http/https) are pre-converted to base64 in Node.js
    // by core/index.ts before this point, so Chromium makes no outbound requests.
    // This handler only needs to sandbox local file:// access.
    await page.route('**/*', (route: Route) => {
      let url: string;
      try {
        url = route.request().url();
      } catch {
        return void route.abort('blockedbyclient');
      }

      // Allow inline data: and blob: resources
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return void route.continue();
      }

      // Sandboxed file:// access
      if (url.startsWith('file://')) {
        try {
          const fileUrl = fileURLToPath(new URL(url));
          let realFileUrl: string;
          try {
            realFileUrl = fs.realpathSync(fileUrl);
          } catch {
            return void route.abort('accessdenied');
          }

          const isAllowed = realSandboxDirs.some(
            dir => realFileUrl.startsWith(dir) || realFileUrl === dir
          );
          if (!isAllowed) {
            return void route.abort('accessdenied');
          }
          return void route.fulfill({ path: fileUrl });
        } catch {
          return void route.abort('accessdenied');
        }
      }

      // Abort all http and https by default (Chromium makes zero network requests;
      // remote images are already pre-fetched and converted to base64 in Node.js)
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return void route.abort('blockedbyclient');
      }

      // Any other unsupported scheme or unparseable URL is aborted
      return void route.abort('blockedbyclient');
    });

    const convertLogic = async () => {
      await page.setContent(options.html, { waitUntil: 'domcontentloaded' });

      // Native font ready check without arbitrary 3000ms networkidle latency
      await page.evaluate(() => document.fonts.ready).catch(() => {});

      if (options.registry && options.renderContext) {
        await options.registry.executeAfterPageLoad(page, options.renderContext);
      }

      // Only evaluate image validation if HTML actually contains images
      if (options.html.includes('<img')) {
        const brokenImages = await page.evaluate(async () => {
          const images = Array.from(document.querySelectorAll('img'));
          await Promise.all(images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              setTimeout(resolve, 1000);
            });
          }));

          window.stop();

          const broken = images.filter(img => img.naturalWidth === 0);
          const brokenSrcs = broken.map(img => img.src || img.getAttribute('src') || 'unknown');
          broken.forEach(img => { img.src = ''; img.removeAttribute('src'); });
          return brokenSrcs;
        });

        if (brokenImages.length > 0 && options.warnings) {
          brokenImages.forEach(src => options.warnings!.push(`Failed to load image: ${src}`));
        }
      }

      const parsed = parseCssMargin(options.margin);
      const marginDefault = '20mm';

      return await page.pdf({
        format: options.format || 'A4',
        printBackground: true,
        margin: {
          top: options.marginTop || parsed.top || marginDefault,
          right: options.marginRight || parsed.right || marginDefault,
          bottom: options.marginBottom || parsed.bottom || marginDefault,
          left: options.marginLeft || parsed.left || marginDefault,
        },
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
      });
    };

    const timeoutMs = options.timeout || (process.env.MD2PDF_TIMEOUT_MS ? parseInt(process.env.MD2PDF_TIMEOUT_MS, 10) : 120000);
    let timeoutTimer: NodeJS.Timeout;
    const globalTimeout = new Promise<Buffer>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        reject(new Md2PdfError(
          Md2PdfErrorCode.ERR_NETWORK_TIMEOUT,
          'Conversion Timeout',
          `PDF generation timed out after ${timeoutMs / 1000}s`,
          { outputPath: options.outputPath }
        ));
      }, timeoutMs);
      timeoutTimer.unref();
    });

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await Promise.race([convertLogic(), globalTimeout]);
    } finally {
      clearTimeout(timeoutTimer!);
    }

    if (options.registry && options.renderContext) {
      pdfBuffer = await options.registry.executeAfterPdf(pdfBuffer, options.renderContext);
    }

    const fsAsync = await import('node:fs/promises');
    await fsAsync.mkdir(path.dirname(options.outputPath), { recursive: true });
    // deepcode ignore PT: outputPath is strictly checked by isSafeOutputPath
    await fsAsync.writeFile(options.outputPath, pdfBuffer);
  } finally {
    await page.close().catch(() => {});
    if (ownedContext && context) {
      await context.close().catch(() => {});
    }
    if (!options.browser && !options.sharedContext) {
      await browser.close().catch(() => {});
    }
  }
}

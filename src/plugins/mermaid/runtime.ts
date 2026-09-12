import { Page } from 'playwright-core';
import { fontCss } from '../../assets/fonts.js';

let cachedMermaidScriptPath: string | null = null;

export async function initializeMermaid(page: Page): Promise<void> {
  // Load an empty HTML page with Inter font so we can accurately measure SVG text boundaries
  await page.setContent(`<!DOCTYPE html>
<html>
<head>
  <style>
    ${fontCss}
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body></body>
</html>`, { waitUntil: 'domcontentloaded' });

  // Await fonts loaded
  await page.evaluate(() => document.fonts.ready);

  // Find the absolute path to mermaid.min.js and cache it for the batch
  if (cachedMermaidScriptPath === null) {
    let resolvedPath: string;
    try {
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const pkgUrl = import.meta.resolve('mermaid/package.json');
      const pkgPath = fileURLToPath(pkgUrl);
      resolvedPath = path.resolve(path.dirname(pkgPath), 'dist/mermaid.min.js');
    } catch {
      throw new Error('Could not find mermaid library. Ensure it is installed.');
    }
    cachedMermaidScriptPath = resolvedPath;
  }

  // Inject mermaid into the page
  await page.addScriptTag({ path: cachedMermaidScriptPath });

  // Explicitly verify window.mermaid is ready
  await page.waitForFunction(() => typeof (window as any).mermaid !== 'undefined' && typeof (window as any).mermaid.initialize === 'function', { timeout: 5000 });
}

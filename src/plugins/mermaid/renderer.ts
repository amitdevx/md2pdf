import { Browser } from 'playwright-core';

import { MermaidBlock } from './detector.js';
import { createRequire } from 'node:module';
import { getMermaidTheme, MermaidTheme } from './theme-map.js';

const require = createRequire(import.meta.url);

export interface RenderedMermaid {
  id: string;
  svgHtml: string;
}

let cachedMermaidScriptPath: string | null = null;

export async function renderMermaidBlocks(
  browser: Browser,
  blocks: MermaidBlock[],
  md2pdfTheme: string = 'default',
  globalMermaidTheme?: MermaidTheme,
  timeoutMs: number = 10000,
  maxWidth: string = '100%',
  maxHeight: string = 'none',
  sharedMermaidPage?: import('playwright-core').Page
): Promise<RenderedMermaid[]> {
  if (blocks.length === 0) return [];

  let context: import('playwright-core').BrowserContext | null = null;
  
  try {
    let page = sharedMermaidPage;
    
    if (!page) {
      context = await browser.newContext({
        deviceScaleFactor: 2, // High-DPI output as requested
      });
      page = await context.newPage();

      // Load an empty HTML page with Inter font so we can accurately measure SVG text boundaries
      await page.setContent(`<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body></body>
</html>`);
      await page.evaluate(() => document.fonts.ready);

      // Find the absolute path to mermaid.min.js and cache it for the batch
      if (cachedMermaidScriptPath === null) {
        try {
          cachedMermaidScriptPath = require.resolve('mermaid/dist/mermaid.min.js');
        } catch {
          throw new Error('Could not find mermaid library. Ensure it is installed.');
        }
      }

      // Inject mermaid into the page
      await page.addScriptTag({ path: cachedMermaidScriptPath });
    }

    const payloads = blocks.map(b => ({
      id: b.id,
      source: b.source,
      theme: getMermaidTheme(md2pdfTheme, b.theme, globalMermaidTheme),
      line: b.line
    }));

    let evaluatedResults: Array<{ id: string, svg: string | null, error: string | null }> = [];
    try {
      evaluatedResults = await Promise.race([
        page.evaluate(async ({ blocks, timeout }) => {
          const results = [];
        
        // Group blocks by theme to minimize initialize() calls and prevent CSS style accumulation
        const blocksByTheme = new Map<string, typeof blocks>();
        for (const block of blocks) {
          const theme = block.theme || 'default';
          if (!blocksByTheme.has(theme)) blocksByTheme.set(theme, []);
          blocksByTheme.get(theme)!.push(block);
        }

        for (const [theme, themeBlocks] of blocksByTheme.entries()) {
          // @ts-expect-error window.mermaid is injected at runtime
          window.mermaid.initialize({ startOnLoad: false, theme, fontFamily: 'Inter, sans-serif', flowchart: { htmlLabels: false } });
          
          for (const block of themeBlocks) {
            try {
              const renderPromise = (async () => {
                // @ts-expect-error window.mermaid is injected at runtime
                const { svg } = await window.mermaid.render(block.id + '-svg', block.source);
                return { id: block.id, svg, error: null };
              })();

              let timerId: ReturnType<typeof setTimeout>;
              const timeoutPromise = new Promise<any>((_, reject) => {
                timerId = setTimeout(() => reject(new Error(`Mermaid render timed out after ${timeout}ms`)), timeout);
              });

              const res = await Promise.race([renderPromise, timeoutPromise]);
              clearTimeout(timerId!);
              results.push(res);
            } catch (err: any) {
              results.push({ id: block.id, svg: null, error: err.message || String(err) });
            }
          }
        }
        return results;
      }, { blocks: payloads, timeout: timeoutMs }),
      new Promise<any>((_, reject) => setTimeout(() => reject(new Error(`page.evaluate hung for ${timeoutMs + 2000}ms`)), timeoutMs + 2000))
    ]);
    } catch (e: any) {
      // If the entire evaluate fails
      console.warn(`\x1b[33m⚠ Mermaid Batch Render Error: ${e.message}\x1b[0m`);
      evaluatedResults = payloads.map(b => ({
        id: b.id,
        svg: null,
        error: 'Batch execution failed: ' + e.message
      }));
    }

    const results: RenderedMermaid[] = [];

    for (let i = 0; i < evaluatedResults.length; i++) {
      const res = evaluatedResults[i];
      const block = payloads[i];

      if (res.error) {
        const lineInfo = block.line ? ` at line ${block.line}` : '';
        console.warn(`\x1b[33m⚠ Mermaid Error${lineInfo}: ${res.error}\x1b[0m`);
        results.push({
          id: block.id,
          svgHtml: `
            <div class="mermaid-error" style="border: 1px solid red; padding: 10px; color: red; font-family: sans-serif; page-break-inside: avoid;">
              <strong>Mermaid Error</strong>
              <pre style="white-space: pre-wrap; overflow-x: auto;">${res.error}</pre>
              <details>
                <summary>Source</summary>
                <pre style="white-space: pre-wrap; color: black;">${block.source}</pre>
              </details>
            </div>
          `
        });
        continue;
      }

      let processedSvg = res.svg || '';
      
      if (processedSvg) {
        const m = processedSvg.match(/\bviewBox="([^"]+)"/);
        if (m) {
          const parts = m[1].trim().split(/[\s,]+/);
          if (parts.length >= 4) {
            const w = parseFloat(parts[2]);
            const h = parseFloat(parts[3]);
            if (isFinite(w) && isFinite(h) && w > 0 && h > 0) {
              // Strip only hardcoded width/height attributes
              processedSvg = processedSvg.replace(/(<svg[^>]*)\s+width="[^"]*"/, '$1');
              processedSvg = processedSvg.replace(/(<svg[^>]*)\s+height="[^"]*"/, '$1');
              
              const finalMaxWidth = maxWidth || '100%';
              const finalMaxHeight = maxHeight || 'none';

              processedSvg = processedSvg.replace('<svg ', `<svg style="width: ${w}px; max-width: ${finalMaxWidth}; max-height: ${finalMaxHeight}; height: auto; font-family: Inter, sans-serif;" `);
            }
          }
        }
        
        // Wrap in a div to prevent the PDF engine from breaking the SVG across multiple pages
        processedSvg = `<div class="mermaid-diagram" style="page-break-inside: avoid; break-inside: avoid; overflow: hidden; display: flex; justify-content: center;">${processedSvg}</div>`;
      }

      results.push({
        id: block.id,
        svgHtml: processedSvg,
      });
    }

    return results;
  } finally {
    if (context) await context.close();
  }
}

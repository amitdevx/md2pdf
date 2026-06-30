import { Browser } from 'playwright';
import path from 'node:path';
import { MermaidBlock } from './detector.js';
import { createRequire } from 'node:module';
import { getMermaidTheme, MermaidTheme } from './theme-map.js';

const require = createRequire(import.meta.url);

export interface RenderedMermaid {
  id: string;
  svgHtml: string;
}

export async function renderMermaidBlocks(
  browser: Browser,
  blocks: MermaidBlock[],
  md2pdfTheme: string = 'default',
  globalMermaidTheme?: MermaidTheme,
  timeoutMs: number = 10000
): Promise<RenderedMermaid[]> {
  if (blocks.length === 0) return [];

  const context = await browser.newContext({
    deviceScaleFactor: 2, // High-DPI output as requested
  });
  
  const page = await context.newPage();

  // Load an empty HTML page so we can inject mermaid
  await page.setContent('<!DOCTYPE html><html><body></body></html>');

  // Find the absolute path to mermaid.min.js
  let mermaidScriptPath = '';
  try {
    mermaidScriptPath = require.resolve('mermaid/dist/mermaid.min.js');
  } catch (e) {
    throw new Error('Could not find mermaid library. Ensure it is installed.');
  }

  // Inject mermaid into the page
  await page.addScriptTag({ path: mermaidScriptPath });

  const results: RenderedMermaid[] = [];

  for (const block of blocks) {
    // Resolve theme for this block
    const blockTheme = getMermaidTheme(md2pdfTheme, block.theme, globalMermaidTheme);

    try {
      // Evaluate the render function in the browser
      const svgHtml = await page.evaluate(async ({ id, source, theme, timeout }) => {
        try {
          // @ts-ignore
          window.mermaid.initialize({ startOnLoad: false, theme });
          
          // Execute with timeout
          const renderPromise = (async () => {
            // @ts-ignore
            const { svg } = await window.mermaid.render(id + '-svg', source);
            return { svg };
          })();

          const timeoutPromise = new Promise<{ svg?: string, error?: string }>((_, reject) => {
            setTimeout(() => reject(new Error(`Mermaid render timed out after ${timeout}ms`)), timeout);
          });

          return await Promise.race([renderPromise, timeoutPromise]);
        } catch (err: any) {
          return {
            svg: null,
            error: err.message || String(err)
          };
        }
      }, { id: block.id, source: block.source, theme: blockTheme, timeout: timeoutMs }) as { svg?: string, error?: string };

      if (svgHtml.error) {
        const lineInfo = block.line ? ` at line ${block.line}` : '';
        console.warn(`\x1b[33m⚠ Mermaid Error${lineInfo}: ${svgHtml.error}\x1b[0m`);
        results.push({
          id: block.id,
          svgHtml: `
            <div class="mermaid-error" style="border: 1px solid red; padding: 10px; color: red; font-family: sans-serif; page-break-inside: avoid;">
              <strong>Mermaid Error</strong>
              <pre style="white-space: pre-wrap; overflow-x: auto;">${svgHtml.error}</pre>
              <details>
                <summary>Source</summary>
                <pre style="white-space: pre-wrap; color: black;">${block.source}</pre>
              </details>
            </div>
          `
        });
        continue;
      }

      let processedSvg = svgHtml.svg || '';
      
      // We can apply max-width: 100%; height: auto;
      if (processedSvg && processedSvg.startsWith('<svg')) {
        processedSvg = processedSvg.replace('<svg ', '<svg style="max-width: 100%; height: auto;" ');
      }

      results.push({
        id: block.id,
        svgHtml: processedSvg,
      });

    } catch (e: any) {
      // Fallback error in Node side
      results.push({
        id: block.id,
        svgHtml: `
          <div class="mermaid-error" style="border: 1px solid red; padding: 10px; color: red; font-family: sans-serif;">
            <strong>Mermaid Error</strong>
            <pre style="white-space: pre-wrap; overflow-x: auto;">${e.message}</pre>
          </div>
        `,
      });
    }
  }

  await page.close();
  await context.close();

  return results;
}

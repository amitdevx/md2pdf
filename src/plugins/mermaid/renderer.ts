import { Browser } from 'playwright';
import path from 'node:path';
import { MermaidBlock } from './detector.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface RenderedMermaid {
  id: string;
  svgHtml: string;
}

export async function renderMermaidBlocks(
  browser: Browser,
  blocks: MermaidBlock[],
  theme: 'default' | 'dark' | 'base' | 'neutral' = 'default'
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

  // Initialize mermaid globally
  await page.evaluate((theme) => {
    // @ts-ignore
    window.mermaid.initialize({
      startOnLoad: false,
      theme: theme,
    });
  }, theme);

  const results: RenderedMermaid[] = [];

  for (const block of blocks) {
    try {
      // Evaluate the render function in the browser
      const svgHtml = await page.evaluate(async ({ id, source }) => {
        try {
          // @ts-ignore
          const { svg } = await window.mermaid.render(id + '-svg', source);
          return svg;
        } catch (err: any) {
          // Return error placeholder
          return `
            <div class="mermaid-error" style="border: 1px solid red; padding: 10px; color: red; font-family: sans-serif;">
              <strong>Mermaid Error</strong>
              <pre style="white-space: pre-wrap; overflow-x: auto;">${err.message || String(err)}</pre>
              <details>
                <summary>Source</summary>
                <pre style="white-space: pre-wrap; color: black;">${source}</pre>
              </details>
            </div>
          `;
        }
      }, { id: block.id, source: block.source });

      // Clean up the generated SVG (remove explicit id to prevent conflicts if deduplicated, set responsive width/height)
      // Actually we will process the SVG html in Node to make it responsive
      let processedSvg = svgHtml;
      
      // We can apply max-width: 100%; height: auto;
      if (processedSvg.startsWith('<svg')) {
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

import { Browser } from 'playwright';

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
  timeoutMs: number = 10000,
  maxWidth: string = '100%',
  maxHeight: string = 'none'
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
  } catch {
    throw new Error('Could not find mermaid library. Ensure it is installed.');
  }

  // Inject mermaid into the page
  await page.addScriptTag({ path: mermaidScriptPath });

  const payloads = blocks.map(b => ({
    id: b.id,
    source: b.source,
    theme: getMermaidTheme(md2pdfTheme, b.theme, globalMermaidTheme),
    line: b.line
  }));

  let evaluatedResults: Array<{ id: string, svg: string | null, error: string | null }> = [];
  try {
    evaluatedResults = await page.evaluate(async ({ blocks, timeout }) => {
      const results = [];
      for (const block of blocks) {
        try {
          // @ts-expect-error window.mermaid is injected at runtime
          window.mermaid.initialize({ startOnLoad: false, theme: block.theme, flowchart: { htmlLabels: false } });
          
          const renderPromise = (async () => {
            // @ts-expect-error window.mermaid is injected at runtime
            const { svg } = await window.mermaid.render(block.id + '-svg', block.source);
            return { id: block.id, svg, error: null };
          })();

          const timeoutPromise = new Promise<any>((_, reject) => {
            setTimeout(() => reject(new Error(`Mermaid render timed out after ${timeout}ms`)), timeout);
          });

          const res = await Promise.race([renderPromise, timeoutPromise]);
          results.push(res);
        } catch (err: any) {
          results.push({ id: block.id, svg: null, error: err.message || String(err) });
        }
      }
      return results;
    }, { blocks: payloads, timeout: timeoutMs });
  } catch (e: any) {
    // If the entire evaluate fails
    console.warn(`\x1b[33m⚠ Mermaid Batch Render Error: ${e.message}\x1b[0m`);
    evaluatedResults = payloads.map(b => ({
      id: b.id,
      svg: null,
      error: 'Batch execution failed: ' + e.message
    }));
  }

  await page.close();
  await context.close();

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
      // Extract the exact width from the SVG's viewBox (0 0 width height)
      const viewBoxMatch = processedSvg.match(/viewBox="[^"]*?([0-9.]+)\s+([0-9.]+)"/);
      if (viewBoxMatch) {
        const width = viewBoxMatch[1];
        // Strip any hardcoded width or style attributes outputted by Mermaid
        processedSvg = processedSvg.replace(/\s+width="[^"]+"/, '');
        processedSvg = processedSvg.replace(/\s+style="[^"]+"/, '');
        
        const finalMaxWidth = maxWidth || '100%';
        const finalMaxHeight = maxHeight || 'none';

        // Apply responsive width based precisely on the diagram's intrinsic dimension
        processedSvg = processedSvg.replace('<svg ', `<svg style="width: ${width}px; max-width: ${finalMaxWidth}; max-height: ${finalMaxHeight}; height: auto; font-family: Inter, sans-serif;" `);
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
}

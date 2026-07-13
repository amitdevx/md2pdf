import { RenderedMermaid } from './renderer.js';

export function inlineMermaidSvgs(html: string, rendered: RenderedMermaid[]): string {
  let processedHtml = html;
  
  for (const item of rendered) {
    // The placeholder div looks like:
    // <div id="mermaid-placeholder-X" class="mermaid-container" style="page-break-inside: avoid;"></div>
    // We'll replace the entire div, or just inject into it.
    // It's easier to use a regex to replace the exact div if it has no children, but rehypeStringify might format it slightly.
    // Since we know the id exactly, we can match:
    function escapeRegExp(str: string): string {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const regex = new RegExp(`<div[^>]*\\bid="${escapeRegExp(item.id)}"[^>]*></div>`, 'g');
    
    // Replace with a div that contains the SVG
    processedHtml = processedHtml.replace(
      regex,
      `<div class="mermaid-container" style="page-break-inside: avoid; display: flex; justify-content: center; margin: 20px 0;">${item.svgHtml}</div>`
    );

  }
  
  return processedHtml;
}

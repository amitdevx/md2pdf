import { RenderedMermaid } from './renderer.js';

export function inlineMermaidSvgs(html: string, rendered: RenderedMermaid[]): string {
  let processedHtml = html;
  
  for (const item of rendered) {
    if (!item.id || typeof item.id !== 'string') continue;
    const targetIdAttr = `id="${item.id}"`;
    let searchStart = 0;
    while (true) {
      const idIndex = processedHtml.indexOf(targetIdAttr, searchStart);
      if (idIndex === -1) break;
      
      const divOpenIndex = processedHtml.lastIndexOf('<div', idIndex);
      const tagCloseIndex = processedHtml.indexOf('>', idIndex);
      if (divOpenIndex !== -1 && tagCloseIndex !== -1 && tagCloseIndex > idIndex) {
        let replaceEnd = tagCloseIndex + 1;
        const remainder = processedHtml.slice(replaceEnd, replaceEnd + 6);
        if (remainder === '</div>') {
          replaceEnd += 6;
        }
        
        const replacement = `<div class="mermaid-container" style="page-break-inside: avoid; display: flex; justify-content: center; margin: 20px 0;">${item.svgHtml}</div>`;
        processedHtml = processedHtml.slice(0, divOpenIndex) + replacement + processedHtml.slice(replaceEnd);
        searchStart = divOpenIndex + replacement.length;
      } else {
        searchStart = idIndex + targetIdAttr.length;
      }
    }
  }
  
  return processedHtml;
}

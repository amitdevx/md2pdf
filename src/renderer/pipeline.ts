import { Browser } from 'playwright';
import { MermaidBlock, renderMermaidBlocks, inlineMermaidSvgs } from '../plugins/mermaid/index.js';

import { MermaidTheme } from '../plugins/mermaid/theme-map.js';

export async function processBeforeRender(
  html: string,
  browser: Browser,
  mermaidBlocks: MermaidBlock[],
  options?: {
    theme?: string;
    globalMermaidTheme?: MermaidTheme;
    timeout?: number;
  }
): Promise<string> {
  if (mermaidBlocks && mermaidBlocks.length > 0) {
    const renderedSvgs = await renderMermaidBlocks(
      browser, 
      mermaidBlocks, 
      options?.theme, 
      options?.globalMermaidTheme,
      options?.timeout
    );
    return inlineMermaidSvgs(html, renderedSvgs);
  }
  return html;
}

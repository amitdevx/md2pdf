import { Browser } from 'playwright-core';
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
    mermaidEnabled?: boolean;
    maxWidth?: string;
    maxHeight?: string;
  }
): Promise<string> {
  if (options?.mermaidEnabled === false) {
    return html;
  }

  if (mermaidBlocks && mermaidBlocks.length > 0) {
    const renderedSvgs = await renderMermaidBlocks(
      browser, 
      mermaidBlocks, 
      options?.theme, 
      options?.globalMermaidTheme,
      options?.timeout,
      options?.maxWidth,
      options?.maxHeight
    );
    return inlineMermaidSvgs(html, renderedSvgs);
  }
  return html;
}

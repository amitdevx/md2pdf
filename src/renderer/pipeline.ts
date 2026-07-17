import { Browser } from 'playwright-core';
import { MermaidBlock, renderMermaidBlocks, inlineMermaidSvgs } from '../plugins/mermaid/index.js';

import { MermaidTheme } from '../plugins/mermaid/theme-map.js';

export async function processBeforeRender(
  html: string,
  browser: Browser,
  mermaidBlocks: MermaidBlock[],
  warnings: string[],
  options?: {
    theme?: string;
    globalMermaidTheme?: MermaidTheme;
    timeout?: number;
    mermaidEnabled?: boolean;
    maxWidth?: string;
    maxHeight?: string;
    sharedMermaidPage?: any;
  }
): Promise<string> {
  if (options?.mermaidEnabled === false) {
    return html;
  }

  if (mermaidBlocks && mermaidBlocks.length > 0) {
    const renderedSvgs = await renderMermaidBlocks(
      browser, 
      mermaidBlocks, 
      warnings,
      options?.theme, 
      options?.globalMermaidTheme,
      options?.timeout,
      options?.maxWidth,
      options?.maxHeight,
      options?.sharedMermaidPage
    );
    return inlineMermaidSvgs(html, renderedSvgs);
  }
  return html;
}

import { Browser } from 'playwright';
import { MermaidBlock, renderMermaidBlocks, inlineMermaidSvgs } from '../plugins/mermaid/index.js';

export async function processBeforeRender(
  html: string,
  browser: Browser,
  mermaidBlocks: MermaidBlock[]
): Promise<string> {
  if (mermaidBlocks && mermaidBlocks.length > 0) {
    const renderedSvgs = await renderMermaidBlocks(browser, mermaidBlocks, 'default');
    return inlineMermaidSvgs(html, renderedSvgs);
  }
  return html;
}

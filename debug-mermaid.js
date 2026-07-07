import { readFileSync, writeFileSync } from 'fs';
import { parseMarkdown } from './dist/parser/index.js';
import { detectMermaidBlocks } from './dist/plugins/mermaid/detector.js';
import { processBeforeRender } from './dist/renderer/pipeline.js';
import { chromium } from 'playwright';

async function run() {
  const md = readFileSync('/home/amitdevx/test-mermaid.md', 'utf-8');
  const { html, frontmatter } = await parseMarkdown(md, {});
  const mermaidBlocks = detectMermaidBlocks(md);
  
  const browser = await chromium.launch();
  const processedHtml = await processBeforeRender(html, browser, mermaidBlocks, {
    maxWidth: '80%',
    maxHeight: '300px'
  });
  await browser.close();
  
  writeFileSync('/home/amitdevx/test-mermaid-debug.html', processedHtml);
  console.log("Wrote /home/amitdevx/test-mermaid-debug.html");
}

run();

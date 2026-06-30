import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!DOCTYPE html><html><body></body></html>');
await page.addScriptTag({ path: 'node_modules/mermaid/dist/mermaid.min.js' });

const svg = await page.evaluate(async () => {
  window.mermaid.initialize({ startOnLoad: false });
  const { svg } = await window.mermaid.render('test-svg', 'graph TD\nA-->B');
  return svg;
});

console.log(svg.substring(0, 500));
await browser.close();

const { processBeforeRender } = require('./dist/renderer/pipeline.js');
const { parseMarkdown } = require('./dist/parser/index.js');
const fs = require('fs');

async function test() {
  const html = await parseMarkdown('```mermaid\ngraph TD\nA ---> B  %% Syntax error\n```', {});
  const res = await processBeforeRender(html, process.cwd(), { timeout: 10000 });
  console.log(res);
}
test().catch(console.error);

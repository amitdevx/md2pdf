import fs from 'fs';
import { parseMarkdown } from './dist/parser/index.js';

async function test() {
  const md = fs.readFileSync('tests/fixtures/page-breaks.md', 'utf-8');
  const res = await parseMarkdown(md, { pageBreaks: { h1NewPage: true, hrAsPageBreak: true } });
  console.log(res.html);
}
test();

import { parseMarkdown } from '../parser/index.js';
import { renderHtmlTemplate } from '../renderer/index.js';
import { generatePdf } from '../pdf/index.js';
import { ConvertOptions } from '../types/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function convert(options: ConvertOptions): Promise<void> {
  const { input, output } = options;
  
  // 1. Read Markdown
  const inputPath = path.resolve(process.cwd(), input);
  const markdown = await fs.readFile(inputPath, 'utf-8');

  // 2. Parse to HTML (We also need to fix relative image paths to absolute)
  // For v0.0.1, we will replace relative image paths in markdown to absolute for Playwright
  const dir = path.dirname(inputPath);
  const processedMarkdown = markdown.replace(/!\[([^\]]*)\]\((?!http|data:)([^)]+)\)/g, (match, alt, src) => {
    const absPath = path.resolve(dir, src);
    return `![${alt}](file://${absPath})`;
  });

  const contentHtml = await parseMarkdown(processedMarkdown);

  // 3. Render HTML with Theme
  const title = path.basename(input, path.extname(input));
  const html = renderHtmlTemplate(contentHtml, title);

  // 4. Generate PDF
  const outputPath = path.resolve(process.cwd(), output);
  await generatePdf({ html, outputPath });
}

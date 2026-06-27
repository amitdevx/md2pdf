import { parseMarkdown } from '../parser/index.js';
import { renderHtmlTemplate } from '../renderer/index.js';
import { generatePdf } from '../pdf/index.js';
import { ConvertOptions, ConvertResult } from '../types/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function convert(options: ConvertOptions): Promise<ConvertResult> {
  const startTime = Date.now();
  const { input, output, paper, margin } = options;

  const inputPath = path.resolve(process.cwd(), input);
  const markdown = await fs.readFile(inputPath, 'utf-8');

  const dir = path.dirname(inputPath);
  const processedMarkdown = markdown.replace(/!\[([^\]]*)\]\((?!http|data:)([^)]+)\)/g, (match, alt, src) => {
    const absPath = path.resolve(dir, decodeURIComponent(src));
    const fileUrl = 'file://' + encodeURI(absPath.replace(/\\/g, '/'));
    return `![${alt}](${fileUrl})`;
  });

  const parsed = await parseMarkdown(processedMarkdown);

  const title = path.basename(input, path.extname(input));
  const html = renderHtmlTemplate(parsed.html, title);

  const outputPath = path.resolve(process.cwd(), output);
  await generatePdf({ html, outputPath, format: paper, margin });

  return {
    outputPath,
    pageCounts: 0, // Placeholder until PDF parsing is implemented
    renderTimeMs: Date.now() - startTime,
    warnings: parsed.warnings,
  };
}

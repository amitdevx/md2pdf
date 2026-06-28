import { parseMarkdown } from '../parser/index.js';
import { renderHtmlTemplate } from '../renderer/index.js';
import { generatePdf } from '../pdf/index.js';
import { ConvertOptions, ConvertResult, PdfMetadata } from '../types/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';

import matter from 'gray-matter';
import { injectMetadata } from '../pdf/metadata.js';

export async function convert(options: ConvertOptions): Promise<ConvertResult> {
  const startTime = Date.now();
  const { input, output, paper, margin } = options;

  const inputPath = path.resolve(process.cwd(), input);
  const rawMarkdown = await fs.readFile(inputPath, 'utf-8');

  // Parse frontmatter
  const { data: frontmatter, content: markdown } = matter(rawMarkdown);
  if (frontmatter.publish === false) {
    throw new Error('File has publish: false in frontmatter');
  }

  const dir = path.dirname(inputPath);
  const processedMarkdown = markdown.replace(/!\[([^\]]*)\]\((?!http|data:)([^)]+)\)/g, (match, alt, src) => {
    const absPath = path.resolve(dir, decodeURIComponent(src));
    const fileUrl = 'file://' + encodeURI(absPath.replace(/\\/g, '/'));
    return `![${alt}](${fileUrl})`;
  });

  const parsed = await parseMarkdown(processedMarkdown, {
    toc: options.toc,
    tocDepth: options.tocDepth,
    tocTitle: options.tocTitle,
  });

  const title = options.metadata?.title || frontmatter.title || path.basename(input, path.extname(input));
  const html = renderHtmlTemplate(parsed.html, title);

  const outputPath = path.resolve(process.cwd(), output);
  await generatePdf({ html, outputPath, format: paper, margin });

  // Patch PDF Metadata
  const metadata: PdfMetadata = {
    title,
    author: options.metadata?.author || frontmatter.author,
    subject: options.metadata?.subject || frontmatter.subject,
    keywords: options.metadata?.keywords || frontmatter.keywords,
    ...options.metadata
  };

  await injectMetadata(outputPath, metadata);

  return {
    outputPath,
    pageCounts: 0, // Placeholder until PDF parsing is implemented
    renderTimeMs: Date.now() - startTime,
    warnings: parsed.warnings,
    metadata
  };
}

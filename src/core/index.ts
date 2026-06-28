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
    pageBreaks: options.pageBreaks,
  });

  const title = options.metadata?.title || frontmatter.title || path.basename(input, path.extname(input));
  const html = renderHtmlTemplate(parsed.html, title);

  const outputPath = path.resolve(process.cwd(), output);

  const metadata: PdfMetadata = {
    ...options.metadata,
    title,
    author: options.metadata?.author ?? frontmatter.author,
    subject: options.metadata?.subject ?? frontmatter.subject,
    keywords: options.metadata?.keywords ?? frontmatter.keywords,
  };

  let headerTemplate = undefined;
  let marginTop = margin;
  if (options.header) {
    marginTop = '30mm';
    if (typeof options.header === 'object' && options.header.template) {
      headerTemplate = options.header.template;
    } else {
      headerTemplate = `
      <div style="font-family: Inter, sans-serif; font-size: 9px; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; border-bottom: 0.5px solid #ccc; margin-bottom: 5mm; padding-bottom: 2mm;">
        <span class="title"></span>
        <span>${metadata.author ? metadata.author + ' — ' : ''}<span class="date"></span></span>
      </div>`;
    }
  }

  let footerTemplate = undefined;
  let marginBottom = margin;
  if (options.footer) {
    marginBottom = '30mm';
    if (typeof options.footer === 'object' && options.footer.template) {
      footerTemplate = options.footer.template;
    } else {
      footerTemplate = `
      <div style="font-family: Inter, sans-serif; font-size: 9px; width: 100%; padding: 0 15mm; display: flex; justify-content: center; border-top: 0.5px solid #ccc; margin-top: 5mm; padding-top: 2mm;">
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`;
    }
  }

  await generatePdf({ 
    html, 
    outputPath, 
    format: paper, 
    margin,
    marginTop,
    marginBottom,
    displayHeaderFooter: !!options.header || !!options.footer,
    headerTemplate,
    footerTemplate,
  });

  const pageCounts = await injectMetadata(outputPath, metadata);

  return {
    outputPath,
    pageCounts,
    renderTimeMs: Date.now() - startTime,
    warnings: parsed.warnings,
    metadata
  };
}

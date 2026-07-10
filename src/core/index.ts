import { parseMarkdown } from '../parser/index.js';
import { renderHtmlTemplate } from '../renderer/index.js';
import { generatePdf } from '../pdf/index.js';
import { ConvertOptions, ConvertResult, PdfMetadata } from '../types/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveObsidianEmbeds } from '../plugins/obsidian/embeds.js';

import matter from 'gray-matter';
import { injectMetadata } from '../pdf/metadata.js';

export async function convert(options: ConvertOptions): Promise<ConvertResult> {
  const startTime = Date.now();
  const { input, output, paper, margin } = options;

  const inputPath = path.resolve(process.cwd(), input);
  let rawMarkdown;
  try {
    rawMarkdown = await fs.readFile(inputPath, 'utf-8');
  } catch (error: any) {
    const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
    if (error.code === 'EACCES' || error.message.includes('Permission denied')) {
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_PERMISSION_DENIED,
        'Permission Denied',
        `Cannot read file '${inputPath}': Permission denied.`,
        { markdownFile: inputPath },
        error
      );
    }
    throw error;
  }

  let frontmatter: any;
  let markdown: string;
  try {
    const parsed = matter(rawMarkdown);
    frontmatter = parsed.data;
    markdown = parsed.content;
  } catch (error: any) {
    const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
    throw new Md2PdfError(
      Md2PdfErrorCode.ERR_CONFIG_ERROR,
      'Invalid Frontmatter',
      'Invalid frontmatter YAML: ' + (error.message || String(error)),
      { markdownFile: inputPath }
    );
  }

  if (frontmatter.publish === false) {
    const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
    throw new Md2PdfError(
      Md2PdfErrorCode.ERR_CONFIG_ERROR,
      'Skipped Conversion',
      'The file has `publish: false` in its frontmatter.',
      { markdownFile: inputPath }
    );
  }

  const dir = path.dirname(inputPath);
  let processedMarkdown = markdown.replace(/!\[([^\]]*)\]\((?!http|data:|file:)([^)]+)\)(?:\{width=([^}]+)\}|\s*=([\dx]+))?/g, (match, alt, fullSrc, attrWidth, kramWidth) => {
    const parts = fullSrc.trim().split(/\s+/);
    const src = parts[0];
    const title = parts.slice(1).join(' ');
    
    // We can just keep file:// for now, but if embedNotes/attachments are enabled, we should probably base64 it.
    // Wait, let's keep it as file:// for standard markdown images to not break existing behavior unless it fails.
    // Actually, we should just let resolveObsidianEmbeds handle `![[...]]`. Standard images stay file:// for Playwright.
    const absPath = path.resolve(dir, decodeURIComponent(src));
    const fileUrl = 'file://' + encodeURI(absPath.replace(/\\/g, '/'));
    
    let sizing = '';
    const widthRaw = attrWidth || kramWidth;
    if (widthRaw) {
      if (widthRaw.includes('x')) {
        const [w, h] = widthRaw.split('x');
        sizing = ` width="${w}"${h ? ` height="${h}"` : ''}`;
      } else {
        sizing = ` width="${widthRaw.replace(/[^0-9%]/g, '')}"`;
      }
      return `<img src="${fileUrl}" alt="${alt}"${title ? ` title="${title.replace(/['"]/g, '')}"` : ''}${sizing} />`;
    }
    
    return `![${alt}](${fileUrl}${title ? ' ' + title : ''})`;
  });

  // Resolve Obsidian Embeds
  processedMarkdown = await resolveObsidianEmbeds(
    processedMarkdown,
    options.obsidian?.vaultRoot || dir,
    options.obsidian?.attachmentFolder,
    inputPath,
    options.obsidian?.maxEmbedDepth,
    options.obsidian?.maxAttachmentSizeMb
  );

  // Frontmatter title & date injection
  let prependMarkdown = '';
  if (frontmatter.title && !processedMarkdown.match(/^#\s+/m)) {
    prependMarkdown += `# ${frontmatter.title}\n\n`;
  }
  
  if (frontmatter.date && options.obsidian?.showDate !== false) {
    // If showDate is explicitly false, we don't render it. Otherwise we do.
    prependMarkdown += `<div class="frontmatter-date">${frontmatter.date}</div>\n\n`;
  }

  processedMarkdown = prependMarkdown + processedMarkdown;

  const mermaidBlocks: any[] = []; // Using any to avoid importing MermaidBlock type here for now, or we can just let it be any array

  const parsed = await parseMarkdown(processedMarkdown, {
    toc: options.toc,
    tocDepth: options.tocDepth,
    tocTitle: options.tocTitle,
    pageBreaks: options.pageBreaks,
    mermaidBlocks,
    math: options.math,
    obsidian: options.obsidian,
  });

  const title = options.metadata?.title || frontmatter.title || path.basename(input, path.extname(input));
  const html = renderHtmlTemplate(parsed.html, title, { cssclass: frontmatter.cssclass });

  const outputPath = path.resolve(process.cwd(), output);

  const metadata: PdfMetadata = {
    ...options.metadata,
    title,
    author: options.metadata?.author ?? frontmatter.author,
    subject: options.metadata?.subject ?? frontmatter.subject,
    keywords: options.metadata?.keywords ?? (Array.isArray(frontmatter.keywords) ? frontmatter.keywords.join(', ') : frontmatter.keywords),
    creationDate: options.metadata?.creationDate ?? (frontmatter.date ? new Date(frontmatter.date) : undefined),
  };

  let headerTemplate = undefined;
  let marginTop = margin;
  const headerEnabled = options.header === true || 
    (typeof options.header === 'object' && options.header.enabled !== false);
  
  if (headerEnabled && options.header !== undefined) {
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
  const footerEnabled = options.footer === true || 
    (typeof options.footer === 'object' && options.footer.enabled !== false);

  if (footerEnabled && options.footer !== undefined) {
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

  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--js-flags="--max-old-space-size=256"'],
    });

    const { processBeforeRender } = await import('../renderer/pipeline.js');
    const processedHtml = await processBeforeRender(html, browser, mermaidBlocks, {
      theme: options.theme || frontmatter.theme,
      globalMermaidTheme: options.mermaid?.theme || frontmatter.mermaid?.theme,
      timeout: options.mermaid?.timeout || frontmatter.mermaid?.timeout,
      mermaidEnabled: options.mermaid?.enabled,
      maxWidth: options.mermaid?.maxWidth || frontmatter.mermaid?.maxWidth,
      maxHeight: options.mermaid?.maxHeight || frontmatter.mermaid?.maxHeight
    });
    

    await generatePdf({  
      html: processedHtml, 
      outputPath, 
      format: paper, 
      margin,
      marginTop,
      marginBottom,
      displayHeaderFooter: (headerEnabled && options.header !== undefined) || (footerEnabled && options.footer !== undefined),
      headerTemplate,
      footerTemplate,
      browser,
    });
  } catch (error) {
    const { detectBrowserError } = await import('../errors/detect.js');
    throw detectBrowserError(error, { markdownFile: inputPath, outputPath });
  } finally {
    if (browser) await browser.close();
  }

  const pageCounts = await injectMetadata(outputPath, metadata);

  return {
    outputPath,
    pageCounts,
    renderTimeMs: Date.now() - startTime,
    warnings: parsed.warnings,
    metadata
  };
}

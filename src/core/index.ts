import { parseMarkdown } from '../parser/index.js';
import { renderHtmlTemplate } from '../renderer/index.js';
import { generatePdf } from '../pdf/index.js';
import { ConvertOptions, ConvertResult, PdfMetadata } from '../types/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveObsidianEmbeds } from '../plugins/obsidian/embeds.js';

import matter from 'gray-matter';
import { injectMetadata } from '../pdf/metadata.js';

function sanitizeFrontmatterValue(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = Array.isArray(val) ? val.join(', ') : String(val);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function convert(options: ConvertOptions): Promise<ConvertResult> {
  const startTime = Date.now();
  const { input, output, paper, margin } = options;

  if (typeof input !== 'string') {
    const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
    throw new Md2PdfError(
      Md2PdfErrorCode.ERR_INVALID_INPUT,
      'Invalid Input',
      'The input property must be a string path to a markdown file.'
    );
  }

  if (typeof output === 'string') {
    const resolvedOutput = path.resolve(process.cwd(), output);
    const sensitiveDirs = ['/etc', '/root', '/var', '/usr', '/bin'];
    const isSensitive = sensitiveDirs.some(dir => resolvedOutput.startsWith(dir)) || new RegExp('^([a-zA-Z]:)?[/\\\\\\\\]Windows', 'i').test(resolvedOutput);
    if (isSensitive) {
      const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_PATH_TRAVERSAL,
        'Access Denied',
        'Cannot write output to protected system directory.'
      );
    }
  }

  const inputPath = path.resolve(process.cwd(), input);
  let rawMarkdown;
  try {
    const stats = await fs.stat(inputPath);
    // 5MB limit to prevent V8 OOM during unified/AST parsing
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (stats.size > MAX_SIZE_BYTES) {
      const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_FILE_TOO_LARGE,
        'File Too Large',
        `Input markdown exceeds maximum size of 5MB (${(stats.size / 1024 / 1024).toFixed(2)}MB).`,
        { markdownFile: inputPath }
      );
    }
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
      Md2PdfErrorCode.ERR_PUBLISH_SKIPPED,
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
    const fileUrl = pathToFileURL(absPath).href;
    
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

  const warnings: string[] = [];
  
  // Resolve Obsidian Embeds
  processedMarkdown = await resolveObsidianEmbeds(
    processedMarkdown,
    options.obsidian?.vaultRoot || dir,
    options.obsidian?.attachmentFolder,
    inputPath,
    options.obsidian?.maxEmbedDepth,
    options.obsidian?.maxAttachmentSizeMb,
    warnings
  );

  // Frontmatter title & date injection
  let prependMarkdown = '';
  if (frontmatter.title && !processedMarkdown.match(/^#\s+/m)) {
    prependMarkdown += `# ${frontmatter.title}\n\n`;
  }
  if (frontmatter.date) {
    const dateStr = new Date(frontmatter.date).toLocaleDateString();
    prependMarkdown += `*${dateStr}*\n\n`;
  }
  processedMarkdown = prependMarkdown + processedMarkdown;

  const mermaidBlocks: any[] = []; // Using any to avoid importing MermaidBlock type here for now, or we can just let it be any array

  const outputPath = path.resolve(process.cwd(), output);

  let parsed: any;
  let html: string;
  let browser;
  let internallyLaunchedBrowser = false;
  let title: string = '';
  
  try {
    parsed = await parseMarkdown(processedMarkdown, {
      toc: options.toc,
      tocDepth: options.tocDepth,
      tocTitle: options.tocTitle,
      pageBreaks: options.pageBreaks,
      mermaidBlocks,
      math: options.math,
      obsidian: options.obsidian,
    });

    title = options.metadata?.title || frontmatter.title || path.basename(input, path.extname(input));
    html = await renderHtmlTemplate(parsed.html, title, { 
      cssclass: frontmatter.cssclass,
      mathEnabled: options.math?.enabled,
      obsidianEnabled: !!options.obsidian,
    });

    if (options.sharedBrowser) {
      browser = options.sharedBrowser;
    } else {
      const { getWarmBrowser, scheduleClose } = await import('../pdf/daemon.js');
      browser = await getWarmBrowser();
      // Don't set internallyLaunchedBrowser — daemon manages lifecycle
      // Schedule close after idle period
      scheduleClose();
    }

    const { processBeforeRender } = await import('../renderer/pipeline.js');
    const processedHtml = await processBeforeRender(html, browser, mermaidBlocks, warnings, {
      theme: frontmatter.theme || options.theme,
      globalMermaidTheme: frontmatter.mermaid?.theme || options.mermaid?.theme,
      timeout: frontmatter.mermaid?.timeout || options.mermaid?.timeout,
      mermaidEnabled: frontmatter.mermaid?.enabled ?? options.mermaid?.enabled,
      maxWidth: frontmatter.mermaid?.maxWidth || options.mermaid?.maxWidth,
      maxHeight: frontmatter.mermaid?.maxHeight || options.mermaid?.maxHeight,
      sharedMermaidPage: (options as any).sharedMermaidPage
    });
    
    let headerTemplate = undefined;
    let marginTop = margin;
    const headerEnabled = options.header === true || 
      (typeof options.header === 'object' && options.header.enabled !== false);
    
    const configKeywords = options.metadata?.keywords;
    const fmTags = Array.isArray(frontmatter.tags)
      ? frontmatter.tags.join(', ')
      : (frontmatter.tags || '');
    const fmKeywords = Array.isArray(frontmatter.keywords)
      ? frontmatter.keywords.join(', ')
      : (frontmatter.keywords || '');
    const allKeywords = [configKeywords, fmTags, fmKeywords].filter(Boolean).join(', ');

    const metadata: PdfMetadata = {
      ...options.metadata,
      title,
      author: options.metadata?.author ?? frontmatter.author,
      subject: options.metadata?.subject ?? frontmatter.description ?? frontmatter.subject,
      keywords: allKeywords || undefined,
      creationDate: options.metadata?.creationDate ?? (frontmatter.date ? new Date(frontmatter.date) : undefined),
    };

    if (headerEnabled && options.header !== undefined) {
      marginTop = '30mm';
      if (typeof options.header === 'object' && options.header.template) {
        headerTemplate = options.header.template;
        // Replace {frontmatter.X} with actual values
        headerTemplate = headerTemplate.replace(/\{frontmatter\.([^}]+)\}/g, (match, key) => sanitizeFrontmatterValue(frontmatter[key]));
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
        // Replace {frontmatter.X} with actual values
        footerTemplate = footerTemplate.replace(/\{frontmatter\.([^}]+)\}/g, (match, key) => sanitizeFrontmatterValue(frontmatter[key]));
      } else {
        footerTemplate = `
        <div style="font-family: Inter, sans-serif; font-size: 9px; width: 100%; padding: 0 15mm; display: flex; justify-content: center; border-top: 0.5px solid #ccc; margin-top: 5mm; padding-top: 2mm;">
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`;
      }
    }

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
    
    const pageCounts = await injectMetadata(outputPath, metadata);

    return {
      outputPath,
      pageCounts,
      renderTimeMs: Date.now() - startTime,
      warnings: [...warnings, ...(parsed.warnings || [])],
      metadata
    };
  } catch (error) {
    const { detectBrowserError } = await import('../errors/detect.js');
    throw detectBrowserError(error, { markdownFile: inputPath, outputPath });
  } finally {
    if (browser && internallyLaunchedBrowser) {
      await browser.close();
    }
  }
}



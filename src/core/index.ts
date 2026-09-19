import { isSafeOutputPath } from "../validation/path.js";
import { parseMarkdown } from '../parser/index.js';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import { renderHtmlTemplate } from '../renderer/index.js';
import { generatePdf } from '../pdf/index.js';
import { ConvertOptions, ConvertResult, PdfMetadata } from '../types/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveObsidianEmbeds } from '../plugins/obsidian/embeds.js';

import matter from 'gray-matter';
import { injectMetadata } from '../pdf/metadata.js';
import { PluginRegistry } from '../plugins/registry.js';
import type { RenderContext } from '../types/context.js';

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
  if (!process.env.MD2PDF_DAEMON && !options.sharedBrowser) {
    const { isDaemonAlive, submitToDaemon } = await import('../daemon/client.js');
    if (await isDaemonAlive()) {
      return submitToDaemon(options);
    }
  }

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

  const registry = new PluginRegistry();
  if (options.plugins) {
    for (const plugin of options.plugins) {
      registry.register(plugin);
    }
  }
  await registry.setupAll();

  if (typeof output === 'string') {
    const resolvedOutput = path.isAbsolute(output) ? output : path.resolve(process.cwd(), output);
    if (!isSafeOutputPath(resolvedOutput)) {
      const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_PATH_TRAVERSAL,
        'Access Denied',
        'Cannot write output to a protected system directory.'
      );
    }
  }

  const inputPath = input === '-' ? '-' : (path.isAbsolute(input) ? input : path.resolve(process.cwd(), input));
  let rawMarkdown = '';
  if (input === '-') {
    rawMarkdown = await new Promise<string>((resolve, reject) => {
      let data = '';
      let byteCount = 0;
      const MAX_STDIN_BYTES = 30 * 1024 * 1024;
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', chunk => {
        byteCount += Buffer.byteLength(chunk, 'utf-8');
        if (byteCount > MAX_STDIN_BYTES) {
          process.stdin.destroy();
          reject(new Error('ERR_FILE_TOO_LARGE:Stdin input exceeds maximum size of 30MB.'));
          return;
        }
        data += chunk;
      });
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    }).catch(async (err: any) => {
      if (typeof err?.message === 'string' && err.message.startsWith('ERR_FILE_TOO_LARGE:')) {
        const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
        throw new Md2PdfError(
          Md2PdfErrorCode.ERR_FILE_TOO_LARGE,
          'File Too Large',
          err.message.replace('ERR_FILE_TOO_LARGE:', ''),
          {}
        );
      }
      throw err;
    });
  } else {
    try {
      const stats = await fs.stat(inputPath);
      // 30MB limit
      const MAX_SIZE_BYTES = 30 * 1024 * 1024;
      if (stats.size > MAX_SIZE_BYTES) {
        const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
        throw new Md2PdfError(
          Md2PdfErrorCode.ERR_FILE_TOO_LARGE,
          'File Too Large',
          `Input markdown exceeds maximum size of 30MB (${(stats.size / 1024 / 1024).toFixed(2)}MB).`,
          { markdownFile: inputPath }
        );
      }
      if (stats.mode !== undefined && (stats.mode & 0o777) === 0) {
        const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
        throw new Md2PdfError(
          Md2PdfErrorCode.ERR_PERMISSION_DENIED,
          'Permission Denied',
          `Cannot read file '${inputPath}': Permission denied (mode 000).`,
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
  }

  if (input === '-') {
    let complexityDepth = 0;
    let pos = 0;
    while (pos < rawMarkdown.length) {
      let nextNewline = rawMarkdown.indexOf('\n', pos);
      if (nextNewline === -1) nextNewline = rawMarkdown.length;
      let depth = 0;
      let i = pos;
      while (i < nextNewline) {
        const char = rawMarkdown[i];
        if (char === '>') depth++;
        else if (char !== ' ' && char !== '\t') break;
        i++;
      }
      if (depth > complexityDepth) complexityDepth = depth;
      pos = nextNewline + 1;
    }
    if (complexityDepth > 200) {
      const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
      throw new Md2PdfError(Md2PdfErrorCode.ERR_DOCUMENT_TOO_COMPLEX, 'Document Too Complex', `The document contains blockquote nesting ${complexityDepth} levels deep. Maximum supported depth is 200.`, { markdownFile: 'stdin' });
    }
  }

  let frontmatter: any;
  let markdown: string;
  try {
    if (options.__preparsed) {
      frontmatter = options.__preparsed.data;
      markdown = options.__preparsed.content;
    } else {
      // Block every executable engine alias that gray-matter supports.
      // gray-matter resolves engine names case-insensitively and supports
      // several aliases for JavaScript (js, javascript) and CoffeeScript.
      // Overriding only 'js' still leaves 'javascript', 'coffee', etc. reachable.
      const blockExecutableEngine = () => {
        throw new Error('JavaScript/CoffeeScript frontmatter engines are disabled. Use YAML frontmatter instead.');
      };
      const parsed = matter(rawMarkdown, {
        engines: {
          js:           blockExecutableEngine,
          javascript:   blockExecutableEngine,
          coffee:       blockExecutableEngine,
          coffeescript: blockExecutableEngine,
          cson:         blockExecutableEngine,
        },
      });
      frontmatter = parsed.data;
      markdown = parsed.content;
    }
  } catch (error: any) {
    const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
    throw new Md2PdfError(
      Md2PdfErrorCode.ERR_CONFIG_ERROR,
      'Invalid Frontmatter',
      'Invalid frontmatter YAML: ' + (error.message || String(error)),
      { markdownFile: inputPath }
    );
  }

  const outputPath = path.isAbsolute(output) ? output : path.resolve(process.cwd(), output);
  let cacheHash = '';
  if (options.cache !== false) {
    const { computeHash, checkCache } = await import('./cache.js');
    // Ensure we hash both content and relevant options
    const hashOptions = { ...options };
    delete hashOptions.sharedBrowser;
    delete hashOptions.sharedMermaidPage;
    cacheHash = computeHash(rawMarkdown, hashOptions);
    if (checkCache(inputPath, cacheHash, outputPath)) {
      return {
        outputPath,
        pageCounts: 0, // Skip page counting for cached hits
        renderTimeMs: Date.now() - startTime,
        warnings: [],
        fromCache: true
      };
    }
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
    let src = fullSrc.trim();
    let title = '';
    const titleMatch = src.match(/\s+((['"])(.*)\2|\((.*)\))$/);
    if (titleMatch) {
      title = titleMatch[1];
      src = src.slice(0, -titleMatch[0].length).trim();
    }
    
    // Preserve local file:// URIs; Playwright securely loads them in the headless context.
    const absPath = path.resolve(dir, decodeURIComponent(src));
    const fileUrl = pathToFileURL(absPath).href;
    
    let sizing = '';
    const widthRaw = attrWidth || kramWidth;
    if (widthRaw) {
      const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (widthRaw.includes('x')) {
        const [w, h] = widthRaw.split('x');
        const cleanW = escapeAttr(w.trim());
        const cleanH = escapeAttr(h.trim());
        sizing = ` width="${cleanW}"${cleanH ? ` height="${cleanH}"` : ''}`;
      } else {
        sizing = ` width="${widthRaw.replace(/[^0-9%]/g, '')}"`;
      }
      return `<img src="${escapeAttr(fileUrl)}" alt="${escapeAttr(alt)}"${title ? ` title="${escapeAttr(title.replace(/['"]/g, ''))}"` : ''}${sizing} />`;
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
    const d = new Date(frontmatter.date);
    if (!isNaN(d.getTime())) {
      prependMarkdown += `*${d.toLocaleDateString()}*\n\n`;
    }
  }
  processedMarkdown = prependMarkdown + processedMarkdown;

  const mermaidBlocks: any[] = []; // Using any to avoid importing MermaidBlock type here for now, or we can just let it be any array

  let parsed: any;
  let html: string;
  let browser;
  let title: string = '';
  
  let localMermaidInitPromise: Promise<import('playwright-core').Page | null> | null = null;
  if (!options.sharedMermaidPage && (frontmatter.mermaid?.enabled !== false && options.mermaid?.enabled !== false)) {
    localMermaidInitPromise = (async () => {
      try {
        let b;
        if (options.sharedBrowser) {
          b = options.sharedBrowser;
        } else {
          const { globalBrowserManager } = await import('./browser-manager.js');
          b = await globalBrowserManager.acquireBrowser();
        }
        const { initializeMermaid } = await import('../plugins/mermaid/runtime.js');
        const ctx = await b.newContext({ deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        await initializeMermaid(page);
        return page;
      } catch {
        return null; // Fallback to synchronous init in renderer.ts if it fails
      }
    })();
  }

  try {
    const { loadTheme } = await import('../themes/loader.js');
    // Security: frontmatter.theme is untrusted document content.
    // Only accept simple built-in names (letters, digits, hyphens, underscores).
    // Custom paths (containing '/', '.', '\' or '..') must come from config/API (options.theme), not documents.
    const SAFE_THEME_NAME = /^[a-zA-Z0-9_-]+$/;
    let frontmatterTheme: string | undefined;
    if (frontmatter.theme) {
      if (SAFE_THEME_NAME.test(String(frontmatter.theme))) {
        frontmatterTheme = String(frontmatter.theme);
      } else {
        // Log a warning and ignore the unsafe theme value
        warnings.push(`Frontmatter 'theme' value "${frontmatter.theme}" is not a valid built-in theme name and was ignored. Use the --theme flag or config file for custom theme paths.`);
      }
    }
    const themeName = frontmatterTheme || options.theme || 'default';
    let theme = null;
    try {
      theme = await loadTheme(themeName);
    } catch (e: any) {
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_INVALID_THEME,
        'Theme Load Error',
        `Failed to load theme "${themeName}": ${e.message}`
      );
    }

    const ctx: RenderContext = {
      inputPath,
      outputPath,
      frontmatter,
      options: options as any,
      logger: console
    };

    parsed = await parseMarkdown(processedMarkdown, {
      registry,
      toc: options.toc,
      tocDepth: options.tocDepth,
      tocTitle: options.tocTitle,
      pageBreaks: options.pageBreaks,
      mermaidBlocks,
      math: options.math,
      obsidian: options.obsidian,
      shikiTheme: theme?.shikiTheme,
      outline: options.outline,
      renderContext: ctx,
    });

    title = options.metadata?.title || frontmatter.title || (input === '-' ? 'Untitled Document' : path.basename(input, path.extname(input)));
    
    let finalHtml = parsed.html;
    if (options.title !== false && !/<h1\b[^>]*>/i.test(finalHtml)) {
      const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      finalHtml = `<h1 class="document-title" style="margin-top: 0; padding-top: 0;">${escapeHtml(title)}</h1>\n` + finalHtml;
    }

    html = await renderHtmlTemplate(finalHtml, title, { 
      cssclass: frontmatter.cssclass,
      mathEnabled: options.math?.enabled,
      obsidianEnabled: !!options.obsidian,
      theme,
      fontSize: options.fontSize,
      lineHeight: options.lineHeight,
      watermark: options.watermark,
      noLinkUnderline: options.noLinkUnderline,
      linkColor: options.linkColor
    });

    if (options.sharedBrowser) {
      browser = options.sharedBrowser;
    } else {
      const { globalBrowserManager } = await import('./browser-manager.js');
      browser = await globalBrowserManager.acquireBrowser();
    }

    const resolvedSharedMermaidPage = localMermaidInitPromise ? await localMermaidInitPromise : (options as any).sharedMermaidPage;
    
      const baseTimeout = options.mermaid?.timeout || 30000;
      const fmTimeout = frontmatter.mermaid?.timeout ? Number(frontmatter.mermaid.timeout) : undefined;
      const safeTimeout = (fmTimeout && fmTimeout <= baseTimeout) ? fmTimeout : baseTimeout;

      const baseEnabled = options.mermaid?.enabled !== false;
      const fmEnabled = frontmatter.mermaid?.enabled !== false;
      const safeEnabled = baseEnabled && fmEnabled;

      const { processBeforeRender } = await import('../renderer/pipeline.js');
      const processedHtml = await processBeforeRender(html, browser, mermaidBlocks, warnings, {
        theme: frontmatterTheme || options.theme,
        globalMermaidTheme: theme?.mermaidTheme || frontmatter.mermaid?.theme || options.mermaid?.theme,
        themeVariables: theme?.mermaidThemeVariables,
        timeout: safeTimeout,
        mermaidEnabled: safeEnabled,
        maxWidth: frontmatter.mermaid?.maxWidth || options.mermaid?.maxWidth,
      maxHeight: frontmatter.mermaid?.maxHeight || options.mermaid?.maxHeight,
      sharedMermaidPage: resolvedSharedMermaidPage,
      registry,
      ctx
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
      creationDate: options.metadata?.creationDate ?? (frontmatter.date ? (isNaN(new Date(frontmatter.date).getTime()) ? undefined : new Date(frontmatter.date)) : undefined),
    };


    const useDate = options.addDate || options.documentMeta;
    const useTitle = options.addFilename || options.documentMeta;
    const usePageNumbers = options.pageNumbers || options.documentMeta;
    const pageNumPos = typeof options.pageNumbers === 'string' ? options.pageNumbers : 'bottom-center';

    if (headerEnabled && options.header !== undefined) {
      marginTop = '30mm';
      if (typeof options.header === 'object' && options.header.template) {
        headerTemplate = options.header.template;
        headerTemplate = headerTemplate.replace(/\{frontmatter\.([^}]+)\}/g, (match, key) => sanitizeFrontmatterValue(frontmatter[key]));
      } else {
        const titleHtml = useTitle ? '<span class="title"></span>' : '';
        const dateHtml = useDate ? `<span>${metadata.author ? metadata.author + ' - ' : ''}<span class="date"></span></span>` : '';
        headerTemplate = `
        <div style="font-family: Inter, sans-serif; font-size: 9px; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; border-bottom: 0.5px solid #ccc; margin-bottom: 5mm; padding-bottom: 2mm;">
          ${titleHtml}
          ${dateHtml}
        </div>`;
      }
    } else {
      const topCenter = (usePageNumbers && pageNumPos === 'top-center') ? '<span class="pageNumber"></span>' : '';
      const topLeft = useTitle ? '<span class="title"></span>' : '';
      let topRight = useDate ? '<span class="date"></span>' : '';
      
      if (usePageNumbers && pageNumPos === 'top-right') topRight += ' <span class="pageNumber"></span>';
      
      if (useDate || useTitle || (usePageNumbers && pageNumPos.startsWith('top'))) {
        marginTop = '20mm';
        
        // Simple 3-column flex
        headerTemplate = `
        <div style="font-family: Inter, sans-serif; font-size: 9px; width: 100%; display: flex; padding: 0 10mm; color: #888;">
          <div style="flex: 1; text-align: left;">${topLeft}</div>
          <div style="flex: 1; text-align: center;">${topCenter}</div>
          <div style="flex: 1; text-align: right;">${topRight}</div>
        </div>`;
      }
    }

    let footerTemplate = undefined;
    let marginBottom = margin;
    const footerEnabled = options.footer === true || (typeof options.footer === 'object' && options.footer.enabled !== false);

    if (footerEnabled && options.footer !== undefined) {
      marginBottom = '30mm';
      if (typeof options.footer === 'object' && options.footer.template) {
        footerTemplate = options.footer.template;
        footerTemplate = footerTemplate.replace(/\{frontmatter\.([^}]+)\}/g, (match, key) => sanitizeFrontmatterValue(frontmatter[key]));
      } else {
        const pageHtml = usePageNumbers ? '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>' : '';
        footerTemplate = `
        <div style="font-family: Inter, sans-serif; font-size: 9px; width: 100%; padding: 0 15mm; display: flex; justify-content: center; border-top: 0.5px solid #ccc; margin-top: 5mm; padding-top: 2mm;">
          ${pageHtml}
        </div>`;
      }
    } else {
      if (usePageNumbers && pageNumPos.startsWith('bottom')) {
        marginBottom = '20mm';
        const align = pageNumPos === 'bottom-right' ? 'right' : 'center';
        footerTemplate = `
        <div style="font-family: Inter, sans-serif; font-size: 9px; width: 100%; display: flex; padding: 0 10mm; color: #888;">
          <div style="flex: 1; text-align: left;"></div>
          <div style="flex: 1; text-align: center;">${align === 'center' ? '<span class="pageNumber"></span>' : ''}</div>
          <div style="flex: 1; text-align: right;">${align === 'right' ? '<span class="pageNumber"></span>' : ''}</div>
        </div>`;
      }
    }

    const displayHeaderFooter = (headerEnabled && options.header !== undefined) || 
                                (footerEnabled && options.footer !== undefined) || 
                                !!usePageNumbers || !!useDate || !!useTitle;

    if (displayHeaderFooter) {
      if (!headerTemplate) headerTemplate = '<span></span>';
      if (!footerTemplate) footerTemplate = '<span></span>';
    }
    const stagePath = outputPath + '.stage';
    await generatePdf({  
      html: processedHtml, 
      outputPath: stagePath, 
      format: paper, 
      margin,
      marginTop,
      marginBottom,
      displayHeaderFooter,
      headerTemplate,
      footerTemplate,
      browser,
      sharedContext: (options as any).sharedContext,
      registry,
      renderContext: ctx,
      offline: options.offline
    });
    
    let pageCounts = await injectMetadata(
      stagePath, 
      metadata, 
      options.outline ? ctx.headings : undefined,
      options.watermark
    );

    const fsNode = await import('node:fs');

    if (options.coverPage) {
      const { prependCoverPage } = await import('../features/cover.js');
      const pdfBytes = fsNode.readFileSync(stagePath);
      const newPdfBytes = await prependCoverPage(pdfBytes, options.coverPage, options as any);
      fsNode.writeFileSync(stagePath, newPdfBytes);
      // We don't recalculate pageCounts here accurately because it's just for stats, but we could
    }

    if (options.password) {
      const { encryptPdf } = await import('../pdf/encrypt.js');
      await encryptPdf(stagePath, options.password);
    }

    // Final atomic write to prevent incomplete PDFs
    fsNode.renameSync(stagePath, outputPath);

    if (options.cache !== false && cacheHash) {
      const { updateCache } = await import('./cache.js');
      updateCache(inputPath, cacheHash, outputPath);
    }

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
    await registry.teardownAll();
    if (localMermaidInitPromise) {
      try {
        const page = await localMermaidInitPromise;
        if (page && page.context()) {
          await page.context().close();
        }
      } catch {
        // ignore
      }
      if (!options.sharedBrowser) {
        const { globalBrowserManager } = await import('./browser-manager.js');
        globalBrowserManager.releaseBrowser();
      }
    }
    if (!options.sharedBrowser) {
      const { globalBrowserManager } = await import('./browser-manager.js');
      globalBrowserManager.releaseBrowser();
    }
  }
}



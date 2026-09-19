import type { MermaidBlock } from '../plugins/mermaid/index.js';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';

let shikiHighlighter: any | null = null;
// Cache the pre-shiki pipeline (everything up to but not including the mermaid detector + shiki)
const processorCache = new Map<string, any>();

function rehypeExpandDetails() {
  return async (tree: any) => {
    const { visit } = await import('unist-util-visit');
    visit(tree, 'element', (node) => {
      if (node.tagName === 'details') {
        node.properties = node.properties || {};
        node.properties.open = true;
      }
    });
  };
}

export async function parseMarkdown(
  markdown: string,
  options?: { 
    registry?: import('../plugins/registry.js').PluginRegistry;
    theme?: string;
    toc?: boolean; 
    tocDepth?: number; 
    tocTitle?: string;
    pageBreaks?: {
      h1NewPage?: boolean;
      hrAsPageBreak?: boolean;
    };
    mermaidBlocks?: MermaidBlock[];
    math?: {
      enabled?: boolean;
      macros?: Record<string, string>;
      strict?: boolean;
    };
    obsidian?: {
      resolveLinks?: boolean;
      showTags?: boolean;
    };
    shikiTheme?: string;
    outline?: boolean;
    renderContext?: import('../types/context.js').RenderContext;
  }
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];
  const mermaidBlocks = options?.mermaidBlocks || [];
  
  const { getSingletonHighlighter, bundledLanguages } = await import('shiki');

  // Dynamically detect languages used in the markdown (excluding mermaid, handled separately)
  const codeBlockRegex = /(?:```|~~~)([a-zA-Z0-9_\-+]+)/g;
  const matches = [...markdown.matchAll(codeBlockRegex)];
  const detectedLangs = Array.from(new Set(matches.map(m => m[1].toLowerCase()).filter(l => l !== 'mermaid')));
  const validLangs = detectedLangs.filter(lang => lang in bundledLanguages);
  const shikiLangs = validLangs.length > 0 ? validLangs : ['txt'];

  // Initialise the Shiki singleton once (expensive - loads grammar bundles)
  if (!shikiHighlighter) {
    shikiHighlighter = await getSingletonHighlighter({
      themes: ['github-light', 'github-dark', 'dracula', 'nord'],
      langs: []
    });
  }

  if (shikiLangs.length > 0) {
    await shikiHighlighter.loadLanguage(...(shikiLangs as any));
  }

  const markdownPluginNames = options?.registry?.getMarkdownPlugins().map(p => p.name).join(',') || '';
  const htmlPluginNames = options?.registry?.getHtmlPlugins().map(p => p.name).join(',') || '';

  // Cache key for the pre-shiki pipeline (no mermaid blocks - those are per-file)
  const cacheKey = JSON.stringify({
    math: options?.math,
    toc: options?.toc,
    tocDepth: options?.tocDepth,
    tocTitle: options?.tocTitle,
    pageBreaks: options?.pageBreaks,
    obsidian: options?.obsidian,
    mdPlugins: markdownPluginNames,
    htmlPlugins: htmlPluginNames
  });

  let baseProcessor = processorCache.get(cacheKey);

  if (baseProcessor) {
    // Move to end for LRU behavior
    processorCache.delete(cacheKey);
    processorCache.set(cacheKey, baseProcessor);
  }

  if (!baseProcessor) {
    const [
      { unified },
      { default: remarkParse },
      { default: remarkBlockRefs },
      { default: remarkWikiLinks },
      { default: remarkTags },
      { default: remarkHighlight },
      { default: remarkMath },
      { default: remarkGfm },
      { default: remarkRehype },
      { default: rehypePageBreaks },
      { default: rehypeKatex },
      { default: rehypeSlug },
      { default: rehypeCallouts },
      { default: rehypeToc }
    ] = await Promise.all([
      import('unified'),
      import('remark-parse'),
      import('../plugins/obsidian/block-refs.js'),
      import('../plugins/obsidian/wiki-links.js'),
      import('../plugins/obsidian/tags.js'),
      import('../plugins/obsidian/highlight.js'),
      import('remark-math'),
      import('remark-gfm'),
      import('remark-rehype'),
      import('../plugins/layout/page-breaks.js'),
      import('rehype-katex'),
      import('rehype-slug'),
      import('../plugins/obsidian/callouts.js'),
      import('../plugins/layout/toc.js')
    ]);

    let proc: any = unified()
      .use(remarkParse)
      .use(remarkBlockRefs)
      .use(remarkWikiLinks as any, { resolveLinks: options?.obsidian?.resolveLinks })
      .use(remarkTags as any, { showTags: options?.obsidian?.showTags })
      .use(remarkHighlight as any);

    if (options?.math?.enabled !== false) {
      // @ts-expect-error - no types available for mhchem
      await import('katex/contrib/mhchem');
      proc = proc.use(remarkMath as any);
    }

    if (options?.registry) {
      for (const p of options.registry.getMarkdownPlugins()) {
        proc = proc.use(p.plugin, p.options);
      }
    }

    const rehypeSanitize = (await import('rehype-sanitize')).default;
    const { defaultSchema } = await import('rehype-sanitize');
    
    // We want to allow some styling/classes if users use them, but block dangerous things
    // like meta refresh, iframes, script, object, embed.
    
    // Strip existing restrictive className rules from defaultSchema
    const cleanAttributes: Record<string, any[]> = {};
    for (const [tag, attrs] of Object.entries(defaultSchema.attributes || {})) {
      cleanAttributes[tag] = attrs.filter((attr: any) => 
        attr !== 'className' && (!Array.isArray(attr) || attr[0] !== 'className')
      );
    }
    
    const customSchema = {
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames || []), 'span'],
      attributes: {
        ...cleanAttributes,
        '*': [...(cleanAttributes['*'] || []), 'className', 'style', 'id'],
        'a': [...(cleanAttributes.a || []), 'data-target', 'data-unresolved'],
        'div': [...(cleanAttributes.div || []), 'data-type'],
      }
    };

    proc = proc
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypePageBreaks, options?.pageBreaks)
      .use(rehypeSanitize, customSchema);

    if (options?.math?.enabled !== false) {
      proc = proc.use(rehypeKatex as any, {
        strict: options?.math?.strict ?? false,
        macros: options?.math?.macros,
        throwOnError: false,
        errorColor: '#cc0000',
      });
    }

    if (options?.registry) {
      for (const p of options.registry.getHtmlPlugins()) {
        proc = proc.use(p.plugin, p.options);
      }
    }

    proc = proc
      .use(rehypeSlug)
      .use(rehypeCallouts as any)
      .use(rehypeToc, {
        enable: options?.toc,
        depth: options?.tocDepth,
        title: options?.tocTitle,
      })
      .use(rehypeExpandDetails);

    baseProcessor = proc;
    processorCache.set(cacheKey, baseProcessor);
    if (processorCache.size > 10) {
      const firstKey = processorCache.keys().next().value;
      if (firstKey) processorCache.delete(firstKey);
    }
  }

  // Build the final per-file pipeline:
  //   baseProcessor → mermaid detector (mutates mermaidBlocks, replaces <pre><code.language-mermaid> with placeholders)
  //                 → shiki (highlights remaining code blocks, AFTER mermaid placeholders are already gone)
  //                 → stringify
  
  // Prevent V8 stack overflow from pathologically nested blockquotes
  let maxNestingDepth = 0;
  for (let i = 0, len = markdown.length; i < len; i++) {
    if (markdown[i] === '>') {
      let depth = 0;
      while (i < len && (markdown[i] === '>' || markdown[i] === ' ')) {
        if (markdown[i] === '>') depth++;
        i++;
      }
      if (depth > maxNestingDepth) maxNestingDepth = depth;
      // Skip the rest of the line
      while (i < len && markdown[i] !== '\n') i++;
    } else {
      // Skip the rest of the line
      while (i < len && markdown[i] !== '\n') i++;
    }
  }
  if (maxNestingDepth > 200) {
    throw new Md2PdfError(
      Md2PdfErrorCode.ERR_DOCUMENT_TOO_COMPLEX,
      'Document Too Complex',
      `The document contains blockquote nesting ${maxNestingDepth} levels deep. Maximum supported depth is 200.`
    );
  }

  let file;
  try {
    const [
      { rehypeMermaidDetector },
      { default: rehypeShikiFromHighlighter },
      { default: rehypeOutline },
      { default: rehypeStringify }
    ] = await Promise.all([
      import('../plugins/mermaid/index.js'),
      import('@shikijs/rehype/core'),
      import('../plugins/layout/outline.js'),
      import('rehype-stringify')
    ]);

    file = await baseProcessor()
      .use(rehypeMermaidDetector, { blocks: mermaidBlocks })
      .use(() => rehypeShikiFromHighlighter(shikiHighlighter!, {
        theme: options?.shikiTheme || 'github-light',
        fallbackLanguage: 'txt',
        onError: (err: unknown) => {
          if (err instanceof Error) {
            warnings.push(err.message);
          } else {
            warnings.push(String(err));
          }
        }
      }))
      .use(rehypeOutline, { enable: options?.outline, context: options?.renderContext })
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(markdown);
  } catch (e) {
    if (e instanceof RangeError) {
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_DOCUMENT_TOO_COMPLEX,
        'Document Too Complex',
        'The document structure is too deeply nested for the parser to process.'
      );
    }
    throw e;
  }

  // Add any warnings from unified itself
  file.messages.forEach((msg: any) => {
    if (msg.source === 'rehype-katex' && msg.cause) {
      warnings.push(`KaTeX warning (line ${msg.line || '?'}): ${msg.cause.message || msg.reason}`);
    } else {
      warnings.push(msg.reason || msg.message);
    }
  });
  
  return { html: String(file), warnings };
}

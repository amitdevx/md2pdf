import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { getSingletonHighlighter, bundledLanguages, Highlighter } from 'shiki';
import rehypeStringify from 'rehype-stringify';
import rehypeToc from '../plugins/layout/toc.js';
import rehypePageBreaks from '../plugins/layout/page-breaks.js';
import remarkBlockRefs from '../plugins/obsidian/block-refs.js';

import remarkWikiLinks from '../plugins/obsidian/wiki-links.js';
import remarkTags from '../plugins/obsidian/tags.js';
import remarkHighlight from '../plugins/obsidian/highlight.js';
import rehypeCallouts from '../plugins/obsidian/callouts.js';

import { rehypeMermaidDetector, MermaidBlock } from '../plugins/mermaid/index.js';
import { visit } from 'unist-util-visit';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';

let shikiHighlighter: Highlighter | null = null;
// Cache the pre-shiki pipeline (everything up to but not including the mermaid detector + shiki)
const processorCache = new Map<string, any>();

function rehypeExpandDetails() {
  return (tree: any) => {
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
  }
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];
  const mermaidBlocks = options?.mermaidBlocks || [];
  
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

    proc = proc
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true });

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
      .use(rehypePageBreaks, options?.pageBreaks)
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
  const maxNestingDepth = Math.max(0, ...markdown.split('\n').map(
    line => (line.match(/^(>\s*)+/) || [''])[0].split('>').length - 1
  ));
  if (maxNestingDepth > 200) {
    throw new Md2PdfError(
      Md2PdfErrorCode.ERR_DOCUMENT_TOO_COMPLEX,
      'Document Too Complex',
      `The document contains blockquote nesting ${maxNestingDepth} levels deep. Maximum supported depth is 200.`
    );
  }

  let file;
  try {
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

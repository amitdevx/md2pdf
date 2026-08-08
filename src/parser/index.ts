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
import { VFile } from 'vfile';
import rehypeCallouts from '../plugins/obsidian/callouts.js';

import { rehypeMermaidDetector, MermaidBlock } from '../plugins/mermaid/index.js';
import { visit } from 'unist-util-visit';

let shikiHighlighter: Highlighter | null = null;
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
  
  // Dynamically detect languages used in the markdown to prevent Shiki from loading all 200+ grammars (saves ~10 seconds)
  const codeBlockRegex = /(?:```|~~~)([a-zA-Z0-9_\-+]+)/g;
  const matches = [...markdown.matchAll(codeBlockRegex)];
  const detectedLangs = Array.from(new Set(matches.map(m => m[1].toLowerCase())));
  const validLangs = detectedLangs.filter(lang => lang in bundledLanguages);
  
  // We need at least one valid language or fallback language if array is empty, otherwise Shiki might default to all
  const shikiLangs = validLangs.length > 0 ? validLangs : ['txt'];

  if (!shikiHighlighter) {
    shikiHighlighter = await getSingletonHighlighter({
      themes: ['github-light', 'github-dark', 'dracula', 'nord'],
      langs: Object.keys(bundledLanguages)
    });
  }

  const cacheKey = JSON.stringify({
    options,
    shikiLangs
  });

  let processor = processorCache.get(cacheKey);

  if (!processor) {
    processor = unified()
    .use(remarkParse)
    .use(remarkBlockRefs)
    .use(remarkWikiLinks as any, { resolveLinks: options?.obsidian?.resolveLinks })
    .use(remarkTags as any, { showTags: options?.obsidian?.showTags })
    .use(remarkHighlight as any);

  if (options?.math?.enabled !== false) {
    // @ts-expect-error - no types available for mhchem
    await import('katex/contrib/mhchem');
    processor = processor.use(remarkMath as any);
  }

  if (options?.registry) {
    for (const p of options.registry.getMarkdownPlugins()) {
      processor = processor.use(p.plugin, p.options);
    }
  }

  processor = processor
    // remark-gfm natively enables GFM footnotes, tables, and tasklists
    .use(remarkGfm)
    // allowDangerousHtml: true passes raw HTML tags in Markdown directly to the PDF output.
    .use(remarkRehype, { allowDangerousHtml: true });

  if (options?.math?.enabled !== false) {
    processor = processor.use(rehypeKatex as any, {
      strict: options?.math?.strict ?? false,
      macros: options?.math?.macros,
      throwOnError: false,
      errorColor: '#cc0000',
    });
  }

  if (options?.registry) {
    for (const p of options.registry.getHtmlPlugins()) {
      processor = processor.use(p.plugin, p.options);
    }
  }

  processor = processor
    .use(rehypeSlug)
    .use(rehypeCallouts as any)
    .use(rehypePageBreaks, options?.pageBreaks)
    .use(rehypeToc, {
      enable: options?.toc,
      depth: options?.tocDepth,
      title: options?.tocTitle,
    })
    .use(rehypeExpandDetails)
    .use(rehypeMermaidDetector)
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
    // allowDangerousHtml: true stringifies any raw HTML nodes so they render correctly.
    .use(rehypeStringify, { allowDangerousHtml: true });

    processorCache.set(cacheKey, processor);
  }

  // Inject the array into vfile data for the plugin to populate
  const vfile = new VFile(markdown);
  vfile.data.mermaidBlocks = mermaidBlocks;
  const file = await processor().process(vfile);

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

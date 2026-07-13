import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/contrib/mhchem/mhchem.js';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeToc from '../plugins/toc.js';
import rehypePageBreaks from '../plugins/page-breaks.js';

import remarkWikiLinks from '../plugins/obsidian/wiki-links.js';
import remarkTags from '../plugins/obsidian/tags.js';
import remarkHighlight from '../plugins/obsidian/highlight.js';
import rehypeCallouts from '../plugins/obsidian/callouts.js';

import { rehypeMermaidDetector, MermaidBlock } from '../plugins/mermaid/index.js';
import { visit } from 'unist-util-visit';

function resolveShikiTheme(md2pdfTheme?: string): string {
  const map: Record<string, string> = {
    'default': 'github-light',
    'github': 'github-light',
    'obsidian-dark': 'github-dark',
    'dracula': 'dracula',
    'nord': 'nord',
  };
  return map[md2pdfTheme || 'default'] || 'github-light';
}

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
  }
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];
  const mermaidBlocks = options?.mermaidBlocks || [];
  
  let processor: any = unified()
    .use(remarkParse)
    .use(remarkWikiLinks as any, { resolveLinks: options?.obsidian?.resolveLinks })
    .use(remarkTags as any, { showTags: options?.obsidian?.showTags })
    .use(remarkHighlight as any);

  if (options?.math?.enabled !== false) {
    processor = processor.use(remarkMath as any);
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

  const file = await processor
    .use(rehypeSlug)
    .use(rehypeCallouts as any)
    .use(rehypePageBreaks, options?.pageBreaks)
    .use(rehypeToc, {
      enable: options?.toc,
      depth: options?.tocDepth,
      title: options?.tocTitle,
    })
    .use(rehypeMermaidDetector, { blocks: mermaidBlocks })
    .use(rehypeExpandDetails)
    .use(rehypeShiki, {
      theme: resolveShikiTheme(options?.theme),
      fallbackLanguage: 'txt',
      onError: (err: unknown) => {
        if (err instanceof Error) {
          warnings.push(err.message);
        } else {
          warnings.push(String(err));
        }
      }
    })
    // allowDangerousHtml: true stringifies any raw HTML nodes so they render correctly.
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

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

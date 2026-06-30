import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeToc from '../plugins/toc.js';
import rehypePageBreaks from '../plugins/page-breaks.js';

import { rehypeMermaidDetector, MermaidBlock } from '../plugins/mermaid/index.js';

export async function parseMarkdown(
  markdown: string,
  options?: { 
    toc?: boolean; 
    tocDepth?: number; 
    tocTitle?: string;
    pageBreaks?: {
      h1NewPage?: boolean;
      hrAsPageBreak?: boolean;
    };
    mermaidBlocks?: MermaidBlock[];
  }
): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];
  const mermaidBlocks = options?.mermaidBlocks || [];
  
  const file = await unified()
    .use(remarkParse)
    // remark-gfm natively enables GFM footnotes, tables, and tasklists
    .use(remarkGfm)
    // allowDangerousHtml: true passes raw HTML tags in Markdown directly to the PDF output.
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypePageBreaks, options?.pageBreaks)
    .use(rehypeToc, {
      enable: options?.toc,
      depth: options?.tocDepth,
      title: options?.tocTitle,
    })
    .use(rehypeMermaidDetector, { blocks: mermaidBlocks })
    .use(rehypeShiki, {
      themes: {
        light: 'github-light',
        dark: 'one-dark-pro',
      },
      defaultColor: false,
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
  file.messages.forEach(msg => warnings.push(msg.reason || msg.message));
  
  return { html: String(file), warnings };
}

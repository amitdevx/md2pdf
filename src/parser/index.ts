import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSlug from 'rehype-slug';
import rehypeShiki from '@shikijs/rehype';

export async function parseMarkdown(markdown: string): Promise<{ html: string; warnings: string[] }> {
  const warnings: string[] = [];
  
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeShiki, {
      themes: {
        light: 'github-light',
        dark: 'one-dark-pro',
      },
      defaultColor: false,
      fallbackLanguage: 'txt',
      onError: (err: any) => {
        warnings.push(err.message || String(err));
      }
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  // Add any warnings from unified itself
  file.messages.forEach(msg => warnings.push(msg.reason || msg.message));
  
  return { html: String(file), warnings };
}

import { baseCss, printCss } from '../assets/css.js';
import { fontCss } from '../assets/fonts.js';
// Lazy-load: only imported when math is actually used
let _katexCss: string | null = null;
async function getKatexCss(): Promise<string> {
  if (_katexCss === null) {
    const { katexCss } = await import('../assets/katex.js');
    _katexCss = katexCss;
  }
  return _katexCss;
}
import { obsidianCss } from '../assets/obsidian.js';
import type { Theme } from '../types/index.js';

function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

export async function renderHtmlTemplate(contentHtml: string, title: string = 'Document', options?: { cssclass?: string; mathEnabled?: boolean; obsidianEnabled?: boolean; theme?: Theme | null; fontSize?: string; lineHeight?: string | number }): Promise<string> {
  const mathCss = options?.mathEnabled !== false ? await getKatexCss() : '';
  const safeTitle = escapeHtml(title);
  const bodyClass = options?.cssclass ? ` class="${escapeHtml(options.cssclass)}"` : '';
  const themeLinks = options?.theme?.fontUrls?.map(url => `<link href="${escapeHtml(url)}" rel="stylesheet">`).join('\n  ') || '';
  
  const customStyles = [];
  if (options?.fontSize) {
    const cleanSize = options.fontSize.replace(/[^a-zA-Z0-9.%-]/g, '');
    customStyles.push(`:root { --md2pdf-font-size: ${cleanSize} !important; }`);
  }
  if (options?.lineHeight) {
    const cleanHeight = String(options.lineHeight).replace(/[^0-9.]/g, '');
    customStyles.push(`:root { --md2pdf-line-height: ${cleanHeight} !important; }`);
  }
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  ${themeLinks}
  <!-- Bundled local fonts (Inter, JetBrains Mono) -->
  <style>
    ${options?.theme?.fontFaces || ''}
    ${fontCss}
    ${baseCss}
    ${options?.theme?.css || ''}
    ${printCss}
    ${mathCss}
    ${options?.obsidianEnabled !== false ? obsidianCss : ''}
    ${customStyles.join('\n    ')}
  </style>
</head>
<body${bodyClass}>
  <div class="markdown-body">
    ${contentHtml}
  </div>
</body>
</html>`;
}

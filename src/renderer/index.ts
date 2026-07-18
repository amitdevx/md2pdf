import { baseCss, printCss } from '../assets/css.js';
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

function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

export async function renderHtmlTemplate(contentHtml: string, title: string = 'Document', options?: { cssclass?: string; mathEnabled?: boolean }): Promise<string> {
  const mathCss = options?.mathEnabled !== false ? await getKatexCss() : '';
  const safeTitle = escapeHtml(title);
  const bodyClass = options?.cssclass ? ` class="${escapeHtml(options.cssclass)}"` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <!-- TODO(v0.6.0): Bundle fonts locally instead of CDN to support offline/air-gapped environments -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    ${baseCss}
    ${printCss}
    ${mathCss}
    ${obsidianCss}
  </style>
</head>
<body${bodyClass}>
  <div class="markdown-body">
    ${contentHtml}
  </div>
</body>
</html>`;
}

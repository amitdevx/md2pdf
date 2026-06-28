import { baseCss, printCss } from '../assets/css.js';

function escapeHtml(str: string): string {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

export function renderHtmlTemplate(contentHtml: string, title: string = 'Document'): string {
  const safeTitle = escapeHtml(title);
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
  </style>
</head>
<body>
  <div class="markdown-body">
    ${contentHtml}
  </div>
</body>
</html>`;
}

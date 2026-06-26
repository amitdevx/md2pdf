export function renderHtmlTemplate(contentHtml: string, title: string = 'Document'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    /* Professional Typography and Print Defaults */
    :root {
      --text-main: #333;
      --text-muted: #666;
      --bg-main: #fff;
      --border-color: #ddd;
      --link-color: #0366d6;
      --code-bg: #f6f8fa;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: var(--text-main);
      background-color: var(--bg-main);
      margin: 0;
      padding: 0;
      word-wrap: break-word;
    }

    .markdown-body {
      padding: 2em;
      max-width: 900px;
      margin: 0 auto;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
      color: #111;
      page-break-after: avoid;
    }

    h1 { font-size: 2.25em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    h2 { font-size: 1.75em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    h3 { font-size: 1.5em; }

    p, blockquote, ul, ol, dl, table, pre {
      margin-top: 0;
      margin-bottom: 16px;
    }

    a {
      color: var(--link-color);
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }

    blockquote {
      padding: 0 1em;
      color: var(--text-muted);
      border-left: 0.25em solid var(--border-color);
    }

    code, kbd, pre {
      font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
      font-size: 85%;
    }

    pre {
      padding: 16px;
      overflow: auto;
      line-height: 1.45;
      background-color: var(--code-bg);
      border-radius: 6px;
      page-break-inside: avoid;
    }

    pre code {
      padding: 0;
      margin: 0;
      background-color: transparent;
      border: 0;
    }

    code {
      padding: 0.2em 0.4em;
      margin: 0;
      background-color: var(--code-bg);
      border-radius: 6px;
    }

    table {
      border-spacing: 0;
      border-collapse: collapse;
      width: 100%;
      page-break-inside: avoid;
    }

    table th, table td {
      padding: 6px 13px;
      border: 1px solid var(--border-color);
    }

    table tr {
      background-color: var(--bg-main);
      border-top: 1px solid var(--border-color);
      page-break-inside: avoid;
    }

    table tr:nth-child(2n) {
      background-color: #f8f9fa;
    }

    img {
      max-width: 100%;
      height: auto;
      box-sizing: content-box;
      page-break-inside: avoid;
    }

    hr {
      height: 0.25em;
      padding: 0;
      margin: 24px 0;
      background-color: var(--border-color);
      border: 0;
    }

    /* Print specific adjustments */
    @media print {
      body {
        font-size: 11pt; /* Better readability for print */
      }
      .markdown-body {
        padding: 0;
        max-width: none;
      }
      a {
        text-decoration: none;
        color: #000;
      }
    }
  </style>
</head>
<body>
  <div class="markdown-body">
    ${contentHtml}
  </div>
</body>
</html>`;
}

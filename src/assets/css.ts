export const baseCss = `
:root {
  --md2pdf-font-family-body: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --md2pdf-font-family-heading: inherit;
  --md2pdf-font-family-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --md2pdf-font-size: 11pt;
  --md2pdf-line-height: 1.7;

  --md2pdf-color-text: #1a1a1a;
  --md2pdf-color-heading: #111111;
  --md2pdf-color-link: #0066cc;
  --md2pdf-color-code-bg: #f6f8fa;
  --md2pdf-color-border: #e1e4e8;
  --md2pdf-color-blockquote-border: #d0d7de;

  --md2pdf-code-border-radius: 6px;
}

body {
  font-family: var(--md2pdf-font-family-body);
  font-size: var(--md2pdf-font-size);
  line-height: var(--md2pdf-line-height);
  color: var(--md2pdf-color-text);
  background-color: #fff;
  margin: 0;
  padding: 0;
  word-wrap: break-word;
}

.markdown-body {
  padding: 0;
  margin: 0;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--md2pdf-font-family-heading);
  color: var(--md2pdf-color-heading);
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.25;
  page-break-after: avoid;
}

h1 { font-size: 2.027em; border-bottom: 1px solid var(--md2pdf-color-border); padding-bottom: 0.3em; }
h2 { font-size: 1.602em; border-bottom: 1px solid var(--md2pdf-color-border); padding-bottom: 0.3em; }
h3 { font-size: 1.266em; }
h4 { font-size: 1em; }

p, blockquote, ul, ol, dl, table, pre {
  margin-top: 0;
  margin-bottom: 16px;
  widows: 2;
  orphans: 2;
}

a { color: var(--md2pdf-color-link); text-decoration: none; }
a:hover { text-decoration: underline; }

blockquote {
  padding: 0 1em;
  color: #666;
  border-left: 3px solid var(--md2pdf-color-blockquote-border);
  font-style: italic;
}

code, kbd, pre {
  font-family: var(--md2pdf-font-family-mono);
  font-size: 85%;
}

pre {
  padding: 1em 1.2em;
  overflow-x: auto;
  line-height: 1.45;
  background-color: var(--md2pdf-color-code-bg);
  border-radius: var(--md2pdf-code-border-radius);
  page-break-inside: avoid;
}

pre code { padding: 0; margin: 0; background-color: transparent; border: 0; }

code {
  padding: 0.2em 0.4em;
  margin: 0;
  background-color: var(--md2pdf-color-code-bg);
  border-radius: var(--md2pdf-code-border-radius);
}

table {
  border-spacing: 0;
  border-collapse: collapse;
  width: 100%;
  page-break-inside: avoid;
}

table th, table td {
  padding: 8px 12px;
  border: 1px solid var(--md2pdf-color-border);
}

table th {
  font-weight: 600;
  background-color: #f6f8fa;
}

table tr {
  background-color: #fff;
  border-top: 1px solid var(--md2pdf-color-border);
  page-break-inside: avoid;
}

table tr:nth-child(even) { background-color: #f8f9fa; }

img {
  max-width: 100%;
  height: auto;
  box-sizing: content-box;
  page-break-inside: avoid;
  display: block;
  margin: auto;
}

figure {
  margin: 1em 0;
  page-break-inside: avoid;
  page-break-after: avoid;
}

figcaption {
  text-align: center;
  font-size: 85%;
  color: #666;
  margin-top: 0.5em;
}

hr {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: var(--md2pdf-color-border);
  border: 0;
}

ul { list-style-type: disc; }
ul ul { list-style-type: circle; }
ul ul ul { list-style-type: square; }

ul, ol {
  padding-left: 2em;
  list-style-position: outside;
}

li > p {
  margin-top: 16px;
}

/* Task lists */
li.task-list-item {
  list-style-type: none;
}
li.task-list-item > input[type="checkbox"] {
  margin: 0 0.5em 0 -1.5em;
}
`;

export const printCss = `
@media print {
  body {
    background-color: #fff !important;
    color: #000 !important;
  }
  
  .markdown-body {
    padding: 0;
    max-width: none;
  }
  
  * {
    color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    box-shadow: none !important;
    text-shadow: none !important;
    transition: none !important;
  }
  
  a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 90%;
    color: #333;
  }
  
  /* Remove link expansion for images */
  a[href^="http"] > img::after {
    content: "";
  }
  
  /* Ensure code blocks wrap in PDF instead of being cut off */
  pre, code, pre code {
    white-space: pre-wrap !important;
    word-wrap: break-word !important;
    overflow-x: hidden !important;
  }
}
`;

export const obsidianCss = `
/* Wiki Links */
.wiki-link {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  color: var(--md2pdf-color-link);
}
.wiki-link[data-unresolved="true"] {
  color: #888888;
}

/* Callouts */
.callout {
  border-left: 4px solid var(--callout-color, #888);
  background: color-mix(in srgb, var(--callout-color, #888) 8%, transparent);
  border-radius: 4px;
  padding: 12px 16px;
  margin: 1.2em 0;
  page-break-inside: avoid;
}
.callout-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  color: var(--callout-color, #888);
}
.callout-body {
  margin-top: 0;
  margin-bottom: 0;
}
.callout-body > p:last-child {
  margin-bottom: 0;
}
.callout[data-type="note"] { --callout-color: #0d6efd; }
.callout[data-type="info"] { --callout-color: #0dcaf0; }
.callout[data-type="tip"] { --callout-color: #198754; }
.callout[data-type="success"] { --callout-color: #20c997; }
.callout[data-type="question"] { --callout-color: #17a2b8; }
.callout[data-type="warning"] { --callout-color: #e0a800; }
.callout[data-type="failure"] { --callout-color: #fd7e14; }
.callout[data-type="danger"] { --callout-color: #dc3545; }
.callout[data-type="example"] { --callout-color: #6f42c1; }
.callout[data-type="quote"] { --callout-color: #6c757d; }

/* Tags */
.tag {
  display: inline-block;
  background: var(--md2pdf-color-tag-bg, #e8f0fe);
  color: var(--md2pdf-color-tag-text, #1a56db);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 0.85em;
  font-family: var(--md2pdf-font-family-mono);
  white-space: nowrap;
}

/* Frontmatter */
.frontmatter-date {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 2em;
}
`;

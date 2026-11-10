/**
 * Fill the `<span class="title"></span>` placeholder inside a Chromium
 * header/footer template with the resolved document title.
 *
 * Chromium's print header/footer only auto-fills `.pageNumber`,
 * `.totalPages`, and `.date`. The document title is NOT injected, so a
 * custom header that relies on a `<span class="title"></span>` placeholder
 * would otherwise render an empty title. We fill it manually here.
 *
 * The title is HTML-escaped so a hostile or accidental title cannot break
 * the header markup (e.g. inject attributes or script).
 */
export function fillTitlePlaceholder(
  template: string | undefined,
  title: string
): string | undefined {
  if (!template) return template;
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  return template.replace(
    /<span class="title"><\/span>/g,
    `<span class="title">${escapeHtml(title)}</span>`
  );
}

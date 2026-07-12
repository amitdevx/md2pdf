export interface Md2PdfConfig {
  /** Theme name or path to custom CSS/dir */
  theme?: string;
  /** Paper size. Default: 'A4' */
  paper?: 'A4' | 'Letter' | 'Legal' | 'A3';
  /** Page orientation. Default: 'portrait' */
  landscape?: boolean;
  /** Margin: '20mm' or per-side object */
  margin?: string | { top?: string; bottom?: string; left?: string; right?: string };
  /** Generate table of contents */
  toc?: boolean;
  /** TOC max heading depth. Default: 3 */
  tocDepth?: number;
  /** TOC section title. Default: 'Table of Contents' */
  tocTitle?: string;
  /** Header config */
  header?: boolean | { enabled?: boolean; template?: string };
  /** Footer config */
  footer?: boolean | { enabled?: boolean; template?: string };
  /** Mermaid config */
  mermaid?: boolean | {
    enabled?: boolean;
    timeout?: number;
    theme?: 'auto' | string;
    themeVariables?: Record<string, string>;
    maxWidth?: string;
    maxHeight?: string;
  };
  /** KaTeX math config */
  math?: boolean | {
    enabled?: boolean;
    macros?: Record<string, string>;
    numbering?: 'document' | 'section' | false;
    strict?: boolean;
  };
  /** PDF metadata */
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    lang?: string;
  };
  /** Obsidian compatibility config */
  obsidian?: {
    vaultRoot?: string;
    attachmentFolder?: string;
    resolveWikiLinks?: boolean;
    embedNotes?: boolean;
    maxEmbedDepth?: number;
    maxAttachmentSizeMb?: number;
  };
  /** Page break config */
  pageBreaks?: {
    h1NewPage?: boolean;
    hrAsPageBreak?: boolean;
  };
  /** Output options */
  output?: {
    dir?: string;
    filename?: string;
    merge?: boolean;
  };
  /** Named profiles */
  profiles?: Record<string, Omit<Md2PdfConfig, 'profiles'>>;
}

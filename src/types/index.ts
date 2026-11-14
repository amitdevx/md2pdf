import type { AnyPlugin } from './plugin.js';

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
}

export * from './config.js';
export * from './theme.js';
export * from './plugin.js';
export * from './context.js';
export interface ConvertOptions {
  input: string;
  output: string;
  plugins?: AnyPlugin[];
  sharedBrowser?: import('playwright-core').Browser;
  sharedContext?: import('playwright-core').BrowserContext;
  /** Internal shared Mermaid page for batch processing performance */
  sharedMermaidPage?: import('playwright-core').Page;
  offline?: boolean;
  watermark?: string;
  splitByHeading?: 1 | 2;
  watch?: boolean;
  merge?: string;
  recursive?: boolean;
  password?: string;
  coverPage?: string;
  noLinkUnderline?: boolean;
  linkColor?: string;
  theme?: string;
  paper?: 'A4' | 'Letter' | 'Legal';
  margin?: string; // e.g., '20mm'
  marginTop?: string;
  marginBottom?: string;
  marginLeft?: string;
  marginRight?: string;
  toc?: boolean;
  tocDepth?: number;
  tocTitle?: string;
  tocPageBreak?: boolean;
  title?: boolean | string;
  addTitle?: boolean;
  fontSize?: string;
  lineHeight?: string | number;
  pageNumbers?: boolean | 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
  permissiveMermaid?: boolean;
  addDate?: boolean;
  addFilename?: boolean;
  documentMeta?: boolean;
  outline?: boolean;
  metadata?: PdfMetadata;
  header?: boolean | { enabled?: boolean; template?: string };
  footer?: boolean | { enabled?: boolean; template?: string };
  pageBreaks?: {
    h1NewPage?: boolean;
    hrAsPageBreak?: boolean;
  };
  /** Auto-number figure/table captions */
  captions?: {
    enable?: boolean;
    figures?: boolean;
    tables?: boolean;
    figLabel?: string;
    tabLabel?: string;
  };
  /** Internal optimization to prevent double-parsing of gray-matter in single-file mode */
  __preparsed?: { data: Record<string, unknown>; content: string };
  mermaid?: {
    enabled?: boolean;
    theme?: 'default' | 'dark' | 'base' | 'neutral';
    timeout?: number;
    maxWidth?: string;
    maxHeight?: string;
  };
  math?: {
    enabled?: boolean;
    macros?: Record<string, string>;
    numbering?: 'document' | 'section' | false;
    strict?: boolean;
  };
  obsidian?: {
    resolveLinks?: boolean;
    showTags?: boolean;
    showDate?: boolean;
    vaultRoot?: string;
    attachmentFolder?: string;
    embedNotes?: boolean;
    maxEmbedDepth?: number;
    maxAttachmentSizeMb?: number;
  };
  cache?: boolean;
}

export interface ConvertResult {
  outputPath: string;
  pageCounts: number;
  renderTimeMs: number;
  warnings: string[];
  metadata?: PdfMetadata;
  fromCache?: boolean;
  html?: string;
}

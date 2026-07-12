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
export interface ConvertOptions {
  input: string;
  output: string;
  theme?: string;
  paper?: 'A4' | 'Letter' | 'Legal';
  margin?: string; // e.g., '20mm'
  toc?: boolean;
  tocDepth?: number;
  tocTitle?: string;
  metadata?: PdfMetadata;
  header?: boolean | { enabled?: boolean; template?: string };
  footer?: boolean | { enabled?: boolean; template?: string };
  pageBreaks?: {
    h1NewPage?: boolean;
    hrAsPageBreak?: boolean;
  };
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
}

export interface ConvertResult {
  outputPath: string;
  pageCounts: number;
  renderTimeMs: number;
  warnings: string[];
  metadata?: PdfMetadata;
}

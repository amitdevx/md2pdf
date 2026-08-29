export interface CliOptions {
  output?: string;
  toc?: boolean;
  tocDepth?: number;
  tocTitle?: string;
  header?: boolean;
  footer?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  paper?: string;
  margin?: string;
  hrPageBreak?: boolean;
  h1NewPage?: boolean;
  theme?: string;
  mermaidTheme?: string;
  mermaidTimeout?: string;
  math?: boolean;
  debug?: boolean;
  verbose?: boolean;
  jsonErrors?: boolean;
  tags?: boolean;
  resolveLinks?: boolean;
  vaultRoot?: string;
  attachmentFolder?: string;
  maxAttachmentSize?: string;
  config?: string;
  profile?: string;
  cache?: boolean;
  concurrency?: string;
  force?: boolean;
  dryRun?: boolean;
  quiet?: boolean;
  __preparsed?: any;
}


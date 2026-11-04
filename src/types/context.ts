import { Md2PdfConfig } from './config.js';

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

export type ResolvedMd2PdfConfig = Md2PdfConfig;

export interface RenderContext {
  /** Resolved input file path */
  inputPath: string;
  /** Target output file path */
  outputPath: string;
  /** Parsed frontmatter (from gray-matter) */
  frontmatter: Record<string, unknown>;
  /** Final merged options for this render */
  options: ResolvedMd2PdfConfig;
  /** Logger - use instead of console.log */
  logger: Logger;
  headings?: { level: number; title: string; id: string; pageIndex: number }[];
}

export interface ExportContext {
  /** Resolved input file path */
  inputPath: string;
  /** Target output file path */
  outputPath: string;
  /** Parsed frontmatter (from gray-matter) */
  frontmatter: Record<string, unknown>;
  /** Final merged options for this export */
  options: ResolvedMd2PdfConfig;
  /** Logger - use instead of console.log */
  logger: Logger;
  headings?: { level: number; title: string; id: string; pageIndex: number }[];
}

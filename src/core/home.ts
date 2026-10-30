import path from 'node:path';
import os from 'node:os';

/**
 * Returns the base md2pdf directory.
 * Defaults to ~/.md2pdf, but can be overridden via process.env.MD2PDF_HOME.
 */
export function getMd2PdfHome(): string {
  return process.env.MD2PDF_HOME || path.join(os.homedir(), '.md2pdf');
}

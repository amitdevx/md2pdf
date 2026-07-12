export { convert } from './core/index.js';
export type { ConvertOptions, ConvertResult, PdfMetadata, Md2PdfConfig } from './types/index.js';

export function defineConfig<T extends import('./types/index.js').Md2PdfConfig>(config: T): T {
  return config;
}

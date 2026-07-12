import type { Md2PdfConfig } from '../types/config.js';
import type { ConvertOptions } from '../types/index.js';

function isObject(item: any) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

function deepMerge(target: any, source: any): any {
  if (!source) return target;
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

export function mergeConfig(
  base: Md2PdfConfig,
  profileName?: string,
  cliFlags?: Record<string, any>
): ConvertOptions {
  let merged: Md2PdfConfig = deepMerge({}, base);

  if (profileName && base.profiles && base.profiles[profileName]) {
    merged = deepMerge(merged, base.profiles[profileName]);
  }
  
  if (cliFlags) {
    // Top-level CLI overrides
    if (cliFlags.theme !== undefined) merged.theme = cliFlags.theme;
    if (cliFlags.paper !== undefined) merged.paper = cliFlags.paper;
    if (cliFlags.margin !== undefined) merged.margin = cliFlags.margin;
    if (cliFlags.toc !== undefined) merged.toc = cliFlags.toc;
    if (cliFlags.tocDepth !== undefined) merged.tocDepth = cliFlags.tocDepth;
    if (cliFlags.tocTitle !== undefined) merged.tocTitle = cliFlags.tocTitle;
    
    // Header/footer
    if (cliFlags.header !== undefined) {
      if (typeof merged.header !== 'object') merged.header = { enabled: cliFlags.header };
      else merged.header.enabled = cliFlags.header;
    }
    if (cliFlags.headerTemplate !== undefined) {
      if (typeof merged.header !== 'object') merged.header = { template: cliFlags.headerTemplate };
      else merged.header.template = cliFlags.headerTemplate;
    }
    if (cliFlags.footer !== undefined) {
      if (typeof merged.footer !== 'object') merged.footer = { enabled: cliFlags.footer };
      else merged.footer.enabled = cliFlags.footer;
    }
    if (cliFlags.footerTemplate !== undefined) {
      if (typeof merged.footer !== 'object') merged.footer = { template: cliFlags.footerTemplate };
      else merged.footer.template = cliFlags.footerTemplate;
    }

    // Mermaid
    if (cliFlags.mermaidTheme !== undefined || cliFlags.mermaidTimeout !== undefined) {
      if (typeof merged.mermaid !== 'object') merged.mermaid = {};
      if (cliFlags.mermaidTheme !== undefined) merged.mermaid.theme = cliFlags.mermaidTheme;
      if (cliFlags.mermaidTimeout !== undefined) merged.mermaid.timeout = Number(cliFlags.mermaidTimeout);
    }

    // Math
    if (cliFlags.math !== undefined) {
      if (typeof merged.math !== 'object') merged.math = { enabled: cliFlags.math };
      else merged.math.enabled = cliFlags.math;
    }

    // Obsidian
    if (cliFlags.resolveLinks !== undefined || cliFlags.vaultRoot !== undefined || cliFlags.attachmentFolder !== undefined || cliFlags.maxAttachmentSize !== undefined) {
      if (typeof merged.obsidian !== 'object') merged.obsidian = {};
      if (cliFlags.resolveLinks !== undefined) merged.obsidian.resolveWikiLinks = cliFlags.resolveLinks;
      if (cliFlags.vaultRoot !== undefined) merged.obsidian.vaultRoot = cliFlags.vaultRoot;
      if (cliFlags.attachmentFolder !== undefined) merged.obsidian.attachmentFolder = cliFlags.attachmentFolder;
      if (cliFlags.maxAttachmentSize !== undefined) merged.obsidian.maxAttachmentSizeMb = Number(cliFlags.maxAttachmentSize);
    }
    
    // Page breaks
    if (cliFlags.hrPageBreak !== undefined || cliFlags.h1NewPage !== undefined) {
      if (typeof merged.pageBreaks !== 'object') merged.pageBreaks = {};
      if (cliFlags.hrPageBreak !== undefined) merged.pageBreaks.hrAsPageBreak = cliFlags.hrPageBreak;
      if (cliFlags.h1NewPage !== undefined) merged.pageBreaks.h1NewPage = cliFlags.h1NewPage;
    }

    // Output
    if (cliFlags.output !== undefined) {
      if (typeof merged.output !== 'object') merged.output = { filename: cliFlags.output };
      else merged.output.filename = cliFlags.output;
    }
  }

  // Map to ConvertOptions
  return {
    input: cliFlags?.input || '',
    output: merged.output?.filename || merged.output?.dir || cliFlags?.output || 'output.pdf',
    paper: (merged.paper === 'A3' ? 'A4' : merged.paper) as ConvertOptions['paper'], // A3 fallback to A4 if unhandled by options
    margin: typeof merged.margin === 'string' ? merged.margin : (merged.margin ? `${merged.margin.top||0} ${merged.margin.right||0} ${merged.margin.bottom||0} ${merged.margin.left||0}` : '20mm'),
    toc: merged.toc ?? false,
    tocDepth: merged.tocDepth ?? 3,
    tocTitle: merged.tocTitle ?? 'Table of Contents',
    header: merged.header,
    footer: merged.footer,
    theme: merged.theme || 'default',
    mermaid: {
      enabled: typeof merged.mermaid === 'object' ? merged.mermaid.enabled : !!merged.mermaid,
      theme: typeof merged.mermaid === 'object' ? (merged.mermaid.theme as any || 'auto') : 'auto',
      timeout: typeof merged.mermaid === 'object' ? merged.mermaid.timeout : 10000,
    },
    math: {
      enabled: typeof merged.math === 'object' ? merged.math.enabled : !!merged.math,
      macros: typeof merged.math === 'object' ? merged.math.macros : undefined,
      strict: typeof merged.math === 'object' ? merged.math.strict : false,
    },
    pageBreaks: {
      hrAsPageBreak: merged.pageBreaks?.hrAsPageBreak ?? false,
      h1NewPage: merged.pageBreaks?.h1NewPage ?? false,
    },
    obsidian: {
      resolveLinks: merged.obsidian?.resolveWikiLinks ?? false,
      showTags: !cliFlags?.hideTags,
      vaultRoot: merged.obsidian?.vaultRoot,
      attachmentFolder: merged.obsidian?.attachmentFolder,
      maxAttachmentSizeMb: merged.obsidian?.maxAttachmentSizeMb,
    },
  };
}

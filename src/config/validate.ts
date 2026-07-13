import { z } from 'zod';

const marginSchema = z.union([
  z.string(),
  z.object({
    top: z.string().optional(),
    bottom: z.string().optional(),
    left: z.string().optional(),
    right: z.string().optional(),
  })
]);

const headerFooterSchema = z.union([
  z.boolean(),
  z.object({
    enabled: z.boolean().optional(),
    template: z.string().optional(),
  })
]);

const baseConfigSchema = z.object({
  theme: z.string().optional(),
  paper: z.enum(['A4', 'Letter', 'Legal', 'A3']).optional(),
  landscape: z.boolean().optional(),
  margin: marginSchema.optional(),
  toc: z.boolean().optional(),
  tocDepth: z.number().min(1).max(6).optional(),
  tocTitle: z.string().optional(),
  header: headerFooterSchema.optional(),
  footer: headerFooterSchema.optional(),
  mermaid: z.union([
    z.boolean(),
    z.object({
      enabled: z.boolean().optional(),
      timeout: z.number().optional(),
      theme: z.string().optional(),
      themeVariables: z.record(z.string(), z.string()).optional(),
      maxWidth: z.string().optional(),
      maxHeight: z.string().optional(),
    })
  ]).optional(),
  math: z.union([
    z.boolean(),
    z.object({
      enabled: z.boolean().optional(),
      macros: z.record(z.string(), z.string()).optional(),
      numbering: z.union([z.enum(['document', 'section']), z.literal(false)]).optional(),
      strict: z.boolean().optional(),
    })
  ]).optional(),
  metadata: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    subject: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    lang: z.string().optional(),
  }).optional(),
  obsidian: z.object({
    vaultRoot: z.string().optional(),
    attachmentFolder: z.string().optional(),
    resolveWikiLinks: z.boolean().optional(),
    embedNotes: z.boolean().optional(),
    maxEmbedDepth: z.number().optional(),
    maxAttachmentSizeMb: z.number().optional(),
  }).optional(),
  pageBreaks: z.object({
    h1NewPage: z.boolean().optional(),
    hrAsPageBreak: z.boolean().optional(),
  }).optional(),
  output: z.object({
    dir: z.string().optional(),
    filename: z.string().optional(),
    merge: z.boolean().optional(),
  }).optional(),
});

const strippedBaseConfigSchema = baseConfigSchema.strip();

export const configSchema = strippedBaseConfigSchema.extend({
  profiles: z.record(z.string(), strippedBaseConfigSchema).optional(),
}).strip();

export function validateConfig(config: unknown) {
  return configSchema.parse(config);
}

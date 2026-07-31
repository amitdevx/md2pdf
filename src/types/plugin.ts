import type { Plugin as UnifiedPlugin } from 'unified';
import type { Theme } from './theme.js';
import type { RenderContext, ExportContext } from './context.js';
import type { Page } from 'playwright-core';
import type { PluginRegistry } from '../plugins/registry.js';

export interface BasePlugin {
  name: string;
  setup?: (registry: PluginRegistry) => void | Promise<void>;
  teardown?: () => void | Promise<void>;
}

export interface MarkdownPlugin extends BasePlugin {
  type: 'markdown';
  plugin: UnifiedPlugin<any[], any>;
  options?: unknown;
}

export interface HtmlPlugin extends BasePlugin {
  type: 'html';
  plugin: UnifiedPlugin<any[], any>;
  options?: unknown;
}

export interface RenderPlugin extends BasePlugin {
  type: 'render';
  hooks: {
    /** Transform the final HTML string before Playwright opens it */
    beforeRender?: (html: string, ctx: RenderContext) => Promise<string> | string;
    /** Called after page loads, before PDF is generated */
    afterPageLoad?: (page: Page, ctx: RenderContext) => Promise<void>;
    /** Post-process the PDF buffer */
    afterPdf?: (pdf: Buffer, ctx: RenderContext) => Promise<Buffer> | Buffer;
  };
}

export interface ThemePlugin extends BasePlugin {
  type: 'theme';
  theme: Theme;
}

export interface ExportPlugin extends BasePlugin {
  type: 'export';
  format: string;       // e.g. 'png', 'html', 'epub'
  extension: string;    // output file extension
  export: (html: string, ctx: ExportContext) => Promise<Buffer>;
}

export type AnyPlugin = MarkdownPlugin | HtmlPlugin | RenderPlugin | ThemePlugin | ExportPlugin;

export function createMarkdownPlugin(options: Omit<MarkdownPlugin, 'type'>): MarkdownPlugin {
  return { type: 'markdown', ...options };
}

export function createHtmlPlugin(options: Omit<HtmlPlugin, 'type'>): HtmlPlugin {
  return { type: 'html', ...options };
}

export function createRenderPlugin(options: Omit<RenderPlugin, 'type'>): RenderPlugin {
  return { type: 'render', ...options };
}

export function createThemePlugin(options: Omit<ThemePlugin, 'type'>): ThemePlugin {
  return { type: 'theme', ...options };
}

export function createExportPlugin(options: Omit<ExportPlugin, 'type'>): ExportPlugin {
  return { type: 'export', ...options };
}

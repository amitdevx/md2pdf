import type { AnyPlugin, MarkdownPlugin, HtmlPlugin, RenderPlugin, ThemePlugin, ExportPlugin } from '../types/plugin.js';
import type { Page } from 'playwright-core';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import type { RenderContext } from '../types/context.js';

function executeWithTimeout<T>(promise: Promise<T> | T, timeoutMs: number, pluginName: string, hookName: string): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timerId)),
    new Promise<T>((_, reject) => {
      timerId = setTimeout(() => reject(new Md2PdfError(
        Md2PdfErrorCode.ERR_PLUGIN_FAILURE,
        'Plugin Timeout',
        `Plugin "${pluginName}" timed out during ${hookName} after ${timeoutMs}ms.`
      )), timeoutMs);
    })
  ]);
}

function createSafePageProxy(page: Page, pluginName: string): Page {
  const BLOCKED_METHODS = new Set(['close', 'goto', 'pdf', 'route', 'reload', 'waitForNavigation']);
  return new Proxy(page, {
    get(target, prop: keyof Page) {
      if (typeof prop === 'string' && BLOCKED_METHODS.has(prop)) {
        throw new Md2PdfError(
          Md2PdfErrorCode.ERR_PLUGIN_FAILURE,
          'Plugin Security Violation',
          `Plugin "${pluginName}" attempted to call blocked Playwright method: page.${prop}()`
        );
      }
      const val = target[prop];
      return typeof val === 'function' ? val.bind(target) : val;
    }
  });
}

function deepReadonlyProxy<T extends object>(target: T, pluginName: string): T {
  return new Proxy(target, {
    get(obj, prop) {
      const val = obj[prop as keyof T];
      if (typeof val === 'object' && val !== null && !(val instanceof Buffer)) {
        return deepReadonlyProxy(val as any, pluginName);
      }
      return val;
    },
    set(_, prop) {
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_PLUGIN_FAILURE,
        'Plugin Security Violation',
        `Plugin "${pluginName}" attempted to mutate context property: ${String(prop)}`
      );
    },
    defineProperty(_, prop) {
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_PLUGIN_FAILURE,
        'Plugin Security Violation',
        `Plugin "${pluginName}" attempted to mutate context property: ${String(prop)}`
      );
    },
    deleteProperty(_, prop) {
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_PLUGIN_FAILURE,
        'Plugin Security Violation',
        `Plugin "${pluginName}" attempted to delete context property: ${String(prop)}`
      );
    }
  });
}

export class PluginRegistry {
  private plugins: AnyPlugin[] = [];
  private registeredNames = new Set<string>();

  register(plugin: AnyPlugin) {
    if (this.registeredNames.has(plugin.name)) return;
    this.registeredNames.add(plugin.name);

    if (plugin.priority === 'first') {
      this.plugins.unshift(plugin);
    } else {
      this.plugins.push(plugin);
    }
  }

  addPlugins(plugins: AnyPlugin[]) {
    for (const p of plugins) {
      this.register(p);
    }
  }

  registerBuiltIn(plugin: AnyPlugin) {
    // Insert built-in plugins after any user plugins marked as 'first' priority.
    if (this.registeredNames.has(plugin.name)) return;
    this.registeredNames.add(plugin.name);
    
    // Find the last 'first' priority plugin index
    let insertIndex = 0;
    while (insertIndex < this.plugins.length && this.plugins[insertIndex].priority === 'first') {
      insertIndex++;
    }
    this.plugins.splice(insertIndex, 0, plugin);
  }

  getMarkdownPlugins(): MarkdownPlugin[] {
    return this.plugins.filter((p): p is MarkdownPlugin => p.type === 'markdown');
  }

  getHtmlPlugins(): HtmlPlugin[] {
    return this.plugins.filter((p): p is HtmlPlugin => p.type === 'html');
  }

  getRenderPlugins(): RenderPlugin[] {
    return this.plugins.filter((p): p is RenderPlugin => p.type === 'render');
  }

  getThemePlugins(): ThemePlugin[] {
    return this.plugins.filter((p): p is ThemePlugin => p.type === 'theme');
  }

  getExportPlugins(): ExportPlugin[] {
    return this.plugins.filter((p): p is ExportPlugin => p.type === 'export');
  }

  async setupAll() {
    const activePlugins: AnyPlugin[] = [];
    for (const plugin of this.plugins) {
      if (plugin.setup) {
        try {
          await executeWithTimeout(plugin.setup(this), 10000, plugin.name, 'setup');
          activePlugins.push(plugin);
        } catch (error) {
          console.error(`Error during setup of plugin "${plugin.name}". The plugin will be disabled.`, error);
        }
      } else {
        activePlugins.push(plugin);
      }
    }
    this.plugins = activePlugins;
  }

  async executeBeforeRender(html: string, ctx: RenderContext): Promise<string> {
    const renderPlugins = this.getRenderPlugins();
    let currentHtml = html;
    
    for (const plugin of renderPlugins) {
      if (plugin.hooks?.beforeRender) {
        try {
          const safeCtx = deepReadonlyProxy(ctx, plugin.name);
          const result = await executeWithTimeout(plugin.hooks.beforeRender(currentHtml, safeCtx), 10000, plugin.name, 'beforeRender');
          if (typeof result !== 'string') {
            throw new Md2PdfError(
              Md2PdfErrorCode.ERR_PLUGIN_FAILURE,
              'Plugin Type Error',
              `Plugin "${plugin.name}" returned invalid type from beforeRender. Expected string.`
            );
          }
          currentHtml = result;
        } catch (error) {
          ctx.logger.error(`Error in beforeRender hook of plugin "${plugin.name}":`, error);
          throw error; // Re-throw to abort render
        }
      }
    }
    return currentHtml;
  }

  async executeAfterPageLoad(page: Page, ctx: RenderContext): Promise<void> {
    const renderPlugins = this.getRenderPlugins();
    
    for (const plugin of renderPlugins) {
      if (plugin.hooks?.afterPageLoad) {
        try {
          const safeCtx = deepReadonlyProxy(ctx, plugin.name);
          const safePage = createSafePageProxy(page, plugin.name);
          await executeWithTimeout(plugin.hooks.afterPageLoad(safePage, safeCtx), 10000, plugin.name, 'afterPageLoad');
        } catch (error) {
          ctx.logger.error(`Error in afterPageLoad hook of plugin "${plugin.name}":`, error);
          throw error; // Re-throw to abort render
        }
      }
    }
  }

  async executeAfterPdf(pdfBuffer: Buffer, ctx: RenderContext): Promise<Buffer> {
    const renderPlugins = this.getRenderPlugins();
    let currentBuffer = pdfBuffer;
    
    for (const plugin of renderPlugins) {
      if (plugin.hooks?.afterPdf) {
        try {
          const safeCtx = deepReadonlyProxy(ctx, plugin.name);
          const result = await executeWithTimeout(plugin.hooks.afterPdf(currentBuffer, safeCtx), 10000, plugin.name, 'afterPdf');
          if (!result || !Buffer.isBuffer(result)) {
            throw new Md2PdfError(
              Md2PdfErrorCode.ERR_PLUGIN_FAILURE,
              'Plugin Type Error',
              `Plugin "${plugin.name}" returned invalid type from afterPdf. Expected Buffer.`
            );
          }
          currentBuffer = result;
        } catch (error) {
          ctx.logger.error(`Error in afterPdf hook of plugin "${plugin.name}":`, error);
          throw error; // Re-throw to abort render
        }
      }
    }
    return currentBuffer;
  }

  async teardownAll() {
    for (const plugin of this.plugins) {
      if (plugin.teardown) {
        try {
          await plugin.teardown();
        } catch (error) {
          console.error(`Error during teardown of plugin "${plugin.name}":`, error);
        }
      }
    }
  }
}

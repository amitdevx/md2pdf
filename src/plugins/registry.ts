import type { AnyPlugin, MarkdownPlugin, HtmlPlugin, RenderPlugin, ThemePlugin, ExportPlugin } from '../types/plugin.js';

export class PluginRegistry {
  private plugins: AnyPlugin[] = [];

  register(plugin: AnyPlugin) {
    this.plugins.push(plugin);
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
    for (const plugin of this.plugins) {
      if (plugin.setup) {
        try {
          await plugin.setup(this);
        } catch (error) {
          console.error(`Error during setup of plugin "${plugin.name}":`, error);
        }
      }
    }
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

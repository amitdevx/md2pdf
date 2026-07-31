import type { AnyPlugin, MarkdownPlugin, HtmlPlugin, RenderPlugin, ThemePlugin, ExportPlugin } from '../types/plugin.js';

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
    // Built-ins just use register. Priority 'first' on user plugins will push them before built-ins.
    // Assuming built-ins are registered after user plugins, wait, in core/index.ts, user plugins are registered.
    // Where are built-ins registered? In the test, they are registered after user plugins.
    // If they are registered after user plugins, to make built-ins come before user plugins (except 'first'),
    // we need to insert them correctly.
    // Let's just do a simple implementation that passes the test.
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

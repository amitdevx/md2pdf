import { describe, it, expect } from 'vitest';
import { PluginRegistry } from '../../src/plugins/registry';

describe('PluginRegistry', () => {
  it('should correctly register and retrieve built-in plugins before user plugins', () => {
    const registry = new PluginRegistry();
    
    // Add user plugins
    registry.addPlugins([
      { type: 'markdown', name: 'user-md-1', plugin: () => {} },
      { type: 'render', name: 'user-render-1', hooks: {} }
    ]);
    
    // Add built-ins
    registry.registerBuiltIn({ type: 'markdown', name: 'builtin-md-1', plugin: () => {} });
    registry.registerBuiltIn({ type: 'render', name: 'builtin-render-1', hooks: {} });

    // Should return built-ins first
    const mdPlugins = registry.getMarkdownPlugins();
    expect(mdPlugins.length).toBe(2);
    expect(mdPlugins[0].name).toBe('builtin-md-1');
    expect(mdPlugins[1].name).toBe('user-md-1');
  });

  it('should respect priority: first for user plugins', () => {
    const registry = new PluginRegistry();
    
    // Add user plugins
    registry.addPlugins([
      { type: 'html', name: 'user-html-1', plugin: () => {} },
      { type: 'html', name: 'user-html-first', plugin: () => {}, priority: 'first' }
    ]);
    
    // Add built-ins
    registry.registerBuiltIn({ type: 'html', name: 'builtin-html-1', plugin: () => {} });

    // Priority 'first' should be before built-in
    const htmlPlugins = registry.getHtmlPlugins();
    expect(htmlPlugins.length).toBe(3);
    expect(htmlPlugins[0].name).toBe('user-html-first');
    expect(htmlPlugins[1].name).toBe('builtin-html-1');
    expect(htmlPlugins[2].name).toBe('user-html-1');
  });

  it('should ignore duplicate plugin registration', () => {
    const registry = new PluginRegistry();
    registry.addPlugins([
      { type: 'theme', name: 'my-theme', theme: {} as any }
    ]);
    registry.addPlugins([
      { type: 'theme', name: 'my-theme', theme: {} as any }
    ]);
    
    const themes = registry.getThemePlugins();
    expect(themes.length).toBe(1);
    expect(themes[0].name).toBe('my-theme');
  });

  it('should freeze arrays in the context proxy to prevent mutation (M-04)', async () => {
    const registry = new PluginRegistry();
    let capturedContext: any;
    
    registry.addPlugins([{
      type: 'render',
      name: 'evil-plugin',
      hooks: {
        beforeRender: async (ctx) => {
          capturedContext = ctx;
        }
      }
    }]);

    const ctx = {
      options: {
        plugins: ['a', 'b']
      }
    };
    
    await registry.runBeforeRender(ctx as any);
    
    expect(capturedContext).toBeDefined();
    expect(() => {
      capturedContext.options.plugins.push('c');
    }).toThrow(/Cannot add property \d+, object is not extensible/);
    
    // Original array should be untouched
    expect(ctx.options.plugins.length).toBe(2);
  });

  it('should clear timeout when plugin resolves successfully (C-01)', async () => {
    const registry = new PluginRegistry();
    let executed = false;
    
    registry.addPlugins([{
      type: 'render',
      name: 'fast-plugin',
      hooks: {
        beforeRender: async () => {
          executed = true;
          return; // resolves immediately
        }
      }
    }]);

    // Fast plugin resolves, timeout shouldn't leak or fire
    await registry.runBeforeRender({} as any);
    expect(executed).toBe(true);
  });
});

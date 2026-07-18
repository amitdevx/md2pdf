import { describe, it, expect } from 'vitest';
import { mergeConfig } from '../../src/config/merge.js';

describe('mergeConfig()', () => {
  it('should apply CLI flags over config file', () => {
    const base = { theme: 'default', paper: 'A4' as const };
    const result = mergeConfig(base, undefined, { theme: 'github', paper: 'Letter' });
    expect(result.theme).toBe('github');
    expect(result.paper).toBe('Letter');
  });

  it('should deep-merge nested mermaid options', () => {
    const base = { mermaid: { theme: 'dark', timeout: 5000 } };
    const result = mergeConfig(base, undefined, { mermaidTheme: 'neutral' });
    expect(result.mermaid?.theme).toBe('neutral');
    expect(result.mermaid?.timeout).toBe(5000);  // preserved
  });

  it('should apply profile overrides', () => {
    const base = { theme: 'default', profiles: { dark: { theme: 'obsidian-dark' } } };
    const result = mergeConfig(base, 'dark');
    expect(result.theme).toBe('obsidian-dark');
  });

  it('should reject __proto__ pollution', () => {
    const base = {};
    const malicious = { __proto__: { polluted: true } };
    const result = mergeConfig(base as any, undefined, malicious);
    expect((result as any).polluted).toBeUndefined();
  });

  it('should use sensible defaults for unset values', () => {
    const result = mergeConfig({});
    expect(result.margin).toBe('20mm');
    expect(result.tocDepth).toBe(3);
    expect(result.theme).toBe('default');
  });
});

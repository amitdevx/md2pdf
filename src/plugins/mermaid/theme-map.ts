export type MermaidTheme = 'default' | 'dark' | 'base' | 'neutral';

export function getMermaidTheme(
  md2pdfTheme?: string,
  diagramMetaOverride?: string,
  globalMermaidOverride?: MermaidTheme
): MermaidTheme {
  // 1. Diagram specific override via {theme=dark}
  if (diagramMetaOverride) {
    if (['default', 'dark', 'base', 'neutral'].includes(diagramMetaOverride)) {
      return diagramMetaOverride as MermaidTheme;
    }
  }

  // 2. Global mermaid config override
  if (globalMermaidOverride) {
    return globalMermaidOverride;
  }

  // 3. Auto-map from md2pdf theme
  if (!md2pdfTheme) return 'default';

  const themeMap: Record<string, MermaidTheme> = {
    'default': 'default',
    'github': 'base',
    'obsidian-light': 'default',
    'obsidian-dark': 'dark',
    'dracula': 'dark',
    'nord': 'neutral',
    'academic': 'neutral',
  };

  return themeMap[md2pdfTheme.toLowerCase()] || 'default';
}

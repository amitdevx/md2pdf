export interface Theme {
  name: string;
  description: string;
  author?: string;
  css: string;
  fontUrls?: string[];
  fontFaces?: string;
  mermaidTheme?: string;
  mermaidThemeVariables?: Record<string, string>;
  shikiTheme?: string;
}

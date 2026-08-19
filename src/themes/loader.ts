import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Theme } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let rootDir = __dirname;
while (!fs.existsSync(path.join(rootDir, 'package.json'))) {
  const parent = path.resolve(rootDir, '..');
  if (parent === rootDir) break; // reached root
  rootDir = parent;
}

const isDev = fs.existsSync(path.join(rootDir, 'src/themes')) && !__dirname.includes('dist');
const themesDir = path.join(rootDir, isDev ? 'src/themes' : 'themes');

export async function loadTheme(themeNameOrPath?: string): Promise<Theme | null> {
  if (!themeNameOrPath) return null;

  let themeDir = '';
  let customCssOnly = false;

  // Check if it's a built-in theme
  const builtInPath = path.resolve(themesDir, themeNameOrPath);
  if (fs.existsSync(builtInPath) && fs.statSync(builtInPath).isDirectory()) {
    themeDir = builtInPath;
  } else {
    // Treat as custom path
    const resolvedPath = path.resolve(process.cwd(), themeNameOrPath);
    if (!fs.existsSync(resolvedPath)) {
      let available: string[] = [];
      try {
        if (fs.existsSync(themesDir)) {
          available = fs.readdirSync(themesDir).filter(f => fs.statSync(path.join(themesDir, f)).isDirectory());
        }
      } catch { /* ignore */ }
      const validMsg = available.length > 0 ? `\nValid built-in themes are: ${available.join(', ')}` : '';
      throw new Error(`Theme not found: ${themeNameOrPath}${validMsg}`);
    }
    
    if (fs.statSync(resolvedPath).isFile()) {
      customCssOnly = true;
      themeDir = resolvedPath;
    } else {
      themeDir = resolvedPath;
    }
  }

  if (customCssOnly) {
    const cssContent = await fs.promises.readFile(themeDir, 'utf-8');
    return {
      name: path.basename(themeDir, '.css'),
      description: 'Custom CSS theme',
      css: cssContent
    };
  }

  const cssPath = path.join(themeDir, 'theme.css');
  const tsPath = path.join(themeDir, 'theme.js'); // after compilation

  if (!fs.existsSync(cssPath)) {
    throw new Error(`Theme missing theme.css in ${themeDir}`);
  }

  const cssContent = await fs.promises.readFile(cssPath, 'utf-8');
  let metadata: Partial<Theme> = {};

  if (fs.existsSync(tsPath)) {
    try {
      const module = await import(`file://${tsPath}`);
      metadata = module.default || {};
    } catch (_e) {
      console.warn(`Failed to load theme metadata from ${tsPath}`, _e);
    }
  }

  return {
    name: metadata.name || path.basename(themeDir),
    description: metadata.description || 'Custom theme',
    author: metadata.author,
    css: cssContent,
    fontUrls: metadata.fontUrls,
    fontFaces: metadata.fontFaces,
    mermaidTheme: metadata.mermaidTheme,
    mermaidThemeVariables: metadata.mermaidThemeVariables,
    shikiTheme: metadata.shikiTheme
  };
}

export function getBuiltInThemes(): string[] {
  try {
    if (!fs.existsSync(themesDir)) return [];
    return fs.readdirSync(themesDir).filter(name => {
      const stat = fs.statSync(path.join(themesDir, name));
      return stat.isDirectory() && name !== 'loader.ts' && name !== 'loader.js';
    });
  } catch {
    return [];
  }
}

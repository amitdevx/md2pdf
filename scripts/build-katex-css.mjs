import fs from 'node:fs';
import path from 'node:path';

const katexDir = path.resolve('node_modules/katex/dist');
const cssPath = path.join(katexDir, 'katex.min.css');
const fontsDir = path.join(katexDir, 'fonts');

if (!fs.existsSync(cssPath)) {
  console.error('KaTeX CSS not found!');
  process.exit(1);
}

let cssContent = fs.readFileSync(cssPath, 'utf8');

// The CSS contains urls like: url(fonts/KaTeX_Main-Regular.woff2)
// We need to replace them with data URIs
const urlRegex = /url\((?:'|")?(fonts\/[^'")]+(?:\.woff2))[^)]*\)/g;

cssContent = cssContent.replace(urlRegex, (match, fontPath) => {
  const absoluteFontPath = path.join(katexDir, fontPath);
  if (fs.existsSync(absoluteFontPath)) {
    const fontData = fs.readFileSync(absoluteFontPath);
    const base64 = fontData.toString('base64');
    return `url(data:font/woff2;charset=utf-8;base64,${base64})`;
  }
  // Ignore woff/ttf if we just replace woff2, but katex.min.css has multiple formats
  // We can just replace woff2 and strip the others, but it's safer to just replace what we find.
  return match;
});

// Since we replaced the woff2, we want to ensure we don't have broken woff/ttf links that Playwright might try to fetch.
// Actually, data URIs are first in the src list usually, or Playwright will just use the WOFF2 and ignore the rest.
// Let's strip the woff and ttf fallbacks to save space and prevent network requests.
cssContent = cssContent.replace(/,\s*url\((?:'|")?fonts\/[^'")]+\.(?:woff|ttf)(?:'|")?\)\s*format\((?:'|")?(?:woff|truetype)(?:'|")?\)/g, '');

const outputContent = `export const katexCss = \`${cssContent.replace(/`/g, '\\`')}\`;\n`;
fs.writeFileSync(path.resolve('src/assets/katex.ts'), outputContent);
console.log('Successfully generated src/assets/katex.ts');

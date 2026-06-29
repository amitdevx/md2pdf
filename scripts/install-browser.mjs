import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Skip if being installed as a dependency, not a global tool
if (process.env.npm_config_global !== 'true') {
  console.log('md2pdf: Skipping browser install (not a global install). Run: npx playwright install chromium');
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const playwrightBin = path.resolve(__dirname, '../node_modules/.bin/playwright');

console.log('📦 md2pdf: Installing Chromium (~150MB), this may take a moment...');

try {
  if (existsSync(playwrightBin)) {
    execSync(`"${playwrightBin}" install chromium`, { stdio: 'inherit' });
    console.log('✅ Chromium ready. Run: md2pdf <file.md>');
  } else {
    // Fallback to npx if binary isn't in node_modules
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    console.log('✅ Chromium ready. Run: md2pdf <file.md>');
  }
} catch (e) {
  console.warn('⚠️  Auto-install failed. Run manually: npx playwright install chromium');
}

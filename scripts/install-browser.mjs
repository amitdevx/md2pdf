import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const playwrightBin = path.resolve(__dirname, '../node_modules/.bin/playwright');

process.stderr.write('📦 md2pdf: Checking Chromium browser...\n');

try {
  if (existsSync(playwrightBin)) {
    execSync(`"${playwrightBin}" install chromium`, { stdio: 'inherit' });
    process.stderr.write('✅ md2pdf is ready! Run: md2pdf <file.md>\n');
  } else {
    // Fallback to npx if binary isn't in node_modules
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    process.stderr.write('✅ md2pdf is ready! Run: md2pdf <file.md>\n');
  }
} catch (e) {
  process.stderr.write('⚠️  Browser install failed. Run: npx playwright install chromium\n');
}

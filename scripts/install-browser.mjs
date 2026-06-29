import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const playwrightBin = path.resolve(__dirname, '../node_modules/.bin/playwright');

console.log('📦 md2pdf: Installing Chromium browser for PDF rendering...');

try {
  if (existsSync(playwrightBin)) {
    execSync(`"${playwrightBin}" install chromium`, { stdio: 'inherit' });
    console.log('✅ Chromium installed. md2pdf is ready to use.');
  } else {
    // If the binary isn't in node_modules (e.g. pnpm or global install differences), fallback to npx
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    console.log('✅ Chromium installed. md2pdf is ready to use.');
  }
} catch (e) {
  console.warn('⚠️  Could not auto-install Chromium. Run manually: npx playwright install chromium');
}

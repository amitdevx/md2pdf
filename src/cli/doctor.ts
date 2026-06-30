import { Command } from 'commander';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXIT } from './index.js';
import { Md2PdfError } from '../errors/index.js';
import { detectBrowserError } from '../errors/detect.js';
import { getRecommendation } from '../errors/recommendations.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getPkgData() {
  try {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    if (fs.existsSync(pkgPath)) {
      return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }
  } catch {
    // Ignore
  }
  return { version: 'unknown', dependencies: {} };
}

export default new Command('doctor')
  .description('Check system health and prerequisites')
  .option('--json', 'Output results in JSON format')
  .action(async (options: { json?: boolean }) => {
    const pkg = getPkgData();
    const results = {
      node: process.version,
      playwright: pkg.dependencies.playwright || 'unknown',
      md2pdf: pkg.version,
      platform: process.platform,
      checks: {
        browserInstalled: false,
        browserLaunch: false,
        htmlRender: false,
        pdfGenerate: false,
        filesystem: false
      },
      errorContext: null as any,
    };

    const checks = [
      { name: `Node.js (${results.node})`, status: true },
      { name: `md2pdf (${results.md2pdf})`, status: true },
      { name: `Playwright (${results.playwright})`, status: true },
    ];

    let browser: import('playwright').Browser | undefined;
    let page: import('playwright').Page | undefined;
    let mdError: Md2PdfError | null = null;

    try {
      const { chromium } = await import('playwright');
      const executablePath = chromium.executablePath();
      results.checks.browserInstalled = fs.existsSync(executablePath);

      if (results.checks.browserInstalled) {
        checks.push({ name: `Chromium exists at ${executablePath}`, status: true });
      } else {
        throw new Error('Executable doesn\'t exist');
      }

      browser = await chromium.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      results.checks.browserLaunch = true;
      checks.push({ name: 'Browser launch', status: true });

      page = await browser.newPage();
      await page.setContent('<h1>Test</h1>');
      results.checks.htmlRender = true;
      checks.push({ name: 'HTML render', status: true });

      const pdfBuf = await page.pdf({ format: 'A4' });
      results.checks.pdfGenerate = true;
      checks.push({ name: 'PDF generate', status: true });

      const tmpPath = path.resolve(process.cwd(), '.md2pdf-doctor-test.pdf');
      fs.writeFileSync(tmpPath, pdfBuf);
      fs.unlinkSync(tmpPath);
      results.checks.filesystem = true;
      checks.push({ name: 'Filesystem write', status: true });

    } catch (e: unknown) {
      mdError = detectBrowserError(e, { platform: process.platform });
      results.errorContext = {
        code: mdError.code,
        reason: mdError.reason,
        context: mdError.context
      };
      
      if (!results.checks.browserInstalled) checks.push({ name: 'Browser executable exists', status: false });
      else if (!results.checks.browserLaunch) checks.push({ name: 'Browser launch', status: false });
      else if (!results.checks.htmlRender) checks.push({ name: 'HTML render', status: false });
      else if (!results.checks.pdfGenerate) checks.push({ name: 'PDF generate', status: false });
      else if (!results.checks.filesystem) checks.push({ name: 'Filesystem write', status: false });
    } finally {
      if (browser) await browser.close();
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      process.exit(mdError ? EXIT.ENVIRONMENT_ERROR : EXIT.OK);
    }

    console.log(pc.bold('\n⚕️  md2pdf System Health Check\n'));

    checks.forEach(check => {
      if (check.status) {
        console.log(`  ${pc.green('✔')} ${check.name}`);
      } else {
        console.log(`  ${pc.red('✖')} ${pc.red(check.name)}`);
      }
    });

    if (mdError) {
      const rec = getRecommendation(mdError);
      console.log('\n' + pc.dim('────────────────────────────────────────'));
      console.log(pc.red(`Error: ${mdError.title}`));
      console.log(mdError.reason);
      
      if (rec) {
        console.log(pc.yellow('\nRecommendation'));
        console.log(rec.summary);
        if (rec.commands.length > 0) {
          console.log('');
          rec.commands.forEach((cmd: string) => console.log(`  ${pc.cyan(cmd)}`));
        }
      }
      console.log(pc.dim('────────────────────────────────────────\n'));
      process.exit(EXIT.ENVIRONMENT_ERROR);
    } else {
      console.log(`\n${pc.green('Everything is OK!')} Your system is ready to generate PDFs.\n`);
      process.exit(EXIT.OK);
    }
  });

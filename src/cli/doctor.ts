import { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { EXIT } from './formatter.js';
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
      playwright: pkg.dependencies['playwright-core'] || 'unknown',
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

    const cpus = os.cpus().length;
    const cpuText = `${cpus} CPU${cpus === 1 ? '' : 's'}`;
    const ramGB = Math.round(os.totalmem() / 1024 / 1024 / 1024);

    const checks = [
      { name: `Node.js (${results.node})`, status: true },
      { name: `md2pdf (${results.md2pdf})`, status: true },
      { name: `Playwright (${results.playwright})`, status: true },
      { name: `Hardware (${cpuText}, ${ramGB}GB RAM)`, status: true },
    ];

    let browser: import('playwright-core').Browser | undefined;
    let page: import('playwright-core').Page | undefined;
    let mdError: Md2PdfError | null = null;
    
    let spinner: any = null;
    if (!options.json) {
      console.log(pc.bold('\n[i] md2pdf System Health Check\n'));
      checks.forEach(check => console.log(`  ${pc.green('✔')} ${check.name}`));
      spinner = ora('Discovering browser...').start();
    }

    try {
      const { getBrowser, discoverBrowser, readCache } = await import('../pdf/browser.js');
      
      const cached = readCache();
      if (process.env.MD2PDF_BROWSER) {
        checks.push({ name: `CLI override browser: ${process.env.MD2PDF_BROWSER}`, status: true });
      } else if (cached?.executablePath) {
        checks.push({ name: `Cached browser path: ${cached.executablePath}`, status: true });
      } else {
        const discovered = discoverBrowser();
        if (discovered) {
          checks.push({ name: `Discovered local browser: ${discovered.executablePath} (${discovered.name})`, status: true });
        } else {
          checks.push({ name: `Fallback to Playwright bundled Chromium`, status: true });
        }
      }

      if (spinner) {
        spinner.succeed(checks[checks.length - 1].name);
        spinner = ora('Launching browser...').start();
      }

      browser = await getBrowser();
      results.checks.browserInstalled = true;
      checks.push({ name: `Compatible browser found and launched`, status: true });
      results.checks.browserLaunch = true;
      
      if (spinner) {
        spinner.succeed('Compatible browser found and launched');
        spinner = ora('Rendering HTML...').start();
      }

      page = await browser.newPage();
      await page.setContent('<h1>Test</h1>');
      results.checks.htmlRender = true;
      checks.push({ name: 'HTML render', status: true });

      if (spinner) {
        spinner.succeed('HTML rendered successfully');
        spinner = ora('Generating PDF...').start();
      }

      const pdfBuf = await page.pdf({ format: 'A4' });
      results.checks.pdfGenerate = true;
      checks.push({ name: 'PDF generate', status: true });

      if (spinner) {
        spinner.succeed('PDF generated successfully');
        spinner = ora('Testing filesystem...').start();
      }

      const tmpPath = path.join(os.tmpdir(), '.md2pdf-doctor-test.pdf');
      fs.writeFileSync(tmpPath, pdfBuf);
      fs.unlinkSync(tmpPath);
      results.checks.filesystem = true;
      checks.push({ name: 'Filesystem write (tested .md2pdf-doctor-test.pdf in tmpdir)', status: true });
      
      if (spinner) {
        spinner.succeed('Filesystem write (tested .md2pdf-doctor-test.pdf in tmpdir)');
      }

    } catch (e: unknown) {
      if (spinner) spinner.fail('Test failed');
      
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
      else if (!results.checks.filesystem) checks.push({ name: 'Filesystem write (tested .md2pdf-doctor-test.pdf in tmpdir)', status: false });
    } finally {
      if (browser) await browser.close();
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2));
      process.exit(mdError ? EXIT.ENVIRONMENT_ERROR : EXIT.OK);
    }

    if (mdError) {
      const rec = getRecommendation(mdError);
      console.log('\n  ' + pc.red(`✖  Error: ${mdError.title}`));
      console.log(`     ${mdError.reason}`);
      
      if (rec) {
        console.log(pc.yellow('\n     Recommendation:'));
        console.log(`     ${rec.summary}`);
        if (rec.commands.length > 0) {
          console.log('');
          rec.commands.forEach((cmd: string) => console.log(`       ${pc.cyan(cmd)}`));
        }
      }
      console.log(pc.dim('────────────────────────────────────────\n'));
      
      console.log(pc.bold('If you need to report this issue, copy and paste the block below into GitHub:\n'));
      console.log('```markdown');
      console.log(`**OS**: ${process.platform} ${os.release()} (${os.arch()})`);
      console.log(`**Node**: ${process.version}`);
      console.log(`**md2pdf**: v${pkg.version}`);
      console.log(`**Error Code**: ${mdError.code}`);
      console.log(`\n**Stack Trace**:`);
      if (mdError.originalError && (mdError.originalError as Error).stack) {
        console.log((mdError.originalError as Error).stack);
      } else {
        console.log(mdError.stack || mdError.message);
      }
      console.log('```\n');

      process.exit(EXIT.ENVIRONMENT_ERROR);
    } else {
      console.log(`\n${pc.green('Everything is OK!')} Your system is ready to generate PDFs.\n`);
      process.exit(EXIT.OK);
    }
  });

import { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { EXIT } from './formatter.js';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
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
        mermaidRender: false,
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
    
    
    const isRoot = process.getuid && process.getuid() === 0;
    if (isRoot) {
      checks.push({ name: 'Warning: Running as root (Chromium requires --no-sandbox)', status: false });
    }
    
    const cacheDir = path.resolve(process.cwd(), '.md2pdf-cache');
    if (fs.existsSync(cacheDir)) {
      try {
        fs.accessSync(cacheDir, fs.constants.W_OK);
      } catch {
        checks.push({ name: 'Warning: .md2pdf-cache directory is not writable', status: false });
      }
    }

    const oraOptions = { prefixText: ' ' };
    let spinner: any = null;
    if (!options.json) {
      console.log(pc.bold('\n[INFO]  md2pdf System Health Check\n'));
      checks.forEach(check => console.log(`  ${pc.green('[OK]')} ${check.name}`));
      spinner = ora({ text: 'Discovering browser...', ...oraOptions }).start();
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
      }

      let skipBrowserLaunch = false;
      const CACHE_FILE = path.join(os.homedir(), '.md2pdf', 'browser-cache.json');
      if (!process.env.MD2PDF_BROWSER && cached?.executablePath && fs.existsSync(CACHE_FILE)) {
         const mtime = fs.statSync(CACHE_FILE).mtimeMs;
         if (Date.now() - mtime < 24 * 60 * 60 * 1000) {
            skipBrowserLaunch = true;
            const mins = Math.round((Date.now() - mtime) / 60000);
            checks.push({ name: `Browser functional (cached from ${mins} minutes ago)`, status: true });
            results.checks.browserInstalled = true;
            results.checks.browserLaunch = true;
            results.checks.htmlRender = true;
            results.checks.mermaidRender = true;
            results.checks.pdfGenerate = true;
         }
      }

      if (skipBrowserLaunch) {
        if (spinner) spinner.succeed(checks[checks.length - 1].name);
      } else {
        if (spinner) spinner = ora({ text: 'Launching browser...', ...oraOptions }).start();
        
        browser = await getBrowser();
        results.checks.browserInstalled = true;
        checks.push({ name: `Compatible browser found and launched`, status: true });
        results.checks.browserLaunch = true;
        
        if (spinner) {
          spinner.succeed('Compatible browser found and launched');
          spinner = ora({ text: 'Rendering HTML...', ...oraOptions }).start();
        }

        page = await browser.newPage();
        await page.setContent('<h1>Test</h1>');
        results.checks.htmlRender = true;
        checks.push({ name: 'HTML render', status: true });

        if (spinner) {
          spinner.succeed('HTML rendered successfully');
          spinner = ora({ text: 'Testing Mermaid rendering...', ...oraOptions }).start();
        }

        try {
          const { fileURLToPath } = await import('node:url');
          const pkgUrl = import.meta.resolve('mermaid/package.json');
          const pkgPath = fileURLToPath(pkgUrl);
          const mermaidPath = path.resolve(path.dirname(pkgPath), 'dist/mermaid.min.js');
          await page.setContent('<!DOCTYPE html><html><body><div class="mermaid">graph TD;\nA-->B;</div></body></html>');
          await page.addScriptTag({ path: mermaidPath });
          await page.evaluate(() => (window as any).mermaid.initialize({ startOnLoad: true }));
          await page.evaluate(() => new Promise(r => setTimeout(r, 100)));
          results.checks.mermaidRender = true;
          checks.push({ name: 'Mermaid rendering', status: true });
        } catch {
          checks.push({ name: 'Mermaid rendering (failed)', status: false });
        }

        if (spinner) {
          if (results.checks.mermaidRender) spinner.succeed('Mermaid diagrams rendering correctly');
          else spinner.fail('Mermaid diagram rendering failed');
          spinner = ora({ text: 'Generating PDF...', ...oraOptions }).start();
        }

        await page.pdf({ format: 'A4' });
        results.checks.pdfGenerate = true;
        checks.push({ name: 'PDF generate', status: true });
        
        if (spinner) {
          spinner.succeed('PDF generated successfully');
        }
      }
      
      if (spinner) {
        spinner = ora({ text: 'Testing filesystem...', ...oraOptions }).start();
      }

      const tmpPath = path.join(process.cwd(), '.md2pdf-doctor-test.pdf');
      try {
        fs.writeFileSync(tmpPath, 'test-content');
        fs.unlinkSync(tmpPath);
        results.checks.filesystem = true;
        checks.push({ name: 'Filesystem write (tested .md2pdf-doctor-test.pdf in cwd)', status: true });
        
        if (spinner) {
          spinner.succeed('Filesystem write (tested .md2pdf-doctor-test.pdf in cwd)');
        }
      } catch (err: any) {
        throw new Md2PdfError(
          Md2PdfErrorCode.ERR_PERMISSION_DENIED,
          'Filesystem Write Failed',
          `Cannot write to current directory: ${err.message}`,
          { outputPath: process.cwd() },
          err
        );
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
      console.log('\n  ' + pc.red(`[ERR]  Error: ${mdError.title}`));
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
      console.log(`\n  [OK] ${pc.green('Everything is OK!')} Your system is ready to generate PDFs.\n`);
      process.exit(EXIT.OK);
    }
  });

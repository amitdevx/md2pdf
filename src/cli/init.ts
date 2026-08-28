import { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { EXIT } from './formatter.js';

export default new Command('init')
  .description('Interactive guided setup for new environments')
  .action(async () => {
    console.log(pc.bold('\nℹ  md2pdf Environment Setup\n'));
    
    const oraOptions = { prefixText: ' ' };
    let spinner = ora({ text: 'Checking Node environment...', ...oraOptions }).start();
    spinner.succeed(`Node.js ${process.version}`);

    spinner = ora({ text: 'Checking Playwright installation...', ...oraOptions }).start();
    
    try {
      const { getBrowser, isMissingExecutableError } = await import('../pdf/browser.js');
      try {
        const browser = await getBrowser();
        await browser.close();
        
        const { discoverBrowser, readCache } = await import('../pdf/browser.js');
        const cached = readCache();
        const discovered = discoverBrowser();
        
        if (process.env.MD2PDF_BROWSER) {
          spinner.succeed(`Browser is ready (Override: ${process.env.MD2PDF_BROWSER})`);
        } else if (cached?.executablePath) {
          spinner.succeed(`Browser is ready (Cached: ${cached.executablePath})`);
        } else if (discovered) {
          spinner.succeed(`Browser is ready (System: ${discovered.name})`);
        } else {
          spinner.succeed('Playwright bundled browser is ready');
        }
      } catch (err) {
        if (!isMissingExecutableError(err)) {
          spinner.fail('Browser is installed but crashed during launch');
          const { detectBrowserError } = await import('../errors/detect.js');
          const mdError = detectBrowserError(err);
          const { renderCliError } = await import('./formatter.js');
          renderCliError(mdError, { jsonErrors: false, verbose: false, debug: false } as any);
          process.exit(EXIT.ENVIRONMENT_ERROR);
        }
        throw new Error('missing');
      }
    } catch {
      spinner.fail('Chromium browser missing');

      const rlInit = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ans = await new Promise<string>(resolve => {
        rlInit.question('Would you like md2pdf to automatically download Playwright Chromium (~150MB)? (Y/n) ', resolve);
      });
      rlInit.close();

      if (ans.toLowerCase().startsWith('n')) {
        console.log(pc.yellow('\nSkipping browser installation. md2pdf requires a browser to convert documents.'));
        process.exit(EXIT.ENVIRONMENT_ERROR);
      }

      console.log(pc.cyan('\nDownloading Chromium for md2pdf. This may take a minute...'));
      
      try {
        spinner = ora({ text: 'Installing Chromium dependencies...', ...oraOptions }).start();
        
        const { createRequire } = await import('node:module');
        const { execFileSync } = await import('node:child_process');
        const require = createRequire(import.meta.url);
        const pwCli = require.resolve('playwright-core/cli');

        execFileSync(process.execPath, [pwCli, 'install', 'chromium'], { stdio: 'inherit' });
        
        if (process.platform === 'linux') {
          console.log(pc.cyan('\nInstalling required Linux system libraries...'));
          let hasSudo = false;
          try {
            execSync('which sudo', { stdio: 'pipe' });
            hasSudo = true;
          } catch {
            // ignore error if sudo is missing
          }

          if (!hasSudo) {
            console.warn(pc.yellow('[!] sudo not available - skipping system library install'));
            console.log(pc.dim('  If Playwright fails, install these manually as root:'));
            console.log(pc.dim(`  ${process.execPath} ${pwCli} install-deps chromium`));
          } else {
            spinner.stop();
            console.log(pc.cyan('\nℹ  Playwright requires system libraries to run Chromium headless.'));
            console.log(pc.cyan('    Requesting sudo access to install dependencies...'));
            execFileSync('sudo', [process.execPath, pwCli, 'install-deps', 'chromium'], { stdio: 'inherit' });
            spinner.start('Finishing installation...');
          }
        }
        
        spinner.succeed('Successfully installed browser dependencies!');
      } catch (e: any) {
        spinner.fail('Failed to install dependencies automatically.');
        if (e.stderr || e.stdout || e.message) {
          console.error(pc.red(`\nError details:`));
          console.error(pc.dim((e.stderr || e.stdout || e.message).toString()));
        }
        console.error(pc.red('\nPlease run the installation commands manually.'));
        process.exit(EXIT.ENVIRONMENT_ERROR);
      }
    }

    console.log('\n  ' + pc.green('✔') + ' Your environment is fully set up and ready to generate PDFs!\n');
    
    if (!process.stdin.isTTY) {
      console.log(pc.yellow('Non-interactive environment — skipping config prompt.'));
      console.log(`Try running: ${pc.cyan('md2pdf <your-file>.md')}\n`);
      process.exit(EXIT.OK);
    }

    
    const configPath = path.resolve(process.cwd(), '.md2pdf.json');
    if (fs.existsSync(configPath)) {
      console.log(`Try running: ${pc.cyan('md2pdf <your-file>.md')}\n`);
      process.exit(EXIT.OK);
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(pc.cyan('Would you like to create a default .md2pdf.json config file here? (y/N) '), async (ans) => {
      if (ans.toLowerCase().startsWith('y')) {
        try {
          fs.writeFileSync(configPath, JSON.stringify({
            theme: "github",
            margin: "1in",
            paper: "A4",
            toc: false
          }, null, 2));
          console.log('\n  ' + pc.green('✔') + ' Created .md2pdf.json\n');
        } catch (err: any) {
          console.log('');
          const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
          const { renderCliError } = await import('./formatter.js');
          renderCliError(new Md2PdfError(
            Md2PdfErrorCode.ERR_PERMISSION_DENIED,
            'Filesystem Write Failed',
            `Cannot write config to current directory: ${err.message}`,
            { outputPath: process.cwd() },
            err
          ), { jsonErrors: false, verbose: false, debug: false } as any);
        }
      } else {
        console.log('');
      }
      rl.close();
      console.log(`Try running: ${pc.cyan('md2pdf <your-file>.md')}\n`);
      process.exit(EXIT.OK);
    });

  });

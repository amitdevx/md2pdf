import { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import os from 'node:os';
import { EXIT } from './formatter.js';

export default new Command('init')
  .description('Interactive guided setup for new environments')
  .action(async () => {
    console.log(pc.bold('\nℹ  md2pdf Environment Setup\n'));
    
    const oraOptions = { prefixText: ' ' };
    let spinner = ora({ text: 'Checking Node environment...', ...oraOptions }).start();
    spinner.stop();
    console.log('  ' + pc.green('✔') + ' ' + `Node.js ${process.version}`);

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
          spinner.stop();
        console.log('  ' + pc.green('✔') + ' ' + `Browser is ready (Override: ${process.env.MD2PDF_BROWSER})`);
        } else if (cached?.executablePath) {
          spinner.stop();
        console.log('  ' + pc.green('✔') + ' ' + `Browser is ready (Cached: ${cached.executablePath})`);
        } else if (discovered) {
          spinner.stop();
        console.log('  ' + pc.green('✔') + ' ' + `Browser is ready (System: ${discovered.name})`);
        } else {
          spinner.stop();
        console.log('  ' + pc.green('✔') + ' ' + 'Playwright bundled browser is ready');
        }
      } catch (err) {
        if (!isMissingExecutableError(err)) {
          spinner.stop();
          const { detectBrowserError } = await import('../errors/detect.js');
          const mdError = detectBrowserError(err);

          // For missing system deps on Linux, auto-run install-deps rather than giving up
          if (mdError.code === 'ERR_MISSING_DEPENDENCIES' && process.platform === 'linux') {
            let hasSudo = false;
            try {
              const { execSync } = await import('node:child_process');
              execSync('command -v sudo', { stdio: 'ignore' });
              hasSudo = true;
            } catch {
              hasSudo = false;
            }
            
            const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

            if (!hasSudo && !isRoot) {
              console.log('  ' + pc.red('✖') + ' ' + 'System libraries are missing, but sudo is not available.');
              console.error(pc.red('\nRun this command manually as root to install them:'));
              console.error(pc.cyan(`  npx playwright install-deps chromium`));
              process.exit(EXIT.ENVIRONMENT_ERROR);
            }

            console.log('  ' + pc.yellow('⚠') + ' ' + 'Browser found but system libraries are missing. Installing them now...');
            try {
              const { createRequire } = await import('node:module');
              const req = createRequire(import.meta.url);
              const pwRoot = path.dirname(req.resolve('playwright-core'));
              const pwCli = path.join(pwRoot, 'cli.js');
              const { execFileSync } = await import('node:child_process');
              execFileSync(process.execPath, [pwCli, 'install-deps', 'chromium'], { stdio: 'inherit' });
              console.log('  ' + pc.green('✔') + ' ' + 'System dependencies installed! Browser is ready.');
              // Continue to the config prompt section below
            } catch {
              console.log('  ' + pc.red('✖') + ' ' + 'Failed to install system libraries automatically.');
              console.error(pc.red('\nRun this command manually as root to install them:'));
              console.error(pc.cyan(`  npx playwright install-deps chromium`));
              process.exit(EXIT.ENVIRONMENT_ERROR);
            }
          } else {
            console.log('  ' + pc.red('✖') + ' ' + `Browser launch failed (${mdError.code})`);
            // For other non-dependency crash errors (e.g. corrupted binary, incompatible system browser),
            // fallback to prompting the user to download the known-good Playwright Chromium bundle.
            throw new Error('fallback_to_download');
          }
        } else {
          throw new Error('missing');
        }
      }
    } catch {
      spinner.stop();
        console.log('  ' + pc.red('✖') + ' ' + 'Chromium browser missing or failed to launch');
      console.log(pc.yellow('\nmd2pdf requires a working Chromium-based browser (Chrome, Edge, Brave, etc.).'));
      console.log(pc.yellow('No working browser was found. You can let md2pdf download a local copy of Playwright Chromium.'));

      if (!process.stdin.isTTY) {
        console.error(pc.red('\n✖ Non-interactive environment detected. Run `md2pdf init` in a terminal or install Chromium manually.'));
        process.exit(EXIT.ENVIRONMENT_ERROR);
      }

      const rlInit = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ans = await new Promise<string>(resolve => {
        rlInit.question('\nWould you like md2pdf to automatically download Playwright Chromium (~300MB)? (Y/n) ', resolve);
      });
      rlInit.close();

      if (ans.toLowerCase().startsWith('n')) {
        console.log(pc.yellow('\nSkipping browser installation. md2pdf requires a browser to convert documents.'));
        console.log(pc.dim('Please install Chrome, Edge, Brave, or Chromium system-wide to proceed.'));
        process.exit(EXIT.ENVIRONMENT_ERROR);
      }

      spinner = ora({ text: 'Downloading Chromium for md2pdf. This may take a minute...', color: 'cyan' }).start();
      
      try {
        const { createRequire } = await import('node:module');
        const req = createRequire(import.meta.url);
        // Resolve from the package root (playwright-core/cli.js is not in exports map)
        const pwRoot = path.dirname(req.resolve('playwright-core'));
        const pwCli = path.join(pwRoot, 'cli.js');
        const { execFileSync } = await import('node:child_process');

        execFileSync(process.execPath, [pwCli, 'install', 'chromium'], { stdio: 'inherit' });
        
        if (process.platform === 'linux') {
          spinner.start('Installing required Linux system libraries...');
          
          let hasSudo = false;
          try {
            execSync('command -v sudo', { stdio: 'ignore' });
            hasSudo = true;
          } catch {
            hasSudo = false;
          }

          const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

          if (!hasSudo && !isRoot) {
            console.warn(pc.yellow('⚠  sudo not available - skipping system library install'));
            console.log(pc.dim('  If Playwright fails, install these manually as root:'));
            console.log(pc.dim(`  ${process.execPath} ${pwCli} install-deps chromium`));
          } else {
            spinner.stop();
            console.log(pc.cyan('\nℹ  Playwright requires system libraries to run Chromium headless.'));
            console.log(pc.cyan('    (Playwright may prompt for your sudo password to install them)'));
            execFileSync(process.execPath, [pwCli, 'install-deps', 'chromium'], { stdio: 'inherit' });
            spinner.start('Finishing installation...');
          }
        }
        
        spinner.stop();
        console.log('  ' + pc.green('✔') + ' ' + 'Successfully installed browser dependencies!');
      } catch (e: any) {
        spinner.stop();
        console.log('  ' + pc.red('✖') + ' ' + 'Failed to install dependencies automatically.');
        if (e.stderr || e.stdout || e.message) {
          console.error(pc.red(`\nError details:`));
          console.error(pc.dim((e.stderr || e.stdout || e.message).toString()));
        }
        console.error(pc.red('\n✖ Please run the installation commands manually.'));
        process.exit(EXIT.ENVIRONMENT_ERROR);
      }
    }

    console.log('\n  ' + pc.green('✔') + ' Your environment is fully set up and ready to generate PDFs!\n');
    
    if (!process.stdin.isTTY) {
      console.log(pc.yellow('Non-interactive environment. Skipping config prompt.'));
      console.log(`Try running: ${pc.cyan('md2pdf <your-file>.md')}\n`);
      process.exit(EXIT.OK);
    }

    
    const isHome = process.cwd() === os.homedir();
    const configPath = isHome 
      ? path.resolve(os.homedir(), '.md2pdf', 'config.json') 
      : path.resolve(process.cwd(), '.md2pdf.json');
      
    if (fs.existsSync(configPath)) {
      console.log(`Try running: ${pc.cyan('md2pdf <your-file>.md')}\n`);
      process.exit(EXIT.OK);
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ans = await new Promise<string>(resolve => {
      rl.question(pc.cyan(`Would you like to create a default ${isHome ? 'global config (.md2pdf/config.json)' : 'local config (.md2pdf.json)'} here? (y/N) `), resolve);
    });
    
    if (ans.toLowerCase().startsWith('y')) {
      try {
        if (isHome) {
          fs.mkdirSync(path.dirname(configPath), { recursive: true });
        }
        fs.writeFileSync(configPath, JSON.stringify({
          theme: "github",
          margin: "1in",
          paper: "A4",
          toc: false
        }, null, 2));
        console.log('\n  ' + pc.green('✔') + ` Created ${isHome ? '.md2pdf/config.json' : '.md2pdf.json'}\n`);
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

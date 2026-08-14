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
    console.log(pc.bold('\n[i] md2pdf Environment Setup\n'));
    
    let spinner = ora('Checking Node environment...').start();
    spinner.succeed(`Node.js ${process.version}`);

    spinner = ora('Checking Playwright installation...').start();
    
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
          const { getRecommendation } = await import('../errors/recommendations.js');
          const mdError = detectBrowserError(err);
          console.error(pc.red(`\nError: ${mdError.title}`));
          console.error(mdError.reason);
          const rec = getRecommendation(mdError);
          if (rec) {
            console.error(pc.yellow('\nRecommendation: ' + rec.summary));
            rec.commands.forEach((c: string) => console.error(pc.cyan(`  ${c}`)));
          }
          process.exit(EXIT.ENVIRONMENT_ERROR);
        }
        throw new Error('missing');
      }
    } catch {
      spinner.fail('Chromium browser missing');
      console.log(pc.cyan('\nDownloading Chromium for md2pdf. This may take a minute...'));
      
      try {
        spinner = ora('Installing Chromium dependencies...').start();
        execSync('npx playwright-core install chromium', { stdio: 'inherit' });
        
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
            console.log(pc.dim('  npx playwright-core install-deps chromium'));
          } else {
            spinner.stop();
            console.log(pc.cyan('\n[i] Playwright requires system libraries to run Chromium headless.'));
            console.log(pc.cyan('    Requesting sudo access to install dependencies...'));
            execSync('sudo npx playwright-core install-deps chromium', { stdio: 'inherit' });
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

    console.log(pc.green('\n[v] Your environment is fully set up and ready to generate PDFs!\n'));
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(pc.cyan('Would you like to create a default .md2pdf.json config file here? (y/N) '), (ans) => {
      if (ans.toLowerCase().startsWith('y')) {
        const configPath = path.resolve(process.cwd(), '.md2pdf.json');
        if (fs.existsSync(configPath)) {
          console.warn(pc.yellow('\n[!] .md2pdf.json already exists in this directory.'));
        } else {
          fs.writeFileSync(configPath, JSON.stringify({
            theme: "github",
            margin: "1in",
            paper: "A4",
            toc: false
          }, null, 2));
          console.log(pc.green('\n[v] Created .md2pdf.json\n'));
        }
      } else {
        console.log('');
      }
      rl.close();
      console.log(`Try running: ${pc.cyan('md2pdf input.md')}\n`);
      process.exit(EXIT.OK);
    });
  });

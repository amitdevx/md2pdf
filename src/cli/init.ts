import { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import { execSync } from 'node:child_process';
import { EXIT } from './index.js';
import fs from 'node:fs';

export default new Command('init')
  .description('Interactive guided setup for new environments')
  .action(async () => {
    console.log(pc.bold('\n🚀 md2pdf Environment Setup\n'));
    
    let spinner = ora('Checking Node environment...').start();
    spinner.succeed(`Node.js ${process.version}`);

    spinner = ora('Checking Playwright installation...').start();
    let chromiumExecutable = null;
    
    try {
      const { chromium } = await import('playwright');
      spinner.succeed('Playwright is available');
      
      spinner = ora('Checking for Chromium browser...').start();
      chromiumExecutable = chromium.executablePath();
      if (!fs.existsSync(chromiumExecutable)) {
        throw new Error('missing');
      }
      spinner.succeed(`Chromium exists at ${chromiumExecutable}`);
      
    } catch {
      spinner.fail('Chromium browser missing');
      console.log(pc.cyan('\nDownloading Chromium for md2pdf. This may take a minute...'));
      
      try {
        spinner = ora('Installing Chromium dependencies...').start();
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        
        if (process.platform === 'linux') {
          console.log(pc.cyan('\nInstalling required Linux system libraries...'));
          let hasSudo = false;
          try {
            execSync('which sudo', { stdio: 'pipe' });
            hasSudo = true;
          } catch {}

          if (!hasSudo) {
            console.warn(pc.yellow('⚠  sudo not available — skipping system library install'));
            console.log(pc.dim('  If Playwright fails, install these manually as root:'));
            console.log(pc.dim('  npx playwright install-deps chromium'));
          } else {
            execSync('sudo npx playwright install-deps chromium', { stdio: 'inherit' });
          }
        }
        
        spinner.succeed('Successfully installed browser dependencies!');
      } catch {
        spinner.fail('Failed to install dependencies automatically.');
        console.error(pc.red('Please run the installation commands manually.'));
        process.exit(EXIT.ENVIRONMENT_ERROR);
      }
    }

    console.log(pc.green('\n✨ Your environment is fully set up and ready to generate PDFs!\n'));
    console.log(`Try running: ${pc.cyan('md2pdf input.md')}\n`);
    process.exit(EXIT.OK);
  });

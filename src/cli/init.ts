import { Command } from 'commander';
import ora from 'ora';
import pc from 'picocolors';
import { execSync } from 'node:child_process';
import { EXIT } from './index.js';
import fs from 'node:fs';
import path from 'node:path';

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
      
    } catch (e: any) {
      spinner.fail('Chromium browser missing');
      console.log(pc.cyan('\nDownloading Chromium for md2pdf. This may take a minute...'));
      
      try {
        spinner = ora('Installing Chromium dependencies...').start();
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        
        if (process.platform === 'linux') {
          console.log(pc.cyan('\nInstalling required Linux system libraries...'));
          execSync('sudo npx playwright install-deps', { stdio: 'inherit' });
        }
        
        spinner.succeed('Successfully installed browser dependencies!');
      } catch (installErr) {
        spinner.fail('Failed to install dependencies automatically.');
        console.error(pc.red('Please run the installation commands manually.'));
        process.exit(EXIT.ENVIRONMENT_ERROR);
      }
    }

    console.log(pc.green('\n✨ Your environment is fully set up and ready to generate PDFs!\n'));
    console.log(`Try running: ${pc.cyan('md2pdf input.md')}\n`);
    process.exit(EXIT.OK);
  });

#!/usr/bin/env node
import { Command } from 'commander';
import { convert } from '../core/index.js';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const EXIT = {
  OK: 0,
  USAGE_ERROR: 1,
  INPUT_ERROR: 2,
  CONFIG_ERROR: 3,
  DEPENDENCY_ERROR: 4,
  RENDER_ERROR: 5,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program.configureOutput({
  writeErr: (str) => process.stderr.write(str)
});
program.showHelpAfterError('(run md2pdf --help for usage)');

interface CliOptions {
  output?: string;
  toc?: boolean;
  tocDepth?: number;
  tocTitle?: string;
  header?: boolean;
  footer?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  paper?: string;
  margin?: string;
  hrPageBreak?: boolean;
}

program
  .name('md2pdf')
  .description('Production-quality Markdown to PDF rendering engine')
  .version(pkg.version)
  .argument('<input>', 'Input markdown file')
  .option('-o, --output <output>', 'Output PDF file')
  .option('--toc', 'Generate a Table of Contents')
  .option('--toc-depth <depth>', 'Maximum heading depth for TOC', (val) => {
    const n = parseInt(val);
    if (isNaN(n) || n < 1 || n > 6) {
      console.error(pc.red(`Invalid --toc-depth '${val}': must be a number between 1 and 6`));
      process.exit(EXIT.USAGE_ERROR);
    }
    return n;
  })
  .option('--toc-title <title>', 'Title for the TOC section')
  .option('--header', 'Enable default running header')
  .option('--footer', 'Enable default running footer')
  .option('--header-template <template>', 'Custom HTML template for header')
  .option('--footer-template <template>', 'Custom HTML template for footer')
  .option('--paper <format>', 'Page format: A4, Letter, Legal', 'A4')
  .option('--margin <size>', 'Page margin (e.g. 20mm, 1in)', '20mm')
  .option('--hr-page-break', 'Treat --- as a page break')
  .action(async (input: string, options: CliOptions) => {
    const spinner = ora('Converting markdown to PDF...').start();

    if (!fs.existsSync(input)) {
      spinner.fail(pc.red(`Input file '${input}' does not exist`));
      console.error(pc.dim('  Provide a valid path to a .md file'));
      process.exit(EXIT.INPUT_ERROR);
    }

    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      spinner.fail(pc.red(`'${input}' is a directory, not a file`));
      console.error(pc.dim('  Provide a path to a .md file, not a folder'));
      process.exit(EXIT.INPUT_ERROR);
    }

    if ((options.tocDepth || options.tocTitle) && !options.toc) {
      console.warn(pc.yellow('⚠  --toc-depth and --toc-title have no effect without --toc'));
    }
    if (options.headerTemplate && !options.header) {
      console.warn(pc.yellow('⚠  --header-template has no effect without --header'));
    }
    if (options.footerTemplate && !options.footer) {
      console.warn(pc.yellow('⚠  --footer-template has no effect without --footer'));
    }

    let output = options.output || input.replace(/\.md$/i, '.pdf');
    
    if (path.extname(output) === '') {
      output = output + '.pdf';
      console.warn(pc.yellow(`⚠  No extension given, writing to ${output}`));
    }

    const resolvedInput = path.resolve(input);
    const resolvedOutput = path.resolve(output);
    if (resolvedInput === resolvedOutput) {
      spinner.fail(pc.red('Input and output cannot be the same file'));
      process.exit(EXIT.USAGE_ERROR);
    }

    try {
      const result = await convert({ 
        input, 
        output,
        toc: options.toc,
        tocDepth: options.tocDepth,
        tocTitle: options.tocTitle,
        header: options.headerTemplate ? { template: options.headerTemplate } : options.header,
        footer: options.footerTemplate ? { template: options.footerTemplate } : options.footer,
        paper: options.paper as any,
        margin: options.margin,
        pageBreaks: options.hrPageBreak ? { hrAsPageBreak: true } : undefined,
      });
      
      if (result.warnings && result.warnings.length > 0) {
        spinner.warn(pc.yellow(`Generated ${output} in ${result.renderTimeMs}ms with warnings:`));
        result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠ ${w}`)));
      } else {
        spinner.succeed(pc.green(`Successfully generated ${output} in ${result.renderTimeMs}ms`));
      }
    } catch (error: any) {
      const isBrowserMissing =
        error?.message?.includes("Executable doesn't exist") ||
        error?.message?.includes('browserType.launch') ||
        error?.message?.includes('playwright install');
        
      if (error?.message?.includes('publish: false')) {
        spinner.warn(pc.yellow(`Skipped — '${input}' has publish: false in frontmatter`));
        console.error(pc.dim('  Remove the publish: false line or set it to true to convert this file'));
        process.exit(EXIT.CONFIG_ERROR);
      } else if (error?.name === 'YAMLException' || error?.message?.includes('YAMLException')) {
        spinner.fail(pc.red('Invalid frontmatter YAML'));
        console.error(pc.dim(`  ${error.message.split('\\n')[0]}`));
        console.error(pc.dim('  Fix the YAML block at the top of your file'));
        process.exit(EXIT.CONFIG_ERROR);
      } else if (isBrowserMissing) {
        spinner.fail(pc.red('Chromium browser not found.'));
        console.error(pc.yellow('\nRun this to fix it:'));
        console.error(pc.cyan('\n  npx playwright install chromium\n'));
        console.error(pc.dim('Then try md2pdf again.'));
        process.exit(EXIT.DEPENDENCY_ERROR);
      } else {
        spinner.fail(pc.red('Failed to generate PDF'));
        console.error(error);
        console.error(pc.cyan('\nPlease report this issue at https://github.com/amitdevx/md2pdf/issues it means a lot to help us ❤️\n'));
        process.exit(EXIT.RENDER_ERROR);
      }
    }
  });

program.parse(process.argv);

#!/usr/bin/env node
import { Command } from 'commander';
import { convert } from '../core/index.js';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

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
  .option('--toc-depth <depth>', 'Maximum heading depth for TOC', parseInt)
  .option('--toc-title <title>', 'Title for the TOC section')
  .option('--header', 'Enable default running header')
  .option('--footer', 'Enable default running footer')
  .option('--header-template <template>', 'Custom HTML template for header')
  .option('--footer-template <template>', 'Custom HTML template for footer')
  .option('--paper <format>', 'Page format: A4, Letter, Legal', 'A4')
  .option('--margin <size>', 'Page margin (e.g. 20mm, 1in)', '20mm')
  .option('--hr-page-break', 'Treat --- as a page break')
  .action(async (input: string, options: CliOptions) => {
    if (!fs.existsSync(input)) {
      console.error(pc.red(`Error: Input file '${input}' does not exist.`));
      process.exit(1);
    }

    if (fs.statSync(input).isDirectory()) {
      console.error(pc.red(`Error: '${input}' is a directory, not a markdown file.`));
      process.exit(1);
    }

    if (options.tocDepth && !options.toc) {
      console.warn(pc.yellow('⚠ --toc-depth has no effect without --toc'));
    }
    if (options.headerTemplate && !options.header) {
      console.warn(pc.yellow('⚠ --header-template has no effect without --header'));
    }

    const output = options.output || input.replace(/\.md$/i, '.pdf');
    const spinner = ora('Converting markdown to PDF...').start();

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
        
      const isPublishFalse = error?.message?.includes('publish: false');

      if (isPublishFalse) {
        spinner.fail(pc.yellow('Skipped — this file has publish: false in frontmatter'));
        process.exit(0);
      } else if (isBrowserMissing) {
        spinner.fail(pc.red('Chromium browser not found.'));
        console.error(pc.yellow('\nRun this to fix it:'));
        console.error(pc.cyan('\n  npx playwright install chromium\n'));
        console.error(pc.dim('Then try md2pdf again.'));
      } else {
        spinner.fail(pc.red('Failed to generate PDF'));
        console.error(error);
      }
      process.exit(1);
    }
  });

program.parse(process.argv);

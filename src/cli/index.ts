#!/usr/bin/env node
import { Command } from 'commander';
import { convert } from '../core/index.js';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { ConvertOptions } from '../types/index.js';

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
  h1NewPage?: boolean;
  theme?: string;
  mermaidTheme?: string;
  mermaidTimeout?: string;
}

program
  .name('md2pdf')
  .description('Production-quality Markdown to PDF rendering engine')
  .version(pkg.version)
  .argument('<input>', 'Input markdown file')
  .option('-o, --output <output>', 'Output PDF file')
  .option('--toc', 'Generate a Table of Contents')
  .option('--toc-depth <depth>', 'Maximum heading depth for TOC (1-6)', (val) => {
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
  .option('--paper <format>', 'Page format: A4, Letter, Legal', (val) => {
    const valid = ['A4', 'Letter', 'Legal'];
    if (!valid.includes(val)) {
      console.error(pc.red(`Invalid --paper '${val}': must be one of: A4, Letter, Legal`));
      process.exit(EXIT.USAGE_ERROR);
    }
    return val;
  }, 'A4')
  .option('--margin <size>', 'Page margin (e.g. 20mm, 1in)', (val) => {
    if (!/^\d+(\.\d+)?(mm|cm|in|px|pt|pc|em|rem|%)$/.test(val)) {
      console.error(pc.red(`Invalid --margin '${val}': use CSS units like 20mm, 1in, 1.5cm`));
      process.exit(EXIT.USAGE_ERROR);
    }
    return val;
  }, '20mm')
  .option('--hr-page-break', 'Treat --- as a page break')
  .option('--h1-new-page', 'Force a page break before each H1 heading')
  .option('--theme <theme>', 'Active md2pdf theme (default, github, obsidian-light, etc.)')
  .option('--mermaid-theme <theme>', 'Override theme for Mermaid diagrams (default, dark, base, neutral)')
  .option('--mermaid-timeout <ms>', 'Timeout for Mermaid rendering in milliseconds')
  .action(async (input: string, options: CliOptions) => {
    const spinner = ora('Converting markdown to PDF...').start();

    // BUG-07: explicit stdin check
    if (input === '-') {
      spinner.fail(pc.red('stdin input is not supported'));
      console.error(pc.dim('  Save content to a .md file and pass the path instead'));
      process.exit(EXIT.INPUT_ERROR);
    }

    // BUG-02 part 1: file existence
    if (!fs.existsSync(input)) {
      spinner.fail(pc.red(`Input file '${input}' does not exist`));
      console.error(pc.dim('  Provide a valid path to a .md file'));
      process.exit(EXIT.INPUT_ERROR);
    }

    // BUG-02 part 2: directory check
    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      spinner.fail(pc.red(`'${input}' is a directory, not a file`));
      console.error(pc.dim('  Provide a path to a .md file, not a folder'));
      process.exit(EXIT.INPUT_ERROR);
    }

    // BUG-02 part 3: non-.md extension check
    if (path.extname(input).toLowerCase() !== '.md') {
      spinner.fail(pc.red(`'${input}' is not a markdown file`));
      console.error(pc.dim('  md2pdf only accepts .md files'));
      process.exit(EXIT.INPUT_ERROR);
    }

    // Orphan flag warnings
    if ((options.tocDepth || options.tocTitle) && !options.toc) {
      console.warn(pc.yellow('⚠  --toc-depth and --toc-title have no effect without --toc'));
    }
    if (options.headerTemplate && !options.header) {
      console.warn(pc.yellow('⚠  --header-template has no effect without --header'));
    }
    if (options.footerTemplate && !options.footer) {
      console.warn(pc.yellow('⚠  --footer-template has no effect without --footer'));
    }

    // BUG-06: trailing slash output check
    const rawOutput = options.output;
    if (rawOutput && (rawOutput.endsWith('/') || rawOutput.endsWith(path.sep))) {
      spinner.fail(pc.red(`Output path '${rawOutput}' looks like a directory`));
      console.error(pc.dim('  Provide a full file path, e.g. -o ./output.pdf'));
      process.exit(EXIT.INPUT_ERROR);
    }

    let output = options.output || input.replace(/\.md$/i, '.pdf');

    // BUG-09: no-extension guard
    if (path.extname(output) === '') {
      output = output + '.pdf';
      console.warn(pc.yellow(`⚠  No extension given, writing to ${output}`));
    }

    const resolvedInput = path.resolve(input);
    const resolvedOutput = path.resolve(output);

    // BUG-08: same-file guard
    if (resolvedInput === resolvedOutput) {
      spinner.fail(pc.red('Input and output cannot be the same file'));
      process.exit(EXIT.USAGE_ERROR);
    }

    // BUG-09: output dir warning
    const outputDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outputDir)) {
      console.warn(pc.yellow(`⚠  Directory '${outputDir}' doesn't exist — it will be created`));
    }

    // BUG-10: overwrite warning
    if (fs.existsSync(resolvedOutput)) {
      console.warn(pc.yellow(`⚠  Overwriting: ${resolvedOutput}`));
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
        paper: options.paper as ConvertOptions['paper'],
        margin: options.margin,
        theme: options.theme,
        mermaid: {
          theme: options.mermaidTheme as any,
          timeout: options.mermaidTimeout ? parseInt(options.mermaidTimeout as string) : undefined
        },
        pageBreaks: {
          hrAsPageBreak: options.hrPageBreak ?? false,
          h1NewPage: options.h1NewPage ?? false,
        },
      });

      // BUG-11: use resolvedOutput in success messages
      if (result.warnings && result.warnings.length > 0) {
        spinner.warn(pc.yellow(`Generated ${resolvedOutput} in ${result.renderTimeMs}ms with warnings:`));
        result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠ ${w}`)));
      } else {
        spinner.succeed(pc.green(`Successfully generated ${resolvedOutput} in ${result.renderTimeMs}ms`));
      }
    } catch (error: unknown) {
      const err = error as { message?: string; name?: string; code?: string };
      const isBrowserMissing =
        err?.message?.includes("Executable doesn't exist") ||
        err?.message?.includes('browserType.launch') ||
        err?.message?.includes('playwright install');

      if (err?.message?.includes('publish: false')) {
        // CONFIG: publish:false skip
        spinner.warn(pc.yellow(`Skipped — '${input}' has publish: false in frontmatter`));
        console.error(pc.dim('  Remove the publish: false line or set it to true to convert this file'));
        process.exit(EXIT.CONFIG_ERROR);
      } else if (err?.name === 'YAMLException' || err?.message?.includes('YAMLException')) {
        // CONFIG: bad YAML — BUG-12: fixed \n -> \n
        spinner.fail(pc.red('Invalid frontmatter YAML'));
        console.error(pc.dim(`  ${err.message ? err.message.split('\n')[0] : 'Malformed YAML frontmatter'}`));
        console.error(pc.dim('  Fix the YAML block at the top of your file'));
        process.exit(EXIT.CONFIG_ERROR);
      } else if (err?.code === 'EACCES') {
        // BUG-04: permission denied
        spinner.fail(pc.red(`Permission denied: cannot read '${input}'`));
        console.error(pc.dim(`  Check file permissions: chmod 644 ${input}`));
        process.exit(EXIT.INPUT_ERROR);
      } else if (isBrowserMissing) {
        // DEPENDENCY: Chromium not installed
        spinner.fail(pc.red('Chromium browser not found.'));
        console.error(pc.yellow('\nRun this to fix it:'));
        console.error(pc.cyan('\n  npx playwright install chromium\n'));
        console.error(pc.dim('Then try md2pdf again.'));
        process.exit(EXIT.DEPENDENCY_ERROR);
      } else {
        // Unknown internal error
        spinner.fail(pc.red('Failed to generate PDF'));
        console.error(error);
        console.error(pc.cyan('\nPlease report this issue at https://github.com/amitdevx/md2pdf/issues it means a lot to help us ❤️\n'));
        process.exit(EXIT.RENDER_ERROR);
      }
    }
  });

program.parse(process.argv);

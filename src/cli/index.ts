#!/usr/bin/env node

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  process.stderr.write(
    `\nError: md2pdf requires Node.js 18 or higher.\n` +
    `You are running Node.js ${process.version}.\n` +
    `Please upgrade: https://nodejs.org\n\n`
  );
  process.exit(1);
}

import { Command, InvalidArgumentError } from 'commander';
import pc from 'picocolors';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import doctorCmd from './doctor.js';
import initCmd from './init.js';
import { runConvert } from '../commands/convert.js';
import type { CliOptions } from './options.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program.configureOutput({
  writeErr: (str) => process.stderr.write(str)
});
program.showHelpAfterError('(run md2pdf --help for usage)');

// Register subcommands
program.addCommand(doctorCmd);
program.addCommand(initCmd);

program
  .name('md2pdf')
  .description('Production-quality Markdown to PDF rendering engine')
  .version(pkg.version)
  .argument('<inputs...>', 'Input markdown files (supports wildcards like *.md)')
  .option('-o, --output <output>', 'Output PDF file (or directory if multiple inputs)')
  .option('--toc', 'Generate a Table of Contents')
  .option('--toc-depth <depth>', 'Maximum heading depth for TOC (1-6)', (val) => {
    const n = parseInt(val);
    if (isNaN(n) || n < 1 || n > 6) {
      throw new InvalidArgumentError(`must be a number between 1 and 6`);
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
      throw new InvalidArgumentError(`must be one of: A4, Letter, Legal`);
    }
    return val;
  }, 'A4')
  .option('--browser <browser>', 'Unsupported option (future use)', () => { throw new InvalidArgumentError('The --browser option is not currently supported.'); })
  .option('--stdin', 'Unsupported option (future use)', () => { throw new InvalidArgumentError('The --stdin option is not currently supported.'); })
  .option('--stdout', 'Unsupported option (future use)', () => { throw new InvalidArgumentError('The --stdout option is not currently supported.'); })
  .option('--quiet', 'Unsupported option (future use)', () => { throw new InvalidArgumentError('The --quiet option is not currently supported.'); })
  .option('--input <input>', 'Unsupported option (future use)', () => { throw new InvalidArgumentError('The --input option is not currently supported. Pass input as an argument.'); })
  .option('--margin <margin>', 'Page margin (e.g., 20mm, 1in)', (val) => {
    if (!/^\d+(\.\d+)?(mm|cm|in|px|pt|pc|em|rem|%)$/.test(val)) {
      throw new InvalidArgumentError(`use CSS units like 20mm, 1in, 1.5cm`);
    }
    return val;
  }, '20mm')
  .option('--hr-page-break', 'Treat --- as a page break')
  .option('--h1-new-page', 'Force a page break before each H1 heading')
  .option('--theme <theme>', 'Active md2pdf theme (default, github, obsidian-light, etc.)')
  .option('--mermaid-theme <theme>', 'Override theme for Mermaid diagrams (default, dark, base, neutral)')
  .option('--mermaid-timeout <ms>', 'Timeout for Mermaid rendering in milliseconds', (val) => {
    const n = parseInt(val);
    if (isNaN(n) || n <= 0) {
      throw new InvalidArgumentError(`must be a positive integer in milliseconds`);
    }
    return n;
  })
  .option('--no-math', 'Disable KaTeX math rendering for LaTeX equations')
  .option('--debug', 'Enable debug diagnostics')
  .option('--verbose', 'Enable verbose output')
  .option('--json-errors', 'Output errors in JSON format')
  .option('--hide-tags', 'Hide inline Obsidian tags in PDF output')
  .option('--resolve-links', 'Attempt to visually indicate resolvable vs unresolvable wiki links')
  .option('--config <path>', 'Path to configuration file')
  .option('--profile <name>', 'Configuration profile to use')
  .option('--vault-root <path>', 'Path to the Obsidian vault root directory')
  .option('--attachment-folder <path>', 'Default attachment folder for unresolved embeds')
  .option('--max-attachment-size <mb>', 'Max attachment size in MB (default: 10)', (val) => {
    const n = parseInt(val);
    if (isNaN(n) || n <= 0) {
      throw new InvalidArgumentError(`must be a positive integer`);
    }
    return n;
  })
  .action(runConvert);

program.parse(process.argv);

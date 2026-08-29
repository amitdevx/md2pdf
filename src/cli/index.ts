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
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import doctorCmd from './doctor.js';
import initCmd from './init.js';
import { runConvert } from '../commands/convert.js';
import { renderCliError, jsonOut } from './formatter.js';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

const isJsonErrors = process.argv.includes('--json-errors');
program.configureOutput({
  writeErr: () => {
    // We handle the error formatting in exitOverride instead to ensure boxing
    if (isJsonErrors) {
      // Do nothing here, handled in exitOverride
    }
  }
});
program.showHelpAfterError('(run md2pdf --help for usage)');

program.exitOverride((err) => {
  if (err.code === 'commander.version' || err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  if (isJsonErrors) {
    jsonOut({
      success: false,
      results: [{
        input: null, output: null, error: err.message, code: 'ERR_INVALID_ARGUMENT'
      }]
    });
    process.exit(1);
  } else {
    // Use the boxed formatter for consistency
    renderCliError(new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Argument', err.message), { jsonErrors: false } as any);
    process.exit(1);
  }
});

// Register subcommands
program.addCommand(doctorCmd);
program.addCommand(initCmd);
program.command('list-themes')
  .description('List all available built-in themes')
  .action(async () => {
    const { getBuiltInThemes } = await import('../themes/loader.js');
    const themes = getBuiltInThemes();
    process.stdout.write(`Available built-in themes:\n${themes.map(t => `  - ${t}`).join('\n')}\n`);
    process.exit(0);
  });

program.command('clear-cache')
  .description('Clear the incremental rendering cache')
  .action(async () => {
    const { clearCache } = await import('../core/cache.js');
    clearCache();
    process.stdout.write(`Cache cleared.\n`);
    process.exit(0);
  });


program
  .name('md2pdf')
  .description('Convert Markdown to PDF with Mermaid diagrams, KaTeX math, Obsidian syntax, syntax highlighting, batch processing, TOC, and custom themes. CLI + Node.js API.')
  .version(pkg.version, '-v, -V, --version', 'output the current version')
  .argument('[inputs...]', 'Input markdown files (supports wildcards like *.md)')
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
  .option('--margin <margin>', 'Page margin (e.g., 20mm, 1in, 0)', (val) => {
    if (!/^(0|\d+(\.\d+)?(mm|cm|in|px|pt|pc|em|rem|%))$/.test(val)) {
      throw new InvalidArgumentError(`use CSS units like 20mm, 1in, 1.5cm, or 0`);
    }
    return val;
  }, '20mm')
  .option('--hr-page-break', 'Treat --- as a page break')
  .option('--h1-new-page', 'Force a page break before each H1 heading')
  .option('--theme <theme>', 'Active md2pdf theme (default, github, obsidian-light, etc.)')
  .option('--mermaid-theme <theme>', 'Override theme for Mermaid diagrams (default, dark, base, neutral)', (val) => {
    const valid = ['default', 'dark', 'base', 'neutral'];
    if (!valid.includes(val)) {
      throw new InvalidArgumentError(`must be one of: ${valid.join(', ')}`);
    }
    return val;
  })
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
  .option('--no-title', 'Disable automatic document title injection from frontmatter/filename')
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
  .option('--no-cache', 'Disable incremental rendering cache')
  .option('--concurrency <n>', 'Limit concurrent file processing workers', (val) => {
    const n = parseInt(val);
    if (isNaN(n) || n <= 0) {
      throw new InvalidArgumentError(`must be a positive integer`);
    }
    return n;
  })
  .option('--browser <path>', 'Path to custom Chromium/Chrome executable (or use CHROME_PATH, BROWSER_PATH, or MD2PDF_BROWSER)')
  .option('-f, --force', 'Force overwrite of existing PDF files')
  .option('--dry-run', 'Preview which files would be processed without actually converting them')
  .option('-q, --quiet', 'Suppress all output except errors')
  .addHelpText('after', `
Exit Codes:
  0: Success
  1: Usage, validation, or configuration error (e.g., missing file, bad YAML)
  2: Runtime error (e.g., missing browser, document too complex)
`)
  .action(runConvert);


// Early intercept for common mistakes
const firstArg = process.argv[2];

if (firstArg === '-v') {
  process.argv[2] = '-V';
} else if (firstArg === 'version' || firstArg === '--version') {
  process.argv[2] = '-V';
}

if (firstArg && firstArg !== firstArg.toLowerCase()) {
  const lower = firstArg.toLowerCase();
  if (['help', 'init', 'doctor', 'clear-cache', 'list-themes'].includes(lower)) {
    process.argv[2] = lower;
  }
}

if (process.argv[2] === 'help') {
  program.outputHelp();
  process.exit(0);
}
if (process.argv[2] === '--init') {
  console.error("Unknown option '--init'. Did you mean: md2pdf init");
  process.exit(1);
}
if (process.argv[2] === '--doctor') {
  console.error("Unknown option '--doctor'. Did you mean: md2pdf doctor");
  process.exit(1);
}

if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(1);
} else {
  program.parse(process.argv);
}

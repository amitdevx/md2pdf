#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { convert } from '../core/index.js';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { ConvertOptions } from '../types/index.js';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import { getRecommendation } from '../errors/recommendations.js';

import doctorCmd from './doctor.js';
import initCmd from './init.js';

export const EXIT = {
  OK: 0,
  USAGE_ERROR: 1,
  ENVIRONMENT_ERROR: 2,
  INTERNAL_BUG: 3,
};

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
  math?: boolean;
  debug?: boolean;
  verbose?: boolean;
  jsonErrors?: boolean;
  hideTags?: boolean;
  resolveLinks?: boolean;
  vaultRoot?: string;
  attachmentFolder?: string;
  maxAttachmentSize?: string;
}

function renderCliError(err: Md2PdfError, options: CliOptions) {
  if (options.jsonErrors) {
    console.log(JSON.stringify({
      success: false,
      error: {
        code: err.code,
        title: err.title,
        reason: err.reason,
        context: err.context
      }
    }, null, 2));
    process.exit(EXIT.ENVIRONMENT_ERROR);
  }

  const rec = getRecommendation(err);
  
  console.error('\n' + pc.dim('────────────────────────────────────────'));
  console.error(pc.red(`✖ ${err.title}`));
  console.error(err.reason);
  
  if (rec) {
    console.error(pc.yellow('\nReason'));
    console.error(rec.summary);
    
    if (rec.commands.length > 0) {
      console.error(pc.green('\nRecommendation'));
      rec.commands.forEach(cmd => console.error(`  ${cmd}`));
    }
  }

  console.error(pc.cyan(`\nError Code: ${err.code}`));
  
  if (options.debug) {
    console.error(pc.dim('\n--- DEBUG DIAGNOSTICS ---'));
    console.error(pc.dim(`Node: ${process.version} (${process.arch})`));
    console.error(pc.dim(`OS: ${process.platform}`));
    console.error(pc.dim(`PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'Not set'}`));
    if (err.originalError && (err.originalError as Error).stack) {
      console.error(pc.dim((err.originalError as Error).stack!));
    }
    console.error(pc.dim('-------------------------'));
  } else if (!options.verbose) {
    console.error(pc.dim('\nRun with --verbose or --debug for more information, or try `md2pdf doctor`'));
  }
  
  console.error(pc.dim('────────────────────────────────────────\n'));

  // Exit code mapping
  let code = EXIT.ENVIRONMENT_ERROR;
  if (err.code === Md2PdfErrorCode.ERR_UNKNOWN) code = EXIT.INTERNAL_BUG;
  if (err.code === Md2PdfErrorCode.ERR_INVALID_MARKDOWN) code = EXIT.USAGE_ERROR;
  
  process.exitCode = code;
  process.exit(code);
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
  .option('--theme <theme>', 'Active md2pdf theme (default, github, obsidian-light, etc.)', (val) => {
    const valid = ['default', 'github', 'obsidian-light', 'obsidian-dark'];
    if (!valid.includes(val)) {
      throw new InvalidArgumentError(`must be one of: ${valid.join(', ')}`);
    }
    return val;
  })
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
  .option('--json-errors', 'Output errors in JSON format')
  .option('--hide-tags', 'Hide inline Obsidian tags in PDF output')
  .option('--resolve-links', 'Attempt to visually indicate resolvable vs unresolvable wiki links')
  .option('--vault-root <path>', 'Path to the Obsidian vault root directory')
  .option('--attachment-folder <path>', 'Default attachment folder for unresolved embeds')
  .option('--max-attachment-size <mb>', 'Max attachment size in MB (default: 10)', (val) => {
    const n = parseInt(val);
    if (isNaN(n) || n <= 0) {
      throw new InvalidArgumentError(`must be a positive integer`);
    }
    return val;
  })
  .action(async (input: string, options: CliOptions) => {
    const emitJsonErrorAndExit = (code: string, title: string, reason: string) => {
      console.log(JSON.stringify({
        success: false,
        error: { code, title, reason }
      }, null, 2));
      process.exit(EXIT.USAGE_ERROR);
    };

    const spinner = options.jsonErrors ? { start: () => ({}), succeed: () => {}, warn: () => {}, fail: () => {} } : ora('Converting markdown to PDF...').start();

    if (input === '-') {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_INPUT_UNSUPPORTED', 'Stdin Not Supported', 'stdin input is not supported. Save content to a .md file and pass the path instead.');
      } else {
        (spinner as any).fail(pc.red('stdin input is not supported'));
        console.error(pc.dim('  Save content to a .md file and pass the path instead'));
        process.exit(EXIT.USAGE_ERROR);
      }
    }

    if (!fs.existsSync(input)) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_INPUT_NOT_FOUND', 'File Not Found', `Input file '${input}' does not exist.`);
      } else {
        (spinner as any).fail(pc.red(`Input file '${input}' does not exist`));
        console.error(pc.dim('  Provide a valid path to a .md file'));
        process.exit(EXIT.USAGE_ERROR);
      }
    }



    const stat = fs.statSync(input);
    if (stat.isDirectory()) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_INPUT_IS_DIRECTORY', 'Input is Directory', `'${input}' is a directory, not a file.`);
      } else {
        (spinner as any).fail(pc.red(`'${input}' is a directory, not a file`));
        process.exit(EXIT.USAGE_ERROR);
      }
    }

    if (path.extname(input).toLowerCase() !== '.md') {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_INVALID_EXTENSION', 'Invalid Extension', `'${input}' is not a markdown file.`);
      } else {
        (spinner as any).fail(pc.red(`'${input}' is not a markdown file`));
        process.exit(EXIT.USAGE_ERROR);
      }
    }

    try {
      fs.accessSync(input, fs.constants.R_OK);
    } catch {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_PERMISSION_DENIED', 'Permission Denied', `Permission denied: cannot read '${input}'`);
      } else {
        (spinner as any).fail(pc.red(`Permission denied: cannot read '${input}'`));
        console.error(pc.dim(`  Check file permissions: ls -la ${input}`));
        process.exit(EXIT.USAGE_ERROR);
      }
    }

    const rawOutput = options.output;
    if (rawOutput) {
      const outputStat = fs.existsSync(rawOutput) ? fs.statSync(rawOutput) : null;
      if (outputStat?.isDirectory() || rawOutput.endsWith('/') || rawOutput.endsWith(path.sep)) {
        if (options.jsonErrors) {
          emitJsonErrorAndExit('ERR_OUTPUT_IS_DIRECTORY', 'Output is Directory', `Output path '${rawOutput}' is a directory, not a file.`);
        } else {
          (spinner as any).fail(pc.red(`Output path '${rawOutput}' is a directory, not a file`));
          console.error(pc.dim('  Provide a full file path, e.g. --output report.pdf'));
          process.exit(EXIT.USAGE_ERROR);
        }
      }
    }

    let output = options.output || input.replace(/\.md$/i, '.pdf');
    if (path.extname(output) === '') {
      output = output + '.pdf';
      if (!options.jsonErrors) {
        console.warn(pc.yellow(`⚠  No extension given, writing to ${output}`));
      }
    }

    const resolvedInput = path.resolve(input);
    const resolvedOutput = path.resolve(output);

    const outDir = path.dirname(resolvedOutput);
    if (!fs.existsSync(outDir)) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_OUTPUT_DIR_MISSING', 'Output Directory Missing', `The directory '${outDir}' does not exist.`);
      } else {
        (spinner as any).fail(pc.red(`Output directory '${outDir}' does not exist`));
        console.error(pc.dim('  Please create the directory first or provide a valid path.'));
        process.exit(EXIT.USAGE_ERROR);
      }
    }

    // Prevent path traversal to sensitive root directories (Linux/macOS)
    const sensitiveDirs = ['/etc', '/root', '/var', '/usr', '/bin'];
    if (sensitiveDirs.some(dir => resolvedOutput.startsWith(dir))) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_PATH_TRAVERSAL', 'Access Denied', 'Cannot write output to protected system directory.');
      } else {
        (spinner as any).fail(pc.red(`Access Denied: Cannot write output to protected system directory.`));
        process.exit(EXIT.USAGE_ERROR);
      }
    }

    if (resolvedInput === resolvedOutput) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_SAME_FILE', 'Same File', 'Input and output cannot be the same file.');
      } else {
        (spinner as any).fail(pc.red('Input and output cannot be the same file'));
        process.exit(EXIT.USAGE_ERROR);
      }
    }

    if ((options.tocDepth || options.tocTitle) && !options.toc) {
      console.warn(pc.yellow('⚠  --toc-depth / --toc-title have no effect without --toc'));
    }
    if (options.headerTemplate && !options.header) {
      console.warn(pc.yellow('⚠  --header-template has no effect without --header'));
    }
    if (options.footerTemplate && !options.footer) {
      console.warn(pc.yellow('⚠  --footer-template has no effect without --footer'));
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
        math: {
          enabled: options.math ?? true
        },
        pageBreaks: {
          hrAsPageBreak: options.hrPageBreak ?? false,
          h1NewPage: options.h1NewPage ?? false,
        },
        obsidian: {
          showTags: !options.hideTags,
          resolveLinks: options.resolveLinks,
          vaultRoot: options.vaultRoot,
          attachmentFolder: options.attachmentFolder,
          maxAttachmentSizeMb: options.maxAttachmentSize ? parseInt(options.maxAttachmentSize as string) : undefined,
        }
      });

      if (!options.jsonErrors) {
        if (result.warnings && result.warnings.length > 0) {
          (spinner as any).warn(pc.yellow(`Generated ${resolvedOutput} in ${result.renderTimeMs}ms with warnings:`));
          result.warnings.forEach((w: string) => console.warn(pc.yellow(`  ⚠ ${w}`)));
        } else {
          (spinner as any).succeed(pc.green(`Successfully generated ${resolvedOutput} in ${result.renderTimeMs}ms`));
        }
        
        
        if (options.verbose) {
          console.log(pc.dim('\n--- VERBOSE INFO ---'));
          console.log(pc.dim(`Pages: ${result.pageCounts || 'unknown'}`));
          console.log(pc.dim(`Output Path: ${result.outputPath}`));
          console.log(pc.dim(`Theme: ${options.theme || 'default'}`));
          console.log(pc.dim(`Metadata: ${JSON.stringify(result.metadata || {})}`));
          console.log(pc.dim('--------------------'));
        }
      }
    } catch (error: unknown) {
      if (!options.jsonErrors) (spinner as any).fail(pc.red('Conversion failed'));

      if (error instanceof Md2PdfError) {
        renderCliError(error, options);
      } else {
        const err = error as Error;
        const mdError = new Md2PdfError(
          Md2PdfErrorCode.ERR_UNKNOWN,
          'Unexpected Internal Error',
          err?.message || 'An unknown error occurred.',
          { platform: process.platform },
          error
        );
        renderCliError(mdError, options);
      }
    }
  });

program.parse(process.argv);

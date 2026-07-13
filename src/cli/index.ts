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
import { convert } from '../core/index.js';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import { getRecommendation } from '../errors/recommendations.js';

import { loadConfig } from '../config/loader.js';
import { mergeConfig } from '../config/merge.js';
import doctorCmd from './doctor.js';
import initCmd from './init.js';
import fg from 'fast-glob';

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
  config?: string;
  profile?: string;
}

function jsonOut(data: object) {
  const str = JSON.stringify(data, null, 2);
  if ((data as any).success === false && !(data as any).results) {
    process.stderr.write(str + '\n');
  } else {
    process.stdout.write(str + '\n');
  }
}

function renderCliError(err: Md2PdfError, options: CliOptions) {
  if (options.jsonErrors) {
    jsonOut({
      success: false,
      error: {
        code: err.code,
        title: err.title,
        reason: err.reason,
        context: err.context
      }
    });
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
  .action(async (inputsRaw: string[], options: CliOptions) => {
    // Resolve globs for Windows compatibility
    let inputs: string[] = [];
    for (const raw of inputsRaw) {
      if (fs.existsSync(raw)) {
        inputs.push(path.normalize(raw));
        continue;
      }
      
      const normalizedPattern = raw.replace(/\\/g, '/');
      if (fg.isDynamicPattern(normalizedPattern)) {
        const matches = await fg(normalizedPattern, { dot: true, unique: true, onlyFiles: false });
        inputs.push(...matches.map(p => path.normalize(p)));
      } else {
        inputs.push(path.normalize(raw));
      }
    }
    inputs = Array.from(new Set(inputs));
    
    if (inputs.length === 0) {
      console.error(pc.red('✖ No input files found matching the provided arguments.'));
      process.exit(EXIT.USAGE_ERROR);
    }

    let resolvedConfig = {};

    try {
      const result = await loadConfig(process.cwd(), options.config);
      resolvedConfig = result.config;

    } catch (err: any) {
      console.error(pc.red(`\n✖ ${err.title || 'Config Error'}`));
      console.error(err.reason || err.message);
      process.exit(EXIT.USAGE_ERROR);
    }
    
    // Add output to cliFlags so mergeConfig maps them. We'll set input individually in the loop.
    const cliFlags = { ...options, output: options.output };
    
    if (cliFlags.vaultRoot && !fs.existsSync(cliFlags.vaultRoot)) {
      if (!options.jsonErrors) {
        console.warn(pc.yellow(`⚠ --vault-root '${cliFlags.vaultRoot}' does not exist, ignoring.`));
      }
      delete cliFlags.vaultRoot;
    }
    
    if ((cliFlags.tocDepth || cliFlags.tocTitle) && !cliFlags.toc) {
      if (!options.jsonErrors) {
        console.warn(pc.yellow('⚠  --toc-depth / --toc-title have no effect without --toc'));
      }
    }
    
    const emitJsonErrorAndExit = (code: string, title: string, reason: string) => {
      jsonOut({
        success: false,
        error: { code, title, reason }
      });
      process.exit(EXIT.USAGE_ERROR);
    };

    const isBatch = inputs.length > 1;

    if (isBatch && options.output) {
      // If multiple inputs, --output must be a directory
      const outputStat = fs.existsSync(options.output) ? fs.statSync(options.output) : null;
      if (outputStat && !outputStat.isDirectory()) {
        if (options.jsonErrors) {
          emitJsonErrorAndExit('ERR_OUTPUT_IS_NOT_DIRECTORY', 'Output Must Be Directory', `Multiple inputs provided, but output '${options.output}' is a file.`);
        } else {
          console.error(pc.red(`✖ Output path '${options.output}' is a file, but multiple inputs were provided.`));
          console.error(pc.dim('  When converting multiple files, --output must be a directory.'));
          process.exit(EXIT.USAGE_ERROR);
        }
      }
      if (!outputStat) {
        fs.mkdirSync(options.output, { recursive: true });
      }
    } else if (!isBatch && options.output) {
      // Single file mode: --output must not be a directory unless the user provides a filename.
      // If it exists and is a directory, fail gracefully rather than throwing EISDIR later.
      const outputStat = fs.existsSync(options.output) ? fs.statSync(options.output) : null;
      if (outputStat?.isDirectory() || options.output.endsWith('/') || options.output.endsWith(path.sep)) {
        if (options.jsonErrors) {
          emitJsonErrorAndExit('ERR_OUTPUT_IS_DIRECTORY', 'Output is Directory', `Output path '${options.output}' is a directory, not a file.`);
        } else {
          console.error(pc.red(`✖ Output path '${options.output}' is a directory, not a file.`));
          console.error(pc.dim('  Provide a full file path, e.g. --output report.pdf'));
          process.exit(EXIT.USAGE_ERROR);
        }
      }
    }

    // Synchronous Validation Loop
    let hasErrors = false;
    let successfulCount = 0;
    let failedCount = 0;
    const validInputs: string[] = [];

    const reportError = (input: string, reason: string) => {
      hasErrors = true;
      failedCount++;
      if (!options.jsonErrors) {
        console.error(pc.red(`✖ ${input} — ${reason}`));
      }
    };

    for (const input of inputs) {
      if (input === '-') {
        reportError(input, 'stdin input is not supported');
        continue;
      }
      if (!fs.existsSync(input)) {
        reportError(input, 'file not found');
        continue;
      }
      const stat = fs.statSync(input);
      if (stat.isDirectory()) {
        reportError(input, 'is a directory, not a file');
        continue;
      }
      if (path.extname(input).toLowerCase() !== '.md') {
        reportError(input, 'is not a markdown file');
        continue;
      }
      try {
        fs.accessSync(input, fs.constants.R_OK);
      } catch {
        reportError(input, 'permission denied');
        continue;
      }

      let predictedOutput = options.output;
      if (isBatch && predictedOutput) {
        predictedOutput = path.join(predictedOutput, path.basename(input).replace(/\.md$/i, '.pdf'));
      } else if (!predictedOutput) {
        predictedOutput = input.replace(/\.md$/i, '.pdf');
      }

      if (path.resolve(input) === path.resolve(predictedOutput)) {
        reportError(input, 'input and output cannot be the same file');
        continue;
      }
      validInputs.push(input);
    }
    
    inputs = validInputs;
    if (inputs.length === 0) {
      if (options.jsonErrors) {
        jsonOut({ success: false, error: { code: 'ERR_VALIDATION', title: 'Validation Failed', reason: 'No valid input files to process.' } });
      }
      process.exit(hasErrors ? EXIT.USAGE_ERROR : EXIT.OK);
    }

    interface SpinnerLike {
      start(): void;
      stop(): void;
      succeed(text?: string): void;
      warn(text?: string): void;
      fail(text?: string): void;
      text: string;
    }

    const noopSpinner: SpinnerLike = {
      start: () => {}, stop: () => {}, succeed: () => {},
      warn: () => {}, fail: () => {}, text: ''
    };

    const spinner: SpinnerLike = options.jsonErrors
      ? noopSpinner
      : ora('Launching browser...').start() as unknown as SpinnerLike;
    const startTime = Date.now();
    let globalBrowser: any;
    let globalMermaidContext: any;
    let globalMermaidPage: any;

    const cleanup = async () => {
      if (globalMermaidContext) {
        await globalMermaidContext.close().catch(() => {});
      }
      if (globalBrowser) {
        await globalBrowser.close().catch(() => {});
      }
    };

    // Graceful Shutdown Handler for Ctrl+C
    process.on('SIGINT', async () => {
      console.log(pc.yellow('\n⚠ Process interrupted by user. Cleaning up...'));
      await cleanup();
      process.exit(130);
    });

    try {
      const { getBrowser } = await import('../pdf/browser.js');
      if (isBatch) {
        globalBrowser = await getBrowser();
      }
      
      const results = [];

      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        
        // Lazy-load Mermaid page ONLY if the file actually contains Mermaid diagrams
        const hasMermaid = await new Promise<boolean>((resolve) => {
          const stream = fs.createReadStream(input, { encoding: 'utf-8', highWaterMark: 65536 });
          stream.once('data', (chunk) => { stream.destroy(); resolve((chunk as string).includes('```mermaid')); });
          stream.once('error', () => resolve(false));
          stream.once('end', () => resolve(false));
        });
        
        if (isBatch && hasMermaid && !globalMermaidPage) {
          globalMermaidContext = await globalBrowser.newContext({ deviceScaleFactor: 2 });
          globalMermaidPage = await globalMermaidContext.newPage();
          await globalMermaidPage.setContent(`<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body></body>
</html>`);
          await globalMermaidPage.evaluate(() => document.fonts.ready);
          try {
            const requireModule = (await import('node:module')).createRequire(import.meta.url);
            const scriptPath = requireModule.resolve('mermaid/dist/mermaid.min.js');
            await globalMermaidPage.addScriptTag({ path: scriptPath });
          } catch {
            // Fallback or warning if Mermaid isn't installed
          }
        }

        let output = cliFlags.output;
        if (isBatch && output) {
          // output is a directory
          output = path.join(output, path.basename(input).replace(/\.md$/i, '.pdf'));
        } else if (!output) {
          output = input.replace(/\.md$/i, '.pdf');
        }

        const convertOptions = mergeConfig(resolvedConfig, options.profile, { ...cliFlags, input, output });
        if (isBatch) {
          convertOptions.sharedBrowser = globalBrowser;
          if (globalMermaidPage) {
            (convertOptions as any).sharedMermaidPage = globalMermaidPage;
          }
        }

        if (!options.jsonErrors && isBatch) {
          spinner.text = `Converting (${i + 1}/${inputs.length}): ${path.basename(input)}...`;
        } else if (!options.jsonErrors && !isBatch) {
          spinner.text = 'Converting...';
        }

        try {
          const result = await convert(convertOptions as any);
          
          if (!options.jsonErrors && result.warnings.length > 0) {
            result.warnings.forEach(w => console.warn(pc.yellow(`\n⚠ ${w}`)));
          }
          
          if (!options.jsonErrors && isBatch) {
            (spinner as any).stop();
            console.log(pc.green(`✔ ${path.basename(result.outputPath)} (${result.renderTimeMs}ms)`));
            (spinner as any).start();
          }
          
          successfulCount++;
          results.push(result);
        } catch (err: any) {
          if (err?.code === 'ERR_PUBLISH_SKIPPED') {
            results.push({ isSkipped: true, outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: ['Skipped: publish: false'] });
            if (!options.jsonErrors) {
              console.log(pc.dim(`⏭ Skipped ${path.basename(input)} (publish: false)`));
            }
            continue;
          }
          hasErrors = true;
          failedCount++;
          const msg = `${path.basename(input)} — ${err.reason || err.message}`;
          
          if (!options.jsonErrors && isBatch) {
            (spinner as any).stop();
            console.error(pc.red(`✖ ${msg}`));
            (spinner as any).start();
          }
          results.push({ isError: true, error: err.reason || err.message, outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] });
        }
      }

      if (options.jsonErrors) {
        jsonOut({
          success: !hasErrors,
          results: results.map((r: any, index: number) => ({
            input: inputs[index],
            output: r.outputPath,
            pages: r.pageCounts,
            timeMs: r.renderTimeMs,
            warnings: r.warnings,
            ...(r.isError ? { error: r.error } : {})
          }))
        });
      } else {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        if (isBatch) {
          (spinner as any).stop();
          console.log(`\n${successfulCount} succeeded, ${failedCount} failed in ${totalTime}s`);
        } else {
          if (hasErrors) {
            const res = results[0] as any;
            const errStr = res?.isError ? `${path.basename(inputs[0])} — ${res.error}` : `Failed in ${totalTime}s`;
            spinner.fail(pc.red(errStr));
          } else {
            spinner.succeed(pc.green(`Successfully converted ${inputs.length} file${inputs.length > 1 ? 's' : ''} in ${totalTime}s!`));
          }
        }
      }
      
      if (hasErrors) {
        process.exitCode = EXIT.USAGE_ERROR;
      }

    } catch (err: any) {
      spinner.stop();

      if (err instanceof Md2PdfError) {
        renderCliError(err, options);
      } else {
        if (options.jsonErrors) {
          emitJsonErrorAndExit('ERR_UNKNOWN', 'Conversion Failed', err.message);
        } else {
          spinner.fail(pc.red(err.message));
          if (options.debug && err.stack) {
            console.error(pc.dim(err.stack));
          }
          process.exit(EXIT.USAGE_ERROR);
        }
      }
    } finally {
      await cleanup();
    }

  });

program.parse(process.argv);

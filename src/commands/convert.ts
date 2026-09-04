/**
 * convert.ts — CLI orchestrator (~100 lines)
 *
 * Responsibilities:
 *   1. Resolve globs → concrete file paths
 *   2. Load config
 *   3. Emit early errors (no input, vault root, unsupported flags)
 *   4. Validate all inputs via validateInputFiles()
 *   5. Route to handleSingle() or handleBatch()
 *
 * The actual conversion logic lives in:
 *   src/commands/handlers/single.ts  — single file fast-path + cache bypass
 *   src/commands/handlers/batch.ts   — concurrent worker pool
 */
import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { jsonOut, renderCliError, EXIT, emitJsonErrorAndExit } from '../cli/formatter.js';

import type { CliOptions } from '../cli/options.js';
import { validateInputFiles } from '../validation/index.js';
import { handleSingle } from './handlers/single.js';
import { handleBatch } from './handlers/batch.js';

export async function runConvert(inputsRaw: string[], options: CliOptions) {
  let inputs: string[] = [];
  if (options.stdin) {
    inputs = ['-'];
  } else {
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
  }

  if (inputs.length === 0) {
    if (options.jsonErrors) {
      jsonOut({ success: false, error: { code: 'ERR_NO_INPUT', title: 'Missing Input', reason: 'No input files found matching the provided arguments.' } });
    } else {
      console.error(pc.red('✖ No input files found matching the provided arguments.'));
    }
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

  const cliFlags = { ...options };
  if ((cliFlags as any).browser) {
    process.env.MD2PDF_BROWSER = (cliFlags as any).browser;
  }

  if (process.env.MD2PDF_BROWSER && !fs.existsSync(process.env.MD2PDF_BROWSER)) {
    if (options.jsonErrors) {
      emitJsonErrorAndExit('ERR_INVALID_BROWSER', 'Browser Not Found', `The specified browser executable does not exist at '${process.env.MD2PDF_BROWSER}'.`);
    } else {
      const { Md2PdfError, Md2PdfErrorCode } = await import('../errors/index.js');
      renderCliError(new Md2PdfError(Md2PdfErrorCode.ERR_BROWSER_MISSING, 'Browser Not Found', `The specified browser executable does not exist at '${process.env.MD2PDF_BROWSER}'.`), options as any);
      process.exit(EXIT.USAGE_ERROR);
    }
  }


  if (cliFlags.vaultRoot && !fs.existsSync(cliFlags.vaultRoot)) {
    if (options.jsonErrors) {
      emitJsonErrorAndExit('ERR_VAULT_ROOT_NOT_FOUND', 'Vault Root Not Found', `--vault-root '${cliFlags.vaultRoot}' does not exist.`);
    } else {
      console.error(pc.red(`✖ --vault-root '${cliFlags.vaultRoot}' does not exist.`));
      process.exit(EXIT.USAGE_ERROR);
    }
  }

  if (!options.jsonErrors) {
    if ((cliFlags.tocDepth || cliFlags.tocTitle) && !cliFlags.toc) {
      console.warn(pc.yellow('⚠  --toc-depth / --toc-title have no effect without --toc'));
    }
    if (cliFlags.headerTemplate && !cliFlags.header) {
      console.warn(pc.yellow('⚠  --header-template has no effect without --header'));
    }
    if (cliFlags.footerTemplate && !cliFlags.footer) {
      console.warn(pc.yellow('⚠  --footer-template has no effect without --footer'));
    }
  }

  const isBatch = inputs.length > 1;

  if (isBatch && options.output) {
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
    if (!outputStat && !options.dryRun) {
      fs.mkdirSync(options.output, { recursive: true });
    }
  } else if (!isBatch && options.output) {
    const outputStat = fs.existsSync(options.output) ? fs.statSync(options.output) : null;
    if (outputStat?.isDirectory()) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_INVALID_INPUT', 'Output is a Directory', `The output path '${options.output}' is a directory. Provide a file path, e.g. --output report.pdf`);
      } else {
        console.error(pc.red(`✖ Output path '${options.output}' is a directory, not a file.`));
        console.error(pc.dim('  Provide a full file path, e.g. --output report.pdf'));
        process.exit(EXIT.USAGE_ERROR);
      }
    }
    if (!path.extname(options.output)) {
      if (!options.jsonErrors) console.warn(pc.yellow(`⚠ Output path has no .pdf extension - appending`));
      options.output += '.pdf';
      (cliFlags as any).output = options.output;
    }
  }

  if (options.dryRun) {
    if (!options.jsonErrors && !options.quiet) {
      console.log(pc.cyan(`\n[PREVIEW] Dry Run Mode: ${inputs.length} file(s) matched`));
    }
    for (const input of inputs) {
      let out = options.output;
      if (isBatch && options.output) {
        out = path.join(options.output, path.basename(input).replace(/\.md$/i, '.pdf'));
      } else if (!out) {
        out = input.replace(/\.md$/i, '.pdf');
      }
      if (options.jsonErrors) {
        console.log(JSON.stringify({ type: 'dry-run', input, output: path.resolve(out) }));
      } else if (!options.quiet) {
        console.log(`  ${pc.gray(input)} -> ${pc.green(out)}`);
      }
    }
    process.exitCode = 0;
    return;
  }

  const validationResult = validateInputFiles(inputs, isBatch, options);
  

  for (const err of validationResult.errors) {
    
    if (err.isFatal) {
      if (options.jsonErrors) {
        jsonOut({ success: false, error: { code: err.error.code as string, title: err.error.title || 'Error', reason: err.error.reason || err.error.message } });
      } else {
        renderCliError(err.error, options as any);
      }
      process.exitCode = err.error.code === 'ERR_PATH_TRAVERSAL' ? EXIT.USAGE_ERROR : EXIT.ENVIRONMENT_ERROR;
      process.exit(process.exitCode);
    }
  }

  // Do not exit early here! Pass ALL inputs (and errors) into the handlers so they can report them in JSON/Batch summary!
  if (isBatch) {
    await handleBatch(inputs, options, cliFlags, resolvedConfig, validationResult);
  } else {
    await handleSingle(inputs[0], options, cliFlags, resolvedConfig, validationResult);
  }
}

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
import { jsonOut, renderCliError, EXIT } from '../cli/formatter.js';
import { emitJsonErrorAndExit } from './handlers/shared.js';
import type { CliOptions } from '../cli/options.js';
import { validateInputFiles } from '../validation/index.js';
import { handleSingle } from './handlers/single.js';
import { handleBatch } from './handlers/batch.js';

export async function runConvert(inputsRaw: string[], options: CliOptions) {
  // ── 1. Glob resolution ──────────────────────────────────────────────────
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
    if (options.jsonErrors) {
      jsonOut({ success: false, error: { code: 'ERR_NO_INPUT', title: 'Missing Input', reason: 'No input files found matching the provided arguments.' } });
    } else {
      console.error(pc.red('[ERR] No input files found matching the provided arguments.'));
    }
    process.exit(EXIT.USAGE_ERROR);
  }

  // ── 2. Load config ──────────────────────────────────────────────────────
  let resolvedConfig = {};
  try {
    const result = await loadConfig(process.cwd(), options.config);
    resolvedConfig = result.config;
  } catch (err: any) {
    console.error(pc.red(`\n[ERR] ${err.title || 'Config Error'}`));
    console.error(err.reason || err.message);
    process.exit(EXIT.USAGE_ERROR);
  }

  // ── 3. Build cliFlags + early checks ───────────────────────────────────
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

  for (const flag of ['stdin', 'stdout', 'input']) {
    if ((cliFlags as any)[flag]) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_UNSUPPORTED_OPTION', 'Unsupported Option', `The --${flag} option is not currently supported.`);
      } else {
        console.error(pc.red(`error: The --${flag} option is not currently supported.`));
        process.exit(EXIT.USAGE_ERROR);
      }
    }
  }

  if (cliFlags.vaultRoot && !fs.existsSync(cliFlags.vaultRoot)) {
    if (options.jsonErrors) {
      emitJsonErrorAndExit('ERR_VAULT_ROOT_NOT_FOUND', 'Vault Root Not Found', `--vault-root '${cliFlags.vaultRoot}' does not exist.`);
    } else {
      console.error(pc.red(`[ERR] --vault-root '${cliFlags.vaultRoot}' does not exist.`));
      process.exit(EXIT.USAGE_ERROR);
    }
  }

  if (!options.jsonErrors) {
    if ((cliFlags.tocDepth || cliFlags.tocTitle) && !cliFlags.toc) {
      console.warn(pc.yellow('[WARN]  --toc-depth / --toc-title have no effect without --toc'));
    }
    if (cliFlags.headerTemplate && !cliFlags.header) {
      console.warn(pc.yellow('[WARN]  --header-template has no effect without --header'));
    }
    if (cliFlags.footerTemplate && !cliFlags.footer) {
      console.warn(pc.yellow('[WARN]  --footer-template has no effect without --footer'));
    }
  }

  // ── 4. Batch-mode output directory checks ───────────────────────────────
  const isBatch = inputs.length > 1;

  if (isBatch && options.output) {
    const outputStat = fs.existsSync(options.output) ? fs.statSync(options.output) : null;
    if (outputStat && !outputStat.isDirectory()) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_OUTPUT_IS_NOT_DIRECTORY', 'Output Must Be Directory', `Multiple inputs provided, but output '${options.output}' is a file.`);
      } else {
        console.error(pc.red(`[ERR] Output path '${options.output}' is a file, but multiple inputs were provided.`));
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
        console.error(pc.red(`[ERR] Output path '${options.output}' Is a Directory, Not a File.`));
        console.error(pc.dim('  Provide a full file path, e.g. --output report.pdf'));
        process.exit(EXIT.USAGE_ERROR);
      }
    }
    if (!path.extname(options.output)) {
      if (!options.jsonErrors) console.warn(pc.yellow(`[WARN] Output path has no .pdf extension - appending`));
      options.output += '.pdf';
      (cliFlags as any).output = options.output;
    }
  }

  // ── 5. Dry-run ──────────────────────────────────────────────────────────
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

  // ── 6. Validate all inputs ──────────────────────────────────────────────
  const validationResult = validateInputFiles(inputs, isBatch, options);
  let hasErrors = false;

  for (const err of validationResult.errors) {
    hasErrors = true;
    if (err.isFatal) {
      if (options.jsonErrors) {
        jsonOut({ success: false, error: { code: err.error.code as string, title: err.error.title || 'Error', reason: err.error.reason || err.error.message } });
      } else {
        renderCliError(err.error, options as any);
      }
      process.exitCode = err.error.code === 'ERR_PATH_TRAVERSAL' ? EXIT.USAGE_ERROR : EXIT.ENVIRONMENT_ERROR;
      process.exit(process.exitCode);
    } else {
      if (!options.jsonErrors) {
        console.error(pc.red(`[ERR] ${err.input} - ${err.error.reason || err.error.message}`));
      }
    }
  }

  inputs = validationResult.validInputs;
  if (inputs.length === 0) {
    if (options.jsonErrors) {
      jsonOut({ success: false, error: { code: 'ERR_VALIDATION', title: 'Validation Failed', reason: 'No valid input files to process.' } });
    }
    process.exit(hasErrors ? EXIT.USAGE_ERROR : EXIT.OK);
  }

  // ── 7. Route to handler ─────────────────────────────────────────────────
  if (isBatch) {
    await handleBatch(inputs, options, cliFlags, resolvedConfig);
  } else {
    await handleSingle(inputs[0], options, cliFlags, resolvedConfig);
  }
}

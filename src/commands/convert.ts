/**
 * convert.ts - CLI orchestrator (~100 lines)
 *
 * Responsibilities:
 *   1. Resolve globs → concrete file paths
 *   2. Load config
 *   3. Emit early errors (no input, vault root, unsupported flags)
 *   4. Validate all inputs via validateInputFiles()
 *   5. Route to handleSingle() or handleBatch()
 *
 * The actual conversion logic lives in:
 *   src/commands/handlers/single.ts  - single file fast-path + cache bypass
 *   src/commands/handlers/batch.ts   - concurrent worker pool
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fg from 'fast-glob';
import pc from 'picocolors';
import { loadConfig } from '../config/loader.js';
import { jsonOut, renderCliError, EXIT, emitJsonErrorAndExit } from '../cli/formatter.js';

import type { CliOptions } from '../cli/options.js';
import { validateInputFiles } from '../validation/index.js';
import { handleSingle } from './handlers/single.js';
import { handleBatch } from './handlers/batch.js';
import { watchFiles } from '../features/watch.js';
import { splitMarkdownByHeading } from '../features/split.js';

export async function runConvert(inputsRaw: string[], options: CliOptions) {
  let scratchDirToCleanup: string | undefined;
  try {
  let inputs: string[] = [];
  if (options.stdin) {
    const rawMarkdown = await new Promise<string>((resolve, reject) => {
      let data = '';
      let byteCount = 0;
      const MAX_STDIN_BYTES = 100 * 1024 * 1024; // 100MB for batch piping
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', chunk => {
        byteCount += Buffer.byteLength(chunk, 'utf-8');
        if (byteCount > MAX_STDIN_BYTES) {
          process.stdin.destroy();
          reject(new Error('ERR_FILE_TOO_LARGE: Stdin input exceeds maximum size.'));
          return;
        }
        data += chunk;
      });
      process.stdin.on('error', reject);
    });

    const chunks = rawMarkdown.split(/(?:\0|\n---\n)/).filter(s => s.trim().length > 0);
    
    if (chunks.length === 1 || chunks.length === 0) {
      // Just write to one scratch file so core doesn't hang trying to read exhausted stdin
      const os = await import('node:os');
      const baseTemp = path.join(os.homedir(), '.md2pdf', 'temp');
      if (!fs.existsSync(baseTemp)) fs.mkdirSync(baseTemp, { recursive: true });
      const scratchDir = fs.mkdtempSync(path.join(baseTemp, 'md2pdf-stdin-'));
      scratchDirToCleanup = scratchDir;
      const tempPath = path.join(scratchDir, 'stdin.md');
      fs.writeFileSync(tempPath, chunks.length > 0 ? chunks[0] : '');
      inputs = [tempPath];
    } else if (chunks.length > 1) {
      const os = await import('node:os');
      const baseTemp = path.join(os.homedir(), '.md2pdf', 'temp');
      if (!fs.existsSync(baseTemp)) fs.mkdirSync(baseTemp, { recursive: true });
      const scratchDir = fs.mkdtempSync(path.join(baseTemp, 'md2pdf-stdin-'));
      scratchDirToCleanup = scratchDir;
      inputs = chunks.map((chunk, idx) => {
        const tempPath = path.join(scratchDir, `stdin-part${idx + 1}.md`);
        fs.writeFileSync(tempPath, chunk);
        return tempPath;
      });
    } else {
      inputs = ['-']; // empty stdin fallback
    }
  } else {
    const shellCwd = process.cwd();
    for (const raw of inputsRaw) {
      // Resolve relative to shell cwd before checking existence
      const resolved = path.resolve(shellCwd, raw);
      if (fs.existsSync(resolved)) {
        if (fs.statSync(resolved).isDirectory()) {
          const pattern = options.recursive ? '**/*.md' : '*.md';
          const matches = await fg(pattern, { cwd: resolved, dot: false, unique: true, onlyFiles: true, absolute: true, followSymbolicLinks: false, ignore: ['**/node_modules/**'] });
          inputs.push(...matches);
        } else {
          if (resolved.toLowerCase().endsWith('.pdf')) {
            throw new Error(`ERR_INVALID_INPUT: Cannot process PDF file '${raw}' as main input. md2pdf converts Markdown to PDF. Existing PDFs can only be attached as cover pages.`);
          }
          inputs.push(resolved);
        }
        continue;
      }
      const normalizedPattern = raw.replace(/\\/g, '/');
      if (fg.isDynamicPattern(normalizedPattern)) {
        // Pass explicit cwd so fast-glob resolves against the user's shell dir
        const matches = await fg(normalizedPattern, { cwd: shellCwd, dot: true, unique: true, onlyFiles: true, absolute: true });
        for (const match of matches) {
          if (match.toLowerCase().endsWith('.pdf')) continue;
          inputs.push(match);
        }
      } else {
        if (resolved.toLowerCase().endsWith('.pdf')) {
          throw new Error(`ERR_INVALID_INPUT: Cannot process PDF file '${raw}' as main input. md2pdf converts Markdown to PDF. Existing PDFs can only be attached as cover pages.`);
        }
        // Not a glob, just push the resolved path (validation will give proper error)
        inputs.push(resolved);
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

  const cliFlags: any = { ...options };
  if (cliFlags.browser) {
    process.env.MD2PDF_BROWSER = cliFlags.browser;
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

  if (isBatch && options.output && !cliFlags.merge) {
    let outputStat: fs.Stats | null = null;
    try {
      outputStat = fs.statSync(options.output);
    } catch { /* ignore */ }
    if (outputStat && !outputStat.isDirectory()) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_INVALID_INPUT', 'Output must be a Directory', `The output path '${options.output}' already exists and is not a directory.`);
      } else {
        console.error(pc.red(`✖ The output path '${options.output}' already exists and is not a directory.`));
        console.error(pc.dim('  When converting multiple files, --output must be a directory.'));
        process.exit(EXIT.USAGE_ERROR);
      }
    }
    if (!outputStat && !options.dryRun) {
      fs.mkdirSync(options.output, { recursive: true });
    }
  } else if (isBatch && options.output && cliFlags.merge && !options.dryRun) {
    const outDir = path.dirname(options.output);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
  } else if (!isBatch && options.output) {
    const outputStat = fs.existsSync(options.output) ? fs.statSync(options.output) : null;
    // In split mode the output is always a directory (we'll produce multiple files)
    if (cliFlags.splitByHeading) {
      // Ensure the directory exists; we'll route files into it later
      if (!options.dryRun) {
        fs.mkdirSync(options.output, { recursive: true });
      }
    } else if (outputStat?.isDirectory()) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_INVALID_INPUT', 'Output is a Directory', `The output path '${options.output}' is a directory. Provide a file path, e.g. --output report.pdf`);
      } else {
        console.error(pc.red(`✖ Output path '${options.output}' is a directory, not a file.`));
        console.error(pc.dim('  Provide a full file path, e.g. --output report.pdf'));
        process.exit(EXIT.USAGE_ERROR);
      }
    } else if (!path.extname(options.output)) {
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

  const runHandlers = async () => {
    try {
      let finalInputs = inputs;
    let originalPaths: Record<string, string> | undefined;

    if (cliFlags.splitByHeading) {
      const scratchDir = path.join(os.homedir(), '.md2pdf', 'splits');
      fs.mkdirSync(scratchDir, { recursive: true });
      finalInputs = [];
      originalPaths = {};
      
      for (const input of inputs) {
        if (input === '-') { finalInputs.push(input); continue; }
        if (validationResult.errors.some(e => e.input === input)) {
          finalInputs.push(input); // pass through to handler so it logs the error
          continue;
        }
        const content = fs.readFileSync(input, 'utf-8');
        const splits = splitMarkdownByHeading(content, cliFlags.splitByHeading as 1 | 2);
        if (splits.length === 1) {
          finalInputs.push(input);
        } else {
          const base = path.basename(input, '.md');
          splits.forEach((partContent, idx) => {
            const splitPath = path.join(scratchDir, `${base}-part${idx + 1}.md`);
            fs.writeFileSync(splitPath, partContent);
            finalInputs.push(splitPath);
            originalPaths![splitPath] = input;
          });
        }
      }
    }

    // Force batch mode if splitting produced multiple files
    const effectiveBatch = isBatch || finalInputs.length > 1;

    if (effectiveBatch) {
      await handleBatch(finalInputs, options, cliFlags, resolvedConfig, validationResult, originalPaths);
    } else {
      await handleSingle(finalInputs[0], options, cliFlags, resolvedConfig, validationResult);
    }

    if (cliFlags.splitByHeading) {
      const scratchDir = path.join(os.homedir(), '.md2pdf', 'splits');
      if (fs.existsSync(scratchDir)) {
        fs.rmSync(scratchDir, { recursive: true, force: true });
      }
    }

    if (cliFlags.splitByHeading) {
      const scratchDir = path.join(os.homedir(), '.md2pdf', 'splits');
      if (fs.existsSync(scratchDir)) {
        fs.rmSync(scratchDir, { recursive: true, force: true });
      }
    }
    } catch (e) {
      console.error('CRASH in runHandlers:', e);
      process.exit(1);
    }
  };

  if (cliFlags.watch) {
    await watchFiles(inputs, runHandlers);
  } else {
    await runHandlers();
    process.exit(process.exitCode || 0);
  }
  } finally {
    if (scratchDirToCleanup) {
      try { fs.rmSync(scratchDirToCleanup, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

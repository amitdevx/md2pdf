/**
 * Batch conversion handler.
 * Extracted from convert.ts - handles the concurrent worker pool for batch markdown → PDF.
 * All logic mirrors the original convert.ts batch flow exactly.
 */
import fs from 'node:fs';
import path from 'node:path';

import ora from 'ora';
import pc from 'picocolors';
import { convert } from '../../core/index.js';
import { mergeConfig } from '../../config/merge.js';
import { EXIT, jsonOut, renderCliError, SpinnerLike, noopSpinner, emitJsonErrorAndExit } from '../../cli/formatter.js';
import { Md2PdfError } from '../../errors/index.js';

import { computeHash, checkCache } from '../../cache/index.js';
import { buildVaultIndex, sortDependencies } from '../../core/vault.js';


export async function handleBatch(
  inputs: string[],
  options: any,
  cliFlags: any,
  resolvedConfig: any,
  validationResult?: any,
  /* originalPaths?: Record<string, string> */
): Promise<void> {
  const spinner: SpinnerLike = (options.jsonErrors || options.quiet)
    ? noopSpinner
    : ora('Starting batch conversion...').start() as unknown as SpinnerLike;

  const startTime = Date.now();
  const sharedContext: any = null;
  let sharedMermaidContext: any = null;
  let globalMermaidPage: any = null;
  let isShuttingDown = false;

  const cleanup = async () => {
    isShuttingDown = true;
    if (globalMermaidPage) await globalMermaidPage.close().catch(() => {});
    if (sharedMermaidContext) await sharedMermaidContext.close().catch(() => {});
    if (sharedContext) await sharedContext.close().catch(() => {});
    try {
      const { globalBrowserManager } = await import('../../core/browser-manager.js');
      globalBrowserManager.releaseBrowser();
    } catch { /* ignore */ }
  };

  const sigintHandler = async () => {
    isShuttingDown = true;
    if (!options.quiet && !options.jsonErrors) {
      console.log(pc.yellow('\n⚠ Process interrupted by user. Cleaning up...'));
    }
    spinner.stop();
    await cleanup();
    process.exitCode = 130;
    return;
  };
  process.on('SIGINT', sigintHandler);

  let hasErrors = false;
  let successfulCount = 0;
  let failedCount = 0;
  let skippedExistingCount = 0;
  let skippedPublishCount = 0;
  const preValidationErrors: string[] = [];

  interface BatchRecord {
    originalIndex: number;
    input: string;
    output: string;
    isSkipped: boolean;
    isError: boolean;
    error?: string;
    code?: string;
    skipReason?: string;
    pageCounts: number;
    renderTimeMs: number;
    warnings: string[];
    fromCache: boolean;
    hasMermaid: boolean;
  }

  try {
    // 1. Initialize stable records
    const records: BatchRecord[] = inputs.map((input, originalIndex) => ({
      originalIndex,
      input,
      output: '-',
      isSkipped: false,
      isError: false,
      pageCounts: 0,
      renderTimeMs: 0,
      warnings: [],
      fromCache: false,
      hasMermaid: false
    }));

    // 2. Pre-Validation Errors
    if (validationResult?.errors) {
      for (const err of validationResult.errors) {
        const rec = records.find(r => r.input === err.input);
        if (rec) {
          rec.isError = true;
          rec.error = err.error.reason || err.error.message;
          rec.code = err.error.code || 'ERR_VALIDATION';
          failedCount++;
          hasErrors = true;
          preValidationErrors.push(`✖ ${err.input} - ${rec.error}`);
        }
      }
    }

    // 3. Dependency Sorting (for vault links)
    const vaultIndex = buildVaultIndex(cliFlags.vaultRoot as string | undefined, inputs);
    const sortedInputs = sortDependencies(inputs, vaultIndex);
    records.sort((a, b) => sortedInputs.indexOf(a.input) - sortedInputs.indexOf(b.input));

    let isDir = false;
    try { if (options.output) isDir = fs.statSync(options.output).isDirectory(); } catch { /* ignore */ }
    
    // 4. Preflight Phase: Calculate Output, Validate Frontmatter, Output Exists, Cache Hash Setup
    for (const rec of records) {
      if (rec.isError) continue;

      let output = cliFlags.output;
      if (output) {
        if (isDir) {
          output = path.join(output, cliFlags.merge ? `md2pdf-merge-${Date.now()}-${path.basename(rec.input)}`.replace(/\.md$/i, '.pdf') : path.basename(rec.input).replace(/\.md$/i, '.pdf'));
        } else if (cliFlags.merge) {
          output = path.join(path.dirname(output), `md2pdf-merge-${Date.now()}-${path.basename(rec.input)}`.replace(/\.md$/i, '.pdf'));
        } else {
          output = output.toLowerCase().endsWith('.pdf') ? output : output + '.pdf';
        }
      } else {
        output = rec.input.replace(/\.md$/i, '.pdf');
      }
      rec.output = path.resolve(output as string);

      try {
        fs.mkdirSync(path.dirname(rec.output), { recursive: true });
      } catch (dirErr: any) {
        if (dirErr.code !== 'EEXIST') {
          rec.isError = true;
          rec.code = 'ERR_FS_MKDIR';
          rec.error = `Cannot create output directory: ${dirErr.message}`;
          failedCount++;
          hasErrors = true;
          continue;
        }
      }

      if (fs.existsSync(rec.output) && !options.force) {
        rec.isSkipped = true;
        rec.skipReason = 'Existing PDF (use --force to overwrite)';
        skippedExistingCount++;
        continue;
      }

      let rawContent = '';
      try {
        rawContent = fs.readFileSync(rec.input, 'utf-8');
      } catch {
        rec.isError = true;
        rec.code = 'ERR_PERMISSION_DENIED';
        rec.error = `Cannot read file '${rec.input}': Permission denied.`;
        failedCount++;
        hasErrors = true;
        continue;
      }
      
      rec.hasMermaid = rawContent.includes('```mermaid');

      const matter = (await import('gray-matter')).default;
      let parsed: any;
      try {
        const blockEngine = () => { throw new Error('JavaScript/CoffeeScript frontmatter engines are disabled.'); };
        parsed = matter(rawContent, { engines: { js: blockEngine, javascript: blockEngine, coffee: blockEngine, coffeescript: blockEngine, cson: blockEngine } });
        if (parsed?.data?.publish === false) {
          rec.isSkipped = true;
          rec.skipReason = 'publish: false';
          skippedPublishCount++;
          continue;
        }
        (rec as any).__preparsed = { data: parsed.data, content: parsed.content };
        
        const SAFE_THEME_NAME = /^[a-zA-Z0-9_-]+$/;
        const rawFrontmatterTheme = parsed.data?.theme ? String(parsed.data.theme) : undefined;
        const safeFrontmatterTheme = rawFrontmatterTheme && SAFE_THEME_NAME.test(rawFrontmatterTheme) ? rawFrontmatterTheme : undefined;
        const themeName: string = safeFrontmatterTheme || options.theme || 'default';
        const { loadTheme } = await import('../../themes/loader.js');
        await loadTheme(themeName);
      } catch (yamlErr: any) {
        rec.isError = true;
        rec.code = yamlErr.message?.includes('Theme Load Error') || yamlErr.message?.includes('Failed to load theme') ? 'ERR_INVALID_THEME' : 'ERR_CONFIG_ERROR';
        rec.error = `Frontmatter/Theme error: ${yamlErr.message || String(yamlErr)}`;
        failedCount++;
        hasErrors = true;
        continue;
      }
    }

    const queue = records.filter(r => !r.isError && !r.isSkipped);
    
    // 5. Browser Startup Phase
    let daemonAlive = false;
    if (!process.env.MD2PDF_DAEMON) {
      const { isDaemonAlive } = await import('../../daemon/client.js');
      daemonAlive = await isDaemonAlive();
    }

    if (queue.length > 0 && !daemonAlive) {
      const { globalBrowserManager } = await import('../../core/browser-manager.js');
      const browser = await globalBrowserManager.acquireBrowser();
      const hasMermaidAnywhere = queue.some(r => r.hasMermaid);
      
      if (hasMermaidAnywhere) {
        sharedMermaidContext = await browser.newContext({ deviceScaleFactor: 2 });
        globalMermaidPage = await sharedMermaidContext.newPage();
        const { initializeMermaid } = await import('../../plugins/mermaid/runtime.js');
        await initializeMermaid(globalMermaidPage);
      }
    }

    let completedCount = records.length - queue.length;
    const updateSpinner = () => {
      if (!options.jsonErrors && !options.quiet) {
        const percent = records.length > 0 ? Math.round((completedCount / records.length) * 100) : 100;
        spinner.text = `Converting (${completedCount}/${records.length}) files [${percent}%]`;
      }
    };
    updateSpinner();

    // 6. Execution Phase
    const os = await import('node:os');
    const concurrencyLimit = cliFlags.concurrency ? Math.max(1, Number(cliFlags.concurrency) || 1) : Math.min(2, os.cpus().length);

    const worker = async () => {
      while (queue.length > 0 && !isShuttingDown) {
        const rec = queue.shift()!;
        const fileStartTime = Date.now();
        const convertOptions = mergeConfig(resolvedConfig, options.profile, { ...cliFlags, input: rec.input, output: rec.output });
        
        if ((rec as any).__preparsed) {
          (convertOptions as any).__preparsed = (rec as any).__preparsed;
        }

        const useCache = convertOptions.cache !== false;
        if (useCache && (rec as any).__preparsed?.content) {
          try {
            const fileHash = computeHash((rec as any).__preparsed.content, convertOptions);
            if (checkCache(rec.input, fileHash, rec.output)) {
              rec.fromCache = true;
              if (!options.jsonErrors && !options.quiet) {
                spinner.stop();
                console.log(pc.green(`✔ ${path.basename(rec.output)} (cached)`));
                spinner.start();
              }
              successfulCount++;
              completedCount++;
              updateSpinner();
              continue;
            }
          } catch { /* ignore cache errors */ }
        }

        if (globalMermaidPage) {
          convertOptions.sharedMermaidPage = globalMermaidPage;
        }

        try {
          if (options.verbose && !options.jsonErrors) {
            spinner.stop();
            console.log(pc.dim(`\nℹ Starting conversion pipeline for: ${rec.input}`));
            console.log(pc.dim(`ℹ Output target: ${rec.output}`));
            spinner.start();
          }

          const result = await convert(convertOptions as any);
          rec.renderTimeMs = Date.now() - fileStartTime;
          rec.pageCounts = result.pageCounts;
          rec.warnings = result.warnings || [];
          rec.output = result.outputPath;

          if (!options.jsonErrors && result.warnings.length > 0) {
            spinner.stop();
            result.warnings.forEach(w => console.warn(pc.yellow(`⚠ ${w}`)));
            spinner.start();
          }

          if (!options.jsonErrors && !options.quiet) {
            spinner.stop();
            console.log(pc.green(`✔ ${path.basename(rec.output)} (${rec.renderTimeMs}ms)`));
            spinner.start();
          }

          successfulCount++;
        } catch (err: any) {
          if (isShuttingDown) break;

          hasErrors = true;
          failedCount++;
          const rawMsg = err.reason || err.message || String(err);
          const cleanMsg = rawMsg.split('\n').slice(0, 3).join(' | ');

          if (!options.jsonErrors && !options.quiet) {
            spinner.stop();
            console.error(pc.red(`✖ ${path.basename(rec.input)} - ${cleanMsg}`));
            spinner.start();
          }

          const { detectBrowserError } = await import('../../errors/detect.js');
          const md2Error = detectBrowserError(err, { markdownFile: rec.input });
          rec.isError = true;
          rec.error = cleanMsg;
          rec.code = (err as any).errorCode ?? (err as NodeJS.ErrnoException).code ?? md2Error?.code ?? 'ERR_UNKNOWN';
        }

        completedCount++;
        updateSpinner();
      }
    };

    const workers = Array.from({ length: Math.min(concurrencyLimit, queue.length) }, () => worker());
    const settledResults = await Promise.allSettled(workers);
    
    const rejectedWorker = settledResults.find(r => r.status === 'rejected');
    if (rejectedWorker) {
      throw (rejectedWorker as PromiseRejectedResult).reason;
    }

    records.sort((a, b) => a.originalIndex - b.originalIndex);

    const finalMergeOutput = options.output ? (options.output.endsWith('/') || isDir ? path.join(options.output, 'merged.pdf') : options.output) : 'merged.pdf';

    if (cliFlags.merge && !hasErrors && (successfulCount > 0 || skippedExistingCount > 0)) {
      const pathsToMerge = records.filter(r => !r.isError && !r.isSkipped && r.output).map(r => r.output);
      if (pathsToMerge.length > 0) {
        try {
          if (!options.quiet) {
            spinner.text = `Merging ${pathsToMerge.length} PDFs into ${finalMergeOutput}...`;
            spinner.start();
          }
          const { mergePDFs } = await import('../../features/merge.js');
          await mergePDFs(pathsToMerge, finalMergeOutput);
          if (!options.quiet) spinner.succeed(`Merged output saved to ${finalMergeOutput}`);
          
          for (const p of pathsToMerge) {
            if (p.includes('md2pdf-merge-')) {
              try { fs.unlinkSync(p); } catch { /* ignore */ }
            }
          }
        } catch (err: any) {
          hasErrors = true;
          if (!options.quiet) spinner.fail(`Failed to merge PDFs: ${err.message}`);
        }
      }
    }

    if (options.jsonErrors) {
      jsonOut({
        success: !hasErrors && (successfulCount > 0 || skippedExistingCount > 0 || skippedPublishCount > 0),
        ...(skippedExistingCount + skippedPublishCount > 0 ? { skipped: skippedExistingCount + skippedPublishCount } : {}),
        results: records.map(r => {
          const out: any = {
            input: r.input,
            output: r.output || '-',
            status: r.isError ? 'error' : (r.isSkipped ? 'skipped' : 'success'),
            pages: r.pageCounts || 0,
            timeMs: r.renderTimeMs || 0,
            warnings: r.warnings || []
          };
          if (r.isError) {
            out.error = { code: r.code || 'ERR_UNKNOWN', reason: r.error, title: 'Conversion Failed' };
          }
          if (r.isSkipped) out.skipReason = r.skipReason;
          return out;
        })
      });
    } else {
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      spinner.stop();
      
      if (!options.quiet && preValidationErrors.length > 0) {
        preValidationErrors.forEach(err => console.error(pc.red(err)));
      }
      console.log(`\n${successfulCount} succeeded, ${failedCount} failed in ${totalTime}s`);
      if (skippedExistingCount > 0) {
        console.log(pc.yellow(`⚠ Skipped ${skippedExistingCount} existing PDFs (use --force to overwrite)`));
      }
      if (skippedPublishCount > 0) {
        console.log(pc.yellow(`⚠ Skipped ${skippedPublishCount} files (publish: false)`));
      }
    }

    if (hasErrors) {
      let maxCode = EXIT.USAGE_ERROR;
      for (const r of records) {
        if (r.isError) {
          if (r.code === 'ERR_FILE_TOO_LARGE' || r.code === 'ERR_DOCUMENT_TOO_COMPLEX' || r.code === 'ERR_BROWSER_MISSING' || r.code === 'ERR_PERMISSION_DENIED') {
            maxCode = EXIT.ENVIRONMENT_ERROR;
          }
        }
      }
      process.exitCode = maxCode;
    } else {
      process.exitCode = EXIT.OK;
    }

  } catch (err: any) {
    hasErrors = true;
    spinner.stop();
    const isMdError = err instanceof Md2PdfError || err?.name === 'Md2PdfError' || err?.code?.startsWith('ERR_');
    if (isMdError) {
      renderCliError(err, options as any);
    } else {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_UNKNOWN', 'Conversion Failed', err.message);
      } else {
        spinner.stop();
        console.error(pc.red('✖') + ' ' + pc.red(err.message));
        if (options.debug && err.stack) console.error(pc.dim(err.stack));
        process.exitCode = EXIT.USAGE_ERROR;
      }
    }
  } finally {
    process.removeListener('SIGINT', sigintHandler);
    await cleanup();
    if (hasErrors && (process.exitCode === undefined || process.exitCode === EXIT.OK)) {
      process.exitCode = EXIT.USAGE_ERROR;
    } else if (process.exitCode === undefined) {
      process.exitCode = EXIT.OK;
    }
  }
}

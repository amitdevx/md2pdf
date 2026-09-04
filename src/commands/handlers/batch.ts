/**
 * Batch conversion handler.
 * Extracted from convert.ts — handles the concurrent worker pool for batch markdown → PDF.
 * All logic mirrors the original convert.ts batch flow exactly.
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ora from 'ora';
import pc from 'picocolors';
import { convert } from '../../core/index.js';
import { mergeConfig } from '../../config/merge.js';
import { EXIT, jsonOut, renderCliError, SpinnerLike, noopSpinner, emitJsonErrorAndExit } from '../../cli/formatter.js';
import { Md2PdfError } from '../../errors/index.js';
import { detectBrowserError } from '../../errors/detect.js';
import { computeHash, checkCache } from '../../cache/index.js';
import { buildVaultIndex, sortDependencies } from '../../core/vault.js';

export async function handleBatch(
  inputs: string[],
  options: any,
  cliFlags: any,
  resolvedConfig: any,
  validationResult?: any
): Promise<void> {
  const startTime = Date.now();
  const spinner: SpinnerLike = (options.jsonErrors || options.quiet)
    ? noopSpinner
    : ora('Starting batch conversion...').start() as unknown as SpinnerLike;

  let globalBrowser: any;
  let globalMermaidContext: any;
  let globalMermaidPage: any;
  let mermaidInitPromise: Promise<void> | null = null;
  let globalBrowserPromise: Promise<any> | null = null;

  const cleanup = async () => {
    if (mermaidInitPromise) await mermaidInitPromise.catch(() => {});
    if (globalBrowserPromise) {
      const b = await globalBrowserPromise.catch(() => null);
      if (b) await b.close().catch(() => {});
    }
    if (globalMermaidContext) await globalMermaidContext.close().catch(() => {});
    if (globalBrowser) await globalBrowser.close().catch(() => {});
    try {
      const { forceClose } = await import('../../pdf/daemon.js');
      await forceClose();
    } catch { /* ignore */ }
  };

  let isShuttingDown = false;
  const sigintHandler = async () => {
    isShuttingDown = true;
    console.log(pc.yellow('\n⚠ Process interrupted by user. Cleaning up...'));
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

  try {
    const { getBrowser } = await import('../../pdf/browser.js');

    const hasMermaidAnywhere = await Promise.all(inputs.map(input => {
      return new Promise<boolean>(resolve => {
        const stream = fs.createReadStream(input, { encoding: 'utf-8', highWaterMark: 65536 });
        stream.on('data', chunk => {
          if ((chunk as string).includes('```mermaid')) {
            stream.destroy();
            resolve(true);
          }
        });
        stream.once('error', () => resolve(false));
        stream.once('end', () => resolve(false));
      });
    })).then(r => r.some(Boolean));

    if (hasMermaidAnywhere) {
      if (!globalBrowserPromise) {
        globalBrowserPromise = getBrowser().then(b => { globalBrowser = b; return b; });
      }
      mermaidInitPromise = (async () => {
        await globalBrowserPromise;
        if (!globalBrowser) throw new Error('Failed to initialize browser for Mermaid warmup');
        globalMermaidContext = await globalBrowser.newContext({ deviceScaleFactor: 2 });
        globalMermaidPage = await globalMermaidContext.newPage();
        const { fontCss } = await import('../../assets/fonts.js');
        await globalMermaidPage.setContent(`<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    ${fontCss}\n    body { font-family: 'Inter', sans-serif; }\n  </style>\n</head>\n<body></body>\n</html>`);
        await globalMermaidPage.evaluate(() => document.fonts.ready);
        try {
          const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/mermaid.min.js');
          await globalMermaidPage.addScriptTag({ path: scriptPath });
        } catch { /* fallback */ }
      })();
    }

    const concurrencyLimit = cliFlags.concurrency
      ? parseInt(cliFlags.concurrency as string)
      : Math.min(4, os.cpus().length);

    let completedCount = 0;
    const preValidationErrors: string[] = [];
    const results: any[] = new Array(inputs.length);
    if (validationResult?.errors) {
      for (const err of validationResult.errors) {
        const i = inputs.indexOf(err.input);
        if (i !== -1) {
          hasErrors = true;
          failedCount++;
          results[i] = { isError: true, error: err.error.reason || err.error.message, code: err.error.code || 'ERR_VALIDATION', outputPath: '-', pageCounts: 0, renderTimeMs: 0, warnings: [] };
          preValidationErrors.push(`✖ ${err.input} - ${err.error.reason || err.error.message}`);
          completedCount++;
        }
      }
    }
    const updateSpinner = () => {
      if (!options.jsonErrors && !options.quiet) {
        const percent = Math.round((completedCount / inputs.length) * 100);
        const elapsed = Date.now() - startTime;
        const avg = completedCount > 0 ? elapsed / completedCount : 0;
        const remainMs = avg * (inputs.length - completedCount);
        let remainStr = '';
        if (completedCount > 0) {
          if (remainMs > 60000) remainStr = ` ~${Math.round(remainMs / 60000)}m remaining`;
          else remainStr = ` ~${Math.round(remainMs / 1000)}s remaining`;
        }
        spinner.text = `Converting (${completedCount}/${inputs.length}) files [${percent}%]${remainStr}`;
      }
    };
    updateSpinner();

    const vaultIndex = buildVaultIndex(cliFlags.vaultRoot as string | undefined, inputs);
    inputs = sortDependencies(inputs, vaultIndex);

    const queue = inputs.map((inp, i) => ({ input: inp, i }));

    const worker = async () => {
      while (queue.length > 0 && !isShuttingDown) {
        if (results[queue[0].i]) {
          queue.shift();
          continue;
        }
        const { input, i } = queue.shift()!;
        const fileStartTime = Date.now();

        let output = cliFlags.output;
        if (output) {
          if (fs.existsSync(output) && fs.statSync(output).isDirectory()) {
            output = path.join(output, path.basename(input).replace(/\.md$/i, '.pdf'));
          } else {
            // In batch mode --output is always the dir
            output = path.join(output, path.basename(input).replace(/\.md$/i, '.pdf'));
          }
        } else {
          output = input.replace(/\.md$/i, '.pdf');
        }
        output = path.resolve(output as string);

        try {
          fs.mkdirSync(path.dirname(output), { recursive: true });
        } catch (dirErr: any) {
          if (dirErr.code !== 'EEXIST') {
            hasErrors = true;
            failedCount++;
            if (!options.jsonErrors && !options.quiet) {
              spinner.stop();
              console.error(pc.red(`✖ ${path.basename(input)} - Cannot create output directory: ${dirErr.message}`));
              spinner.start();
            }
            results[i] = { isError: true, error: `Cannot create output directory: ${dirErr.message}`, code: 'ERR_FS_MKDIR', outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] };
            completedCount++;
            updateSpinner();
            continue;
          }
        }

        const convertOptions = mergeConfig(resolvedConfig, options.profile, { ...cliFlags, input, output });

        const useCache = convertOptions.cache !== false;
        let rawContent = '';
        try {
          rawContent = fs.readFileSync(input, 'utf-8');
        } catch {
          const { Md2PdfError: E, Md2PdfErrorCode } = await import('../../errors/index.js');
          throw new E(Md2PdfErrorCode.ERR_PERMISSION_DENIED, 'Permission Denied', `Cannot read file '${input}': Permission denied.`, { markdownFile: input });
        }

        if (useCache && rawContent) {
          try {
            const fileHash = computeHash(rawContent, convertOptions);
            if (checkCache(input, fileHash, output as string)) {
              results[i] = { fromCache: true, outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] };
              if (!options.jsonErrors && !options.quiet) {
                completedCount++;
                updateSpinner();
                spinner.stop();
                console.log(pc.green(`✔ ${path.basename(output as string)} (cached)`));
                spinner.start();
              }
              successfulCount++;
              continue;
            }
          } catch { /* ignore cache errors */ }
        }

        if (!globalBrowserPromise) {
          globalBrowserPromise = getBrowser().then(b => { globalBrowser = b; return b; });
        }
        try {
          await globalBrowserPromise;
        } catch (err: any) {
          hasErrors = true;
          failedCount++;
          results[i] = { isError: true, error: `Browser launch failed: ${err.message}`, code: 'ERR_BROWSER_LAUNCH_FAILED', outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] };
          if (!options.jsonErrors && !options.quiet) {
            completedCount++;
            spinner.stop();
            console.error(pc.red(`✖ ${path.basename(input)} - Browser launch failed: ${err.message}`));
            spinner.start();
          }
          continue;
        }

        if (!globalBrowser) {
          hasErrors = true;
          failedCount++;
          results[i] = { isError: true, error: 'Browser launch failed: globalBrowser is null', code: 'ERR_BROWSER_LAUNCH_FAILED', outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] };
          completedCount++;
          continue;
        }

        const hasMermaid = rawContent.includes('```mermaid');
        if (hasMermaid) {
          if (!mermaidInitPromise) {
            mermaidInitPromise = (async () => {
              globalMermaidContext = await globalBrowser!.newContext({ deviceScaleFactor: 2 });
              globalMermaidPage = await globalMermaidContext.newPage();
              const { fontCss } = await import('../../assets/fonts.js');
              await globalMermaidPage.setContent(`<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    ${fontCss}\n    body { font-family: 'Inter', sans-serif; }\n  </style>\n</head>\n<body></body>\n</html>`);
              await globalMermaidPage.evaluate(() => document.fonts.ready);
              try {
                const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/mermaid.min.js');
                await globalMermaidPage.addScriptTag({ path: scriptPath });
              } catch { /* fallback */ }
            })();
          }
          await mermaidInitPromise;
        }

        convertOptions.sharedBrowser = globalBrowser;

        if (fs.existsSync(output as string) && !options.force) {
          skippedExistingCount++;
          results[i] = { isSkipped: true, outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [], skipReason: 'Existing PDF (use --force to overwrite)' };
          if (!options.jsonErrors && !options.quiet) {
            completedCount++;
            updateSpinner();
          }
          continue;
        }

        try {
          if (options.verbose && !options.jsonErrors) {
            spinner.stop();
            console.log(pc.dim(`\nℹ Starting conversion pipeline for: ${input}`));
            console.log(pc.dim(`ℹ Output target: ${output}`));
            spinner.start();
          }

          const result = await convert(convertOptions as any);
          result.renderTimeMs = Date.now() - fileStartTime;

          if (options.verbose && !options.jsonErrors) {
            spinner.stop();
            console.log(pc.dim(`ℹ Conversion completed in ${result.renderTimeMs}ms (Pages: ${result.pageCounts})`));
            spinner.start();
          }

          if (!options.jsonErrors && result.warnings.length > 0) {
            spinner.stop();
            result.warnings.forEach(w => console.warn(pc.yellow(`⚠ ${w}`)));
            spinner.start();
          }

          if (!options.jsonErrors && !options.quiet) {
            completedCount++;
            spinner.stop();
            const timing = result.fromCache ? '(cached)' : `${result.renderTimeMs}ms`;
            console.log(pc.green(`✔ ${path.basename(result.outputPath)} (${timing})`));
            updateSpinner();
            spinner.start();
          }

          successfulCount++;
          results[i] = result;
        } catch (err: any) {
          if (isShuttingDown) break;

          if (err?.code === 'ERR_PUBLISH_SKIPPED') {
            skippedPublishCount++;
            results[i] = { isSkipped: true, outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: ['Skipped: publish: false'], skipReason: 'publish: false' };
            if (!options.jsonErrors && !options.quiet) {
              spinner.stop();
              console.error(pc.dim(`➖ Skipped ${path.basename(input)} (publish: false)`));
              spinner.start();
              completedCount++;
              updateSpinner();
            }
            continue;
          }

          hasErrors = true;
          failedCount++;
          const rawMsg = err.reason || err.message || String(err);
          const cleanMsg = rawMsg.split('\n').slice(0, 3).join(' | ');

          if (!options.jsonErrors && !options.quiet) {
            spinner.stop();
            console.error(pc.red(`✖ ${path.basename(input)} - ${cleanMsg}`));
            spinner.start();
          }

          const md2Error = detectBrowserError(err, { markdownFile: input });
          // FIX: use err?.errorCode (Md2PdfError property) before falling back to err?.code
          results[i] = {
            isError: true,
            error: cleanMsg,
            code: err?.errorCode || err?.code || md2Error?.code || 'ERR_UNKNOWN',
            outputPath: output,
            pageCounts: 0,
            renderTimeMs: 0,
            warnings: []
          };

          if (!options.jsonErrors && !options.quiet) {
            completedCount++;
            updateSpinner();
          }
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrencyLimit, inputs.length) }, () => worker());
    const settledResults = await Promise.allSettled(workers);

    const anyErrors = results.some((r: any) => !r || r.isError)
      || settledResults.some(r => r.status === 'rejected');
    if (anyErrors) hasErrors = true;

    if (options.jsonErrors) {
      jsonOut({
        success: !hasErrors && (successfulCount > 0 || skippedExistingCount > 0 || skippedPublishCount > 0),
        ...(skippedExistingCount + skippedPublishCount > 0
          ? { skipped: skippedExistingCount + skippedPublishCount }
          : {}),
        results: results.map((r, index) => {
          const out: any = {
            input: inputs[index],
            output: r?.outputPath || '-',
            status: r?.isError ? 'error' : (r?.isSkipped ? 'skipped' : 'success'),
            pages: r?.pageCounts || 0,
            timeMs: r?.renderTimeMs || 0,
            warnings: r?.warnings || []
          };
          if (r?.isError) {
            out.error = { code: r?.code || 'ERR_UNKNOWN', reason: r?.error, title: 'Conversion Failed' };
          }
          if (r?.isSkipped) out.skipReason = r?.skipReason;
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

    if (hasErrors) process.exitCode = EXIT.USAGE_ERROR;

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
        const isUserError = err.code === 'ENOENT' || err.code === 'EACCES' || err.code === 'ERR_INVALID_THEME'
          || /not found/i.test(err.message || '') || /invalid/i.test(err.message || '');
        if (!isUserError) {
          console.error(pc.yellow('\nReport this issue on GitHub: https://github.com/amitdevx/md2pdf/issues 💖\n'));
        }
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

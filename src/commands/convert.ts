import { fileURLToPath } from "node:url";
import { convert } from '../core/index.js';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import fg from 'fast-glob';
import { loadConfig } from '../config/loader.js';
import { mergeConfig } from '../config/merge.js';
import { jsonOut, renderCliError, EXIT } from '../cli/formatter.js';
import type { CliOptions } from '../cli/options.js';
import { Md2PdfError } from '../errors/index.js';
import { detectBrowserError } from '../errors/detect.js';
import { buildVaultIndex, sortDependencies } from '../core/vault.js';
import { computeHash, checkCache } from '../core/cache.js';

  export async function runConvert(inputsRaw: string[], options: CliOptions) {
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
      if (options.jsonErrors) {
        jsonOut({ success: false, error: { code: 'ERR_NO_INPUT', title: 'Missing Input', reason: 'No input files found matching the provided arguments.' } });
      } else {
        console.error(pc.red('✖ No input files found matching the provided arguments.'));
      }
      process.exitCode = EXIT.USAGE_ERROR; return;
    }

    let resolvedConfig = {};

    try {
      const result = await loadConfig(process.cwd(), options.config);
      resolvedConfig = result.config;

    } catch (err: any) {
      console.error(pc.red(`\n✖ ${err.title || 'Config Error'}`));
      console.error(err.reason || err.message);
      process.exitCode = EXIT.USAGE_ERROR; return;
    }
    
    // Add output to cliFlags so mergeConfig maps them. We'll set input individually in the loop.
    const cliFlags = { ...options, output: options.output };
    
    const emitJsonErrorAndExit = (code: string, title: string, reason: string) => {
      jsonOut({
        success: false,
        error: { code, title, reason }
      });
      process.exitCode = EXIT.USAGE_ERROR; return;
    };

    const unsupported = ['browser', 'stdin', 'stdout', 'quiet', 'input'];
    for (const flag of unsupported) {
      if ((cliFlags as any)[flag]) {
        if (options.jsonErrors) {
          emitJsonErrorAndExit('ERR_UNSUPPORTED_OPTION', 'Unsupported Option', `The --${flag} option is not currently supported.`);
        } else {
          console.error(pc.red(`error: The --${flag} option is not currently supported.`));
          process.exitCode = EXIT.USAGE_ERROR; return;
        }
      }
    }
    
    if (cliFlags.vaultRoot && !fs.existsSync(cliFlags.vaultRoot)) {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_VAULT_ROOT_NOT_FOUND', 'Vault Root Not Found', `--vault-root '${cliFlags.vaultRoot}' does not exist.`);
      } else {
        console.error(pc.red(`✖ --vault-root '${cliFlags.vaultRoot}' does not exist.`));
        process.exitCode = EXIT.USAGE_ERROR; return;
      }
    }
    
    if ((cliFlags.tocDepth || cliFlags.tocTitle) && !cliFlags.toc) {
      if (!options.jsonErrors) {
        console.warn(pc.yellow('⚠  --toc-depth / --toc-title have no effect without --toc'));
      }
    }
    
    if (cliFlags.headerTemplate && !cliFlags.header) {
      if (!options.jsonErrors) {
        console.warn(pc.yellow('⚠  --header-template has no effect without --header'));
      }
    }

    if (cliFlags.footerTemplate && !cliFlags.footer) {
      if (!options.jsonErrors) {
        console.warn(pc.yellow('⚠  --footer-template has no effect without --footer'));
      }
    }

    const isBatch = inputs.length > 1;

    if (isBatch && options.output) {
      // If multiple inputs, --output must be a directory
      const outputStat = fs.existsSync(options.output) ? fs.statSync(options.output) : null;
      if (outputStat && !outputStat.isDirectory()) {
        if (options.jsonErrors) {
          emitJsonErrorAndExit('ERR_OUTPUT_IS_NOT_DIRECTORY', 'Output Must Be Directory', `Multiple inputs provided, but output '${options.output}' is a file.`);
          return;
        } else {
          console.error(pc.red(`✖ Output path '${options.output}' is a file, but multiple inputs were provided.`));
          console.error(pc.dim('  When converting multiple files, --output must be a directory.'));
          process.exitCode = EXIT.USAGE_ERROR; return;
        }
      }
      if (!outputStat) {
        fs.mkdirSync(options.output, { recursive: true });
      }
    } else if (!isBatch && options.output) {
      const outputStat = fs.existsSync(options.output) ? fs.statSync(options.output) : null;
      if (outputStat?.isDirectory()) {
        if (options.jsonErrors) {
          emitJsonErrorAndExit('ERR_INVALID_INPUT', 'Output is a Directory',
            `The output path '${options.output}' is a directory. Provide a file path, e.g. --output report.pdf`);
          return;
        } else {
          console.error(pc.red(`✖ Output path '${options.output}' is a directory, not a file.`));
          console.error(pc.dim('  Provide a full file path, e.g. --output report.pdf'));
          process.exitCode = EXIT.USAGE_ERROR; return;
        }
      }

      if (!path.extname(options.output)) {
        options.output += '.pdf';
        cliFlags.output = options.output;
      }
    }

    // Synchronous Validation Loop
    let hasErrors = false;
    let successfulCount = 0;
    let failedCount = 0;
    let skippedExistingCount = 0;
    let skippedPublishCount = 0;
    const validInputs: string[] = [];

    const reportError = (input: string, reason: string) => {
      hasErrors = true;
      failedCount++;
      if (!options.jsonErrors) {
        console.error(pc.red(`✖ ${input} - ${reason}`));
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
      if (predictedOutput && path.resolve(input) === path.resolve(predictedOutput)) {
        reportError(input, 'input and output cannot be the same file');
        continue;
      }

      if (predictedOutput) {
        if (fs.existsSync(predictedOutput) && fs.statSync(predictedOutput).isDirectory()) {
          predictedOutput = path.join(predictedOutput, path.basename(input).replace(/\.md$/i, '.pdf'));
        } else if (isBatch) {
          predictedOutput = path.join(predictedOutput, path.basename(input).replace(/\.md$/i, '.pdf'));
        } else if (!predictedOutput.toLowerCase().endsWith('.pdf')) {
          predictedOutput += '.pdf';
        }
      } else {
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
      process.exitCode = hasErrors ? EXIT.USAGE_ERROR : EXIT.OK; return;
    }

    interface SpinnerLike {
      start(): void;
      stop(): void;
      succeed(text?: string): void;
      warn(text?: string): void;
      fail(text?: string): void;
      info(text?: string): void;
      text: string;
    }

    const noopSpinner: SpinnerLike = {
      start: () => {}, stop: () => {}, succeed: () => {},
      warn: () => {}, fail: () => {}, info: () => {}, text: ''
    };

    const spinner: SpinnerLike = options.jsonErrors
      ? noopSpinner
      : ora(isBatch ? 'Starting batch conversion...' : 'Converting...').start() as unknown as SpinnerLike;
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
      try {
        const { forceClose } = await import('../pdf/daemon.js');
        await forceClose();
      } catch {
        // Ignore failure to close the daemon
      }
    };

    let isShuttingDown = false;
    // Graceful Shutdown Handler for Ctrl+C
    process.on('SIGINT', async () => {
      isShuttingDown = true;
      console.log(pc.yellow('\n⚠ Process interrupted by user. Cleaning up...'));
      await cleanup();
      process.exitCode = 130; return;
    });

    try {
      const { getBrowser } = await import('../pdf/browser.js');
      let mermaidInitPromise: Promise<void> | null = null;
      
      let globalBrowserPromise: Promise<import('playwright-core').Browser> | null = null;
      let hasMermaidAnywhere = false;
      if (isBatch) {
        
        // Fast heuristic check across all inputs to start Mermaid warmup early
        hasMermaidAnywhere = await Promise.all(inputs.map(input => {
          return new Promise<boolean>((resolve) => {
            const stream = fs.createReadStream(input, { encoding: 'utf-8', highWaterMark: 65536 });
            stream.once('data', (chunk) => { stream.destroy(); resolve((chunk as string).includes('```mermaid')); });
            stream.once('error', () => resolve(false));
            stream.once('end', () => resolve(false));
          });
        })).then(results => results.some(r => r));

        if (hasMermaidAnywhere) {
          if (!globalBrowserPromise) {
            globalBrowserPromise = getBrowser().then(async (b) => {
              globalBrowser = b;
              return b;
            });
          }
          mermaidInitPromise = (async () => {
            await globalBrowserPromise;
            if (!globalBrowser) throw new Error("Failed to initialize browser for Mermaid warmup");
            globalMermaidContext = await globalBrowser.newContext({ deviceScaleFactor: 2 });
            globalMermaidPage = await globalMermaidContext.newPage();
            const { fontCss } = await import('../assets/fonts.js');
            await globalMermaidPage.setContent(`<!DOCTYPE html>
<html>
<head>
  <style>
    ${fontCss}
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body></body>
</html>`);
            await globalMermaidPage.evaluate(() => document.fonts.ready);
            try {
              const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/mermaid.min.js');
              await globalMermaidPage.addScriptTag({ path: scriptPath });
            } catch {
              // Fallback
            }
          })();
        }
      }
      
      const concurrencyLimit = cliFlags.concurrency ? parseInt(cliFlags.concurrency as string) : Math.min(4, os.cpus().length);
      const results: any[] = new Array(inputs.length);
      let completedCount = 0;

      if (!options.jsonErrors && isBatch) {
        spinner.text = `Converting (0/${inputs.length}) files (Concurrency: ${concurrencyLimit})...`;
        (spinner as any).start();
      } else if (!options.jsonErrors && !isBatch) {
        spinner.text = 'Converting...';
        (spinner as any).start();
      }

      // Large Vault Handling: build index and sort in dependency order
      const vaultIndex = buildVaultIndex(cliFlags.vaultRoot as string | undefined, inputs);
      inputs = sortDependencies(inputs, vaultIndex);

      const queue = inputs.map((input, i) => ({ input, i }));

      const worker = async () => {
        while (queue.length > 0 && !isShuttingDown) {
          const { input, i } = queue.shift()!;
          
          let output = cliFlags.output;
          if (output) {
            if (fs.existsSync(output) && fs.statSync(output).isDirectory()) {
              output = path.join(output, path.basename(input).replace(/\.md$/i, '.pdf'));
            } else if (isBatch) {
              output = path.join(output, path.basename(input).replace(/\.md$/i, '.pdf'));
            } else if (!output.toLowerCase().endsWith('.pdf')) {
              output += '.pdf';
            }
          } else {
            output = input.replace(/\.md$/i, '.pdf');
          }
          output = path.resolve(output as string);

          try {
            const outDir = path.dirname(output as string);
            if (!fs.existsSync(outDir)) {
              fs.mkdirSync(outDir, { recursive: true });
            }
          } catch (dirErr: any) {
            hasErrors = true;
            failedCount++;
            if (!options.jsonErrors && isBatch) {
              (spinner as any).stop();
              console.error(pc.red(`✖ ${path.basename(input)} - Cannot create output directory: ${dirErr.message}`));
              (spinner as any).start();
            } else if (!options.jsonErrors && !isBatch) {
              spinner.fail(pc.red(`Cannot create output directory: ${dirErr.message}`));
              process.exitCode = EXIT.USAGE_ERROR; return;
            }
            results[i] = { isError: true, error: `Cannot create output directory: ${dirErr.message}`, code: 'ERR_FS_MKDIR', outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] };
            if (!options.jsonErrors && isBatch) {
              completedCount++;
              spinner.text = `Converting (${completedCount}/${inputs.length}) files (Concurrency: ${concurrencyLimit})...`;
            }
            continue;
          }

          const convertOptions = mergeConfig(resolvedConfig, options.profile, { ...cliFlags, input, output });
          
          // PRE-RENDER CACHE CHECK
          const useCache = convertOptions.cache !== false;
          let fileHash = '';
          let rawContent = '';
          try {
            rawContent = fs.readFileSync(input, 'utf-8');
          } catch {
             // If we can't read the file, let convert() handle it or fail here
             rawContent = '';
          }

          if (useCache && rawContent) {
            try {
              fileHash = computeHash(rawContent, convertOptions);
              if (checkCache(input, fileHash, output as string)) {
                results[i] = { fromCache: true, outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] };
                if (!options.jsonErrors && isBatch) {
                  completedCount++;
                  spinner.text = `Converting (${completedCount}/${inputs.length}) files (Concurrency: ${concurrencyLimit})...`;
                  (spinner as any).stop();
                  console.log(pc.green(`✔ ${path.basename(output as string)} (cached)`));
                  (spinner as any).start();
                } else if (!options.jsonErrors && !isBatch) {
                  spinner.succeed(pc.green(`${path.basename(output as string)} (cached)`));
                }
                successfulCount++;
                continue;
              }
            } catch {
              // Ignore cache check errors
            }
          }

          // Not cached. Check if it has mermaid.
          const hasMermaid = rawContent.includes('```mermaid');

          if (isBatch) {
            if (!globalBrowserPromise) {
              globalBrowserPromise = getBrowser().then(async (b) => {
                globalBrowser = b;
                return b;
              });
            }
            try {
              await globalBrowserPromise;
            } catch (err: any) {
              hasErrors = true;
              failedCount++;
              results[i] = { isError: true, error: `Browser launch failed: ${err.message}`, code: 'ERR_BROWSER_LAUNCH_FAILED', outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] };
              if (!options.jsonErrors && isBatch) {
                completedCount++;
                (spinner as any).stop();
                console.error(pc.red(`✖ ${path.basename(input)} - Browser launch failed: ${err.message}`));
                (spinner as any).start();
              }
              continue;
            }
            
            if (!globalBrowser) {
              hasErrors = true;
              failedCount++;
              results[i] = { isError: true, error: 'Browser launch failed: globalBrowser is null', code: 'ERR_BROWSER_LAUNCH_FAILED', outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] };
              if (!options.jsonErrors && isBatch) completedCount++;
              continue;
            }

            if (hasMermaid) {
              if (mermaidInitPromise) await mermaidInitPromise;
              
              if (!globalMermaidPage) {
                mermaidInitPromise = (async () => {
                  globalMermaidContext = await globalBrowser!.newContext({ deviceScaleFactor: 2 });
                  globalMermaidPage = await globalMermaidContext.newPage();
                  const { fontCss } = await import('../assets/fonts.js');
                  await globalMermaidPage.setContent(`<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    ${fontCss}\n    body { font-family: 'Inter', sans-serif; }\n  </style>\n</head>\n<body></body>\n</html>`);
                  await globalMermaidPage.evaluate(() => document.fonts.ready);
                  try {
                    const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/mermaid.min.js');
                    await globalMermaidPage.addScriptTag({ path: scriptPath });
                  } catch {
                    // Fallback
                  }
                })();
                await mermaidInitPromise;
              }
            }

            convertOptions.sharedBrowser = globalBrowser;
            if (globalMermaidPage) {
              convertOptions.sharedMermaidPage = globalMermaidPage;
            }
          }


          // For 25+ file batches without --force: skip existing files to prevent overwrite spam
          if (fs.existsSync(output as string)) {
            if (inputs.length >= 25 && !options.force) {
              skippedExistingCount++;
              results[i] = { isSkipped: true, outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [], skipReason: 'Existing PDF (use --force to overwrite)' };
              if (!options.jsonErrors && isBatch) {
                completedCount++;
                spinner.text = `Converting (${completedCount}/${inputs.length}) files (Concurrency: ${concurrencyLimit})...`;
              }
              continue;
            }
            // For <25 files: show yellow warning and proceed (matches v0.7.x behavior)
            if (!options.force && !options.jsonErrors) {
              (spinner as any).stop();
              console.warn(pc.yellow(`⚠ Warning: Output file '${output}' already exists and will be overwritten.`));
              if (isBatch) {
                spinner.text = `Converting (${completedCount}/${inputs.length}) files (Concurrency: ${concurrencyLimit})...`;
                (spinner as any).start();
              }
            }
          }

          try {
            if (options.verbose && !options.jsonErrors) {
              (spinner as any).stop();
              console.log(pc.dim(`\n[Verbose] Starting conversion pipeline for: ${input}`));
              console.log(pc.dim(`[Verbose] Output target: ${output}`));
              if (isBatch) (spinner as any).start();
            }
            
            const result = await convert(convertOptions as any);
            
            if (options.verbose && !options.jsonErrors) {
              (spinner as any).stop();
              console.log(pc.dim(`[Verbose] Conversion completed in ${result.renderTimeMs}ms (Pages: ${result.pageCounts})`));
              if (isBatch) (spinner as any).start();
            }
            
            if (!options.jsonErrors && result.warnings.length > 0) {
              (spinner as any).stop();
              result.warnings.forEach(w => console.warn(pc.red(`⚠ ${w}`)));
              if (isBatch) (spinner as any).start();
            }
            
            if (!options.jsonErrors && isBatch) {
              (spinner as any).stop();
              const timing = result.fromCache ? '(cached)' : `${result.renderTimeMs}ms`;
              console.log(pc.green(`✔ ${path.basename(result.outputPath)} (${timing})`));
              (spinner as any).start();
            }
            
            successfulCount++;
            results[i] = result;
          } catch (err: any) {
            if (isShuttingDown) break;
            
            if (err?.code === 'ERR_PUBLISH_SKIPPED') {
              skippedPublishCount++;
              results[i] = { isSkipped: true, outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: ['Skipped: publish: false'], skipReason: 'publish: false' };
              if (!options.jsonErrors) {
                (spinner as any).stop();
                console.log(pc.dim(`⏭ Skipped ${path.basename(input)} (publish: false)`));
                (spinner as any).start();
              }
              if (!options.jsonErrors && isBatch) {
                completedCount++;
                spinner.text = `Converting (${completedCount}/${inputs.length}) files (Concurrency: ${concurrencyLimit})...`;
              }
              continue;
            }
            hasErrors = true;
            failedCount++;
            // Use only the first line of the error message to avoid showing stack traces
            const rawMsg = (err.reason || err.message || String(err));
            const cleanMsg = rawMsg.split('\n')[0];
            const msg = `${path.basename(input)} - ${cleanMsg}`;
            
            if (!options.jsonErrors && isBatch) {
              (spinner as any).stop();
              console.error(pc.red(`✖ ${msg}`));
              (spinner as any).start();
            }
            const md2Error = detectBrowserError(err, { markdownFile: input });
            results[i] = { isError: true, error: rawMsg.split('\n')[0], code: md2Error.code, outputPath: output, pageCounts: 0, renderTimeMs: 0, warnings: [] };
          }
          
          if (!options.jsonErrors && isBatch) {
            completedCount++;
            spinner.text = `Converting (${completedCount}/${inputs.length}) files (Concurrency: ${concurrencyLimit})...`;
          }
        }
      };

      const workers = Array.from({ length: Math.min(concurrencyLimit, inputs.length) }, () => worker());
      await Promise.all(workers);

      if (options.jsonErrors) {
        jsonOut({
          success: !hasErrors && (successfulCount > 0 || skippedExistingCount > 0 || skippedPublishCount > 0),
          ...(skippedExistingCount + skippedPublishCount > 0 ? { skipped: skippedExistingCount + skippedPublishCount } : {}),
          results: results.map((r: any, index: number) => {
            if (!r) return { input: inputs[index], error: 'Process aborted before conversion', code: 'ERR_ABORTED' };
            return {
              input: inputs[index],
              output: r.outputPath,
              pages: r.pageCounts,
              timeMs: r.renderTimeMs,
              warnings: r.warnings,
              ...(r.isError ? { error: r.error, code: r.code } : {}),
              ...(r.isSkipped ? { skipped: true, skipReason: r.skipReason } : {})
            };
          })
        });
      } else {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        if (isBatch) {
          (spinner as any).stop();
          console.log(`\n${successfulCount} succeeded, ${failedCount} failed in ${totalTime}s`);
          if (skippedExistingCount > 0) {
            console.log(pc.yellow(`  ⚠ Skipped ${skippedExistingCount} existing PDFs (use --force to overwrite)`));
          }
          if (skippedPublishCount > 0) {
            console.log(pc.yellow(`  ⚠ Skipped ${skippedPublishCount} files (publish: false)`));
          }
        } else {
          if (hasErrors) {
            const res = results[0] as any;
            const errMsg = res?.isError ? res.error.split('\n')[0] : `Failed in ${totalTime}s`;
            const errStr = res?.isError ? `${path.basename(inputs[0])} - ${errMsg}` : errMsg;
            spinner.fail(pc.red(errStr));
          } else if (results[0]?.isSkipped) {
            spinner.info(pc.yellow(`Skipped ${path.basename(inputs[0])} (${results[0].skipReason})`));
          } else {
            const outDest = options.output ? ` (Saved to: ${options.output})` : '';
            spinner.succeed(pc.green(`Successfully converted ${inputs.length} file${inputs.length > 1 ? 's' : ''} in ${totalTime}s!${outDest}`));
          }
        }
      }
      
      if (hasErrors) {
        process.exitCode = EXIT.USAGE_ERROR;
      }

    } catch (err: any) {
      spinner.stop();

      const isMdError = err instanceof Md2PdfError || err?.name === 'Md2PdfError' || err?.code?.startsWith('ERR_');
      if (isMdError) {
        renderCliError(err, options);
      } else {
        if (options.jsonErrors) {
          emitJsonErrorAndExit('ERR_UNKNOWN', 'Conversion Failed', err.message);
        } else {
          spinner.fail(pc.red(err.message));

          // Don't show GitHub banner for known user-level exceptions
          const isUserError = err.code === 'ENOENT' || err.code === 'EACCES' || err.code === 'ERR_INVALID_THEME' || /not found/i.test(err.message || '') || /invalid/i.test(err.message || '');
          if (!isUserError) {
            console.error(pc.yellow(`\nReport this issue on GitHub: https://github.com/amitdevx/md2pdf/issues 💖\n`));
          }

          if (options.debug && err.stack) {
            console.error(pc.dim(err.stack));
          }
          process.exitCode = EXIT.USAGE_ERROR; return;
        }
      }
    } finally {
      await cleanup();
    }

  }

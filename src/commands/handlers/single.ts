/**
 * Single-file conversion handler.
 * Extracted from convert.ts — handles the fast-path for a single markdown → PDF.
 * All logic mirrors the original convert.ts single-file flow exactly.
 */
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import ora from 'ora';
import pc from 'picocolors';
import { convert } from '../../core/index.js';
import { mergeConfig } from '../../config/merge.js';
import { EXIT, jsonOut, renderCliError, SpinnerLike, noopSpinner, emitJsonErrorAndExit } from '../../cli/formatter.js';
import { Md2PdfError } from '../../errors/index.js';
import { computeHash, checkCache } from '../../cache/index.js';

export async function handleSingle(
  input: string,
  options: any,
  cliFlags: any,
  resolvedConfig: any,
  validationResult?: any
): Promise<void> {
  if (validationResult?.errors?.length > 0) {
    const err = validationResult.errors[0];
    if (options.jsonErrors) {
      jsonOut({ success: false, error: { code: err.error.code, title: err.error.title || 'Error', reason: err.error.reason || err.error.message } });
    } else {
      renderCliError(err.error, options);
    }
    process.exitCode = err.error.code === 'ERR_PATH_TRAVERSAL' ? 1 : (err.error.code === 'ERR_FILE_TOO_LARGE' || err.error.code === 'ERR_DOCUMENT_TOO_COMPLEX' ? 2 : 1);
    return;
  }
  let output = cliFlags.output;
  if (output) {
    if (fs.existsSync(output) && fs.statSync(output).isDirectory()) {
      output = path.join(output, path.basename(input).replace(/\.md$/i, '.pdf'));
    } else if (!output.toLowerCase().endsWith('.pdf')) {
      output += '.pdf';
    }
  } else {
    output = input.replace(/\.md$/i, '.pdf');
  }
  output = path.resolve(output as string);

  const convertOptions = mergeConfig(resolvedConfig, options.profile, { ...cliFlags, input, output });

  if (convertOptions.cache !== false) {
    try {
      const rawContent = fs.readFileSync(input, 'utf-8');
      if (rawContent) {
        const fileHash = computeHash(rawContent, convertOptions);
        if (checkCache(input, fileHash, output)) {
          if (options.jsonErrors) {
            jsonOut({ success: true, results: [{ input, output, pages: 0, timeMs: 0, warnings: [] }] });
          } else if (!options.quiet) {
            console.log(pc.green(`✔ ${path.basename(output)} (cached)`));
          }
          process.exitCode = EXIT.OK;
          return;
        }
      }
    } catch {
      // Silent fallback to full render path
    }
  }

  if (!options.jsonErrors) {
    try {
      const rawContent = fs.readFileSync(input, 'utf-8');
      const matter = (await import('gray-matter')).default;
      const parsed = matter(rawContent, {
        engines: {
          js: () => { throw new Error('JavaScript frontmatter (---js) is disabled. Use YAML frontmatter instead.'); }
        }
      });
      if (parsed.data?.publish === false) {
        if (!options.quiet) {
          console.info(pc.dim(`ℹ Skipped ${path.basename(input)} (publish: false)`));
        }
        process.exitCode = EXIT.OK;
        return;
      }
      // Cache the parsed frontmatter to avoid double-parsing in core
      options = { ...options, __preparsed: { data: parsed.data, content: parsed.content } };
    } catch {
      // If we can't read frontmatter here, let the pipeline handle it
    }
  }

  const spinner: SpinnerLike = (options.jsonErrors || options.quiet)
    ? noopSpinner
    : ora('Converting...').start() as unknown as SpinnerLike;

  const startTime = Date.now();
  let globalBrowser: any;
  let mermaidInitPromise: Promise<void> | null = null;
  let globalMermaidContext: any;
  let globalMermaidPage: any;
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

  try {
    const { getBrowser } = await import('../../pdf/browser.js');

    // Ensure output directory exists
    try {
      fs.mkdirSync(path.dirname(output), { recursive: true });
    } catch (dirErr: any) {
      if (dirErr.code !== 'EEXIST') throw dirErr;
    }

    // Check if output exists (--force not set)
    if (fs.existsSync(output) && !options.force) {
      if (!options.jsonErrors) {
        console.warn(pc.yellow(`⚠ Skipped: Output file '${output}' already exists (use --force to overwrite).`));
      }
      process.exitCode = EXIT.OK;
      return;
    }

    // Read raw content for mermaid check
    let rawContent = '';
    let hasMermaid = false;
    if (input !== '-') {
      try {
        rawContent = fs.readFileSync(input, 'utf-8');
      } catch {
        const { Md2PdfError: E, Md2PdfErrorCode } = await import('../../errors/index.js');
        throw new E(Md2PdfErrorCode.ERR_PERMISSION_DENIED, 'Permission Denied', `SINGLE-ERR Cannot read file '${input}': Permission denied.`, { markdownFile: input });
      }
      hasMermaid = rawContent.includes('```mermaid');
    }

    globalBrowserPromise = getBrowser().then(b => { globalBrowser = b; return b; });
    await globalBrowserPromise;
    if (hasMermaid) {
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
      await mermaidInitPromise;
    }

    convertOptions.sharedBrowser = globalBrowser;

    if (options.verbose && !options.jsonErrors) {
      spinner.stop();
      console.log(pc.dim(`\nℹ Starting conversion pipeline for: ${input}`));
      console.log(pc.dim(`ℹ Output target: ${output}`));
      spinner.start();
    }

    const result = await convert({ ...convertOptions, ...options.__preparsed ? { __preparsed: options.__preparsed } : {} } as any);
    result.renderTimeMs = Date.now() - startTime;

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

    if (options.jsonErrors) {
      jsonOut({
        success: true,
        results: [{ input, output: result.outputPath, status: 'success', pages: result.pageCounts, timeMs: result.renderTimeMs, warnings: result.warnings }]
      });
    } else {
      const outDest = options.output ? ` (Saved to: ${options.output})` : '';
      spinner.stop();
      console.log(pc.green('✔') + ' ' + pc.green(`Successfully converted 1 file in ${((Date.now() - startTime) / 1000).toFixed(1)}s!${outDest}`));
    }

    process.exitCode = EXIT.OK;
  } catch (err: any) {
    if (isShuttingDown) return;
    spinner.stop();

    if (err?.code === 'ERR_PUBLISH_SKIPPED') {
      if (options.jsonErrors) {
        jsonOut({ success: true, skipped: 1, results: [{ input, output, status: 'skipped', pages: 0, timeMs: 0, warnings: [], skipReason: 'publish: false' }] });
      } else {
        spinner.info(pc.yellow(`Skipped ${path.basename(input)} (publish: false)`));
      }
      process.exitCode = EXIT.OK;
      return;
    }

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
    if (process.exitCode === undefined) process.exitCode = EXIT.OK;
  }
}

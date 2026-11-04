/**
 * Single-file conversion handler.
 * Extracted from convert.ts - handles the fast-path for a single markdown → PDF.
 * All logic mirrors the original convert.ts single-file flow exactly.
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
import { registerShutdownHandler } from '../../core/shutdown.js';
import type { BrowserContext, Page } from 'playwright-core';
import type { CliOptions } from '../../cli/options.js';
import type { Md2PdfConfig } from '../../types/config.js';
import type { ValidationResult } from '../../validation/index.js';

export async function handleSingle(
  input: string,
  options: CliOptions,
  cliFlags: Record<string, unknown>,
  resolvedConfig: Md2PdfConfig,
  validationResult?: ValidationResult
): Promise<void> {
  if (validationResult?.errors && validationResult.errors.length > 0) {
    const err = validationResult.errors[0];
    if (options.jsonErrors) {
      jsonOut({ success: false, error: { code: err.error.code, title: err.error.title || 'Error', reason: err.error.reason || err.error.message } });
    } else {
      renderCliError(err.error, options);
    }
    process.exitCode = err.error.code === 'ERR_PATH_TRAVERSAL' ? 1 : (err.error.code === 'ERR_FILE_TOO_LARGE' || err.error.code === 'ERR_DOCUMENT_TOO_COMPLEX' ? 2 : 1);
    return;
  }
  let output = cliFlags.output as string | undefined;
  if (output) {
    if (fs.existsSync(output) && fs.statSync(output).isDirectory()) {
      output = path.join(output, path.basename(input).replace(/\.md$/i, '.pdf'));
    } else if (!output.toLowerCase().endsWith('.pdf')) {
      output += '.pdf';
    }
  } else {
    output = cliFlags.stdin ? path.resolve(process.cwd(), 'output.pdf') : input.replace(/\.md$/i, '.pdf');
  }
  output = path.resolve(output as string);


  const convertOptions = mergeConfig(resolvedConfig, options.profile, { ...cliFlags, input, output });

  try {
    fs.mkdirSync(path.dirname(output), { recursive: true });
  } catch (dirErr: unknown) {
    const dErr = dirErr as NodeJS.ErrnoException;
    if (dErr.code !== 'EEXIST') {
      const { Md2PdfError: DirError, Md2PdfErrorCode: DirErrorCode } = await import('../../errors/index.js');
      const err = new DirError(
        dErr.code === 'EACCES' ? DirErrorCode.ERR_PERMISSION_DENIED : DirErrorCode.ERR_OUTPUT_DIR_MISSING,
        'Cannot Create Output Directory',
        `Failed to create output directory '${path.dirname(output)}': ${dErr.message}`,
        { outputPath: output }
      );
      renderCliError(err, options);
      process.exit(EXIT.USAGE_ERROR);
    }
  }

  // Read rawContent once and reuse across early-validation, cache hashing, and mermaid checks
  let cachedRawContent: string | null = null;
  if (input !== '-') {
    try {
      cachedRawContent = fs.readFileSync(input, 'utf-8');
    } catch {
      cachedRawContent = null;
    }
  }

  // Early validation: parse YAML and check publish:false BEFORE launching the browser
  // This ensures ERR_CONFIG_ERROR / ERR_PUBLISH_SKIPPED are not shadowed by ERR_BROWSER_MISSING.
  {
    const rawContent = cachedRawContent;
    if (rawContent !== null) {
      const { Md2PdfError: EarlyError, Md2PdfErrorCode: EarlyCode } = await import('../../errors/index.js');
      const matter = (await import('gray-matter')).default;
      let parsed: { data: Record<string, unknown>; content: string } | undefined;
      let earlyError: Md2PdfError | null = null;
      try {
        const blockEngine = () => { throw new Error('JavaScript/CoffeeScript frontmatter engines are disabled. Use YAML frontmatter instead.'); };
        parsed = matter(rawContent, {
          engines: {
            js:           blockEngine,
            javascript:   blockEngine,
            coffee:       blockEngine,
            coffeescript: blockEngine,
            cson:         blockEngine,
          }
        }) as unknown as { data: Record<string, unknown>; content: string };
      } catch (yamlErr: unknown) {
        const yErr = yamlErr as Error;
        earlyError = new EarlyError(
          EarlyCode.ERR_CONFIG_ERROR,
          'Invalid Frontmatter',
          'Invalid frontmatter YAML: ' + (yErr.message || String(yErr)),
          { markdownFile: input }
        );
      }

      if (!earlyError && parsed?.data?.publish === false) {
        if (options.jsonErrors) {
          jsonOut({ success: true, skipped: 1, results: [{ input, output, status: 'skipped', pages: 0, timeMs: 0, warnings: [], skipReason: 'publish: false' }] });
        } else if (!options.quiet) {
          console.info(pc.dim(`➖ Skipped ${path.basename(input)} (publish: false)`));
        }
        process.exitCode = EXIT.OK;
        return;
      }

      if (!earlyError && parsed) {
        // Security: only accept built-in names from frontmatter (alphanumeric, hyphens, underscores).
        // Custom paths must come from config/flags, not document content.
        const SAFE_THEME_NAME = /^[a-zA-Z0-9_-]+$/;
        const rawFrontmatterTheme = parsed.data?.theme ? String(parsed.data.theme) : undefined;
        const safeFrontmatterTheme = rawFrontmatterTheme && SAFE_THEME_NAME.test(rawFrontmatterTheme) ? rawFrontmatterTheme : undefined;
        const themeName: string = safeFrontmatterTheme || options.theme || 'default';
        try {
          const { loadTheme } = await import('../../themes/loader.js');
          await loadTheme(themeName);
        } catch (themeErr: unknown) {
          const tErr = themeErr as Error;
          earlyError = new EarlyError(
            EarlyCode.ERR_INVALID_THEME,
            'Theme Load Error',
            `Failed to load theme "${themeName}": ${tErr.message}`,
            { markdownFile: input }
          );
        }
      }

      if (earlyError) {
        renderCliError(earlyError, options);
        return;
      }

      if (parsed) {
        options = { ...options, __preparsed: { data: parsed.data, content: parsed.content } };
      }
    }
  }


  if (fs.existsSync(output) && !options.force) {
    if (options.jsonErrors) {
      jsonOut({ success: true, skipped: 1, results: [{ input, output, status: 'skipped', pages: 0, timeMs: 0, warnings: [], skipReason: 'output exists' }] });
    } else if (!options.quiet) {
      console.info(pc.dim(`➖ Skipped: Output file '${output}' already exists (use --force to overwrite).`));
    }
    process.exitCode = EXIT.OK;
    return;
  }

  if (convertOptions.cache !== false) {
    try {
      const rawContent = cachedRawContent;
      if (rawContent) {
        const fileHash = computeHash(rawContent, convertOptions);
        if (checkCache(input, fileHash, output)) {
          if (options.jsonErrors) {
            jsonOut({ success: true, results: [{ input, output, status: 'success', pages: 0, timeMs: 0, warnings: [] }] });
          } else if (!options.quiet) {
            console.log(pc.green(`✔ ${path.basename(output)} (cached)`));
          }
          process.exitCode = EXIT.OK;
          return;
        }
      }
    } catch {
      // Silent fallback
    }
  }

  const spinner: SpinnerLike = (options.jsonErrors || options.quiet)
    ? noopSpinner
    : ora('Converting...').start() as unknown as SpinnerLike;

  const startTime = Date.now();
  let sharedContext: BrowserContext | null = null;
  let sharedMermaidContext: BrowserContext | null = null;
  let globalMermaidPage: Page | null = null;
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

  const unregisterShutdown = registerShutdownHandler(async () => {
    isShuttingDown = true;
    if (!options.quiet && !options.jsonErrors) {
      console.log(pc.yellow('\n⚠ Process interrupted. Cleaning up...'));
    }
    spinner.stop();
    await cleanup();
  });

  try {




    // Reuse cached raw content for mermaid check
    let rawContent = '';
    let hasMermaid = false;
    if (input !== '-') {
      if (cachedRawContent === null) {
        const { Md2PdfError: E, Md2PdfErrorCode } = await import('../../errors/index.js');
        throw new E(Md2PdfErrorCode.ERR_PERMISSION_DENIED, 'Permission Denied', `SINGLE-ERR Cannot read file '${input}': Permission denied.`, { markdownFile: input });
      }
      rawContent = cachedRawContent;
      hasMermaid = rawContent.includes('```mermaid');
    }

    const { globalBrowserManager } = await import('../../core/browser-manager.js');
    
    // Check daemon first
    let daemonAlive = false;
    if (!process.env.MD2PDF_DAEMON) {
      const { isDaemonAlive } = await import('../../daemon/client.js');
      daemonAlive = await isDaemonAlive();
    }

    if (!daemonAlive) {
      const browser = await globalBrowserManager.acquireBrowser();
      sharedContext = await browser.newContext({ javaScriptEnabled: false });

      if (hasMermaid) {
        sharedMermaidContext = await browser.newContext({ deviceScaleFactor: 2 });
        globalMermaidPage = await sharedMermaidContext.newPage();
        const { fontCss } = await import('../../assets/fonts.js');
        await globalMermaidPage.setContent(`<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    ${fontCss}\n    body { font-family: 'Inter', sans-serif; }\n  </style>\n</head>\n<body></body>\n</html>`);
        await globalMermaidPage.evaluate(() => document.fonts.ready);
        try {
          const { getProjectRoot } = await import('../../utils/path.js');
          const scriptPath = path.join(getProjectRoot(), 'assets/mermaid.min.js');
          await globalMermaidPage.addScriptTag({ path: scriptPath });
        } catch (e) {
          console.error("FAILED TO LOAD MERMAID:", e);
        }
      }
    }

    if (sharedContext) {
      convertOptions.sharedContext = sharedContext;
    }
    if (globalMermaidPage) {
      convertOptions.sharedMermaidPage = globalMermaidPage;
    }

    if (options.verbose && !options.jsonErrors) {
      spinner.stop();
      console.log(pc.dim(`\nℹ Starting conversion pipeline for: ${input}`));
      console.log(pc.dim(`ℹ Output target: ${output}`));
      spinner.start();
    }

    const result = await convert({ ...convertOptions, ...(options.__preparsed ? { __preparsed: options.__preparsed } : {}) });
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
      if (!options.quiet) {
        console.log(pc.green('✔') + ' ' + pc.green(`Successfully converted 1 file in ${((Date.now() - startTime) / 1000).toFixed(1)}s!${outDest}`));
      }
    }

    process.exitCode = EXIT.OK;
  } catch (err: unknown) {
    if (isShuttingDown) return;
    spinner.stop();

    const errObj = err as { code?: string; message?: string; name?: string; stack?: string };
    if (errObj?.code === 'ERR_PUBLISH_SKIPPED') {
      if (options.jsonErrors) {
        jsonOut({ success: true, skipped: 1, results: [{ input, output, status: 'skipped', pages: 0, timeMs: 0, warnings: [], skipReason: 'publish: false' }] });
      } else {
        spinner.info(pc.dim(`➖ Skipped ${path.basename(input)} (publish: false)`));
      }
      process.exitCode = EXIT.OK;
      return;
    }

    const isMdError = err instanceof Md2PdfError || errObj?.name === 'Md2PdfError' || errObj?.code?.startsWith('ERR_');
    if (isMdError) {
      renderCliError(err as Md2PdfError, options);
    } else {
      if (options.jsonErrors) {
        emitJsonErrorAndExit('ERR_UNKNOWN', 'Conversion Failed', errObj.message || String(err));
      } else {
        spinner.stop();
        console.error(pc.red('✖') + ' ' + pc.red(errObj.message || String(err)));
        const isUserError = errObj.code === 'ENOENT' || errObj.code === 'EACCES' || errObj.code === 'ERR_INVALID_THEME'
          || /not found/i.test(errObj.message || '') || /invalid/i.test(errObj.message || '');
        if (!isUserError) {
          console.error(pc.yellow('\nReport this issue on GitHub: https://github.com/amitdevx/md2pdf/issues\n'));
        }
        if (options.debug && errObj.stack) console.error(pc.dim(errObj.stack));
        process.exitCode = EXIT.USAGE_ERROR;
      }
    }
  } finally {
    unregisterShutdown();
    await cleanup();
    if (process.exitCode === undefined) process.exitCode = EXIT.OK;
  }
}

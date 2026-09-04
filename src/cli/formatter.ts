import pc from 'picocolors';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import { getRecommendation } from '../errors/recommendations.js';
import type { CliOptions } from './options.js';

export const EXIT = {
  OK: 0,
  USAGE_ERROR: 1,
  ENVIRONMENT_ERROR: 2,
  INTERNAL_BUG: 3,
};

export function jsonOut(data: object) {
  const str = JSON.stringify(data, null, 2);
  process.stdout.write(str + '\n');
}

export function renderCliError(err: Md2PdfError, options: CliOptions) {
  if (options.jsonErrors) {
    jsonOut({
      success: false,
      results: [{
        input: err.context?.markdownFile || null,
        output: err.context?.outputPath || null,
        error: err.reason,
        code: err.code,
      }]
    });
    let code = EXIT.ENVIRONMENT_ERROR;
    if (err.code === Md2PdfErrorCode.ERR_UNKNOWN) code = EXIT.INTERNAL_BUG;
    if (err.code === Md2PdfErrorCode.ERR_INVALID_MARKDOWN || err.code === Md2PdfErrorCode.ERR_CONFIG_ERROR || err.code === Md2PdfErrorCode.ERR_INVALID_INPUT) code = EXIT.USAGE_ERROR;
    
    process.exitCode = code;
    return;
  }

  const rec = getRecommendation(err);
  
  console.error('\n' + pc.red(`✖  Error: ${err.title}`));
  console.error(`\n   ${err.reason}`);
  
  if (rec) {
    console.error(pc.yellow('\n   Reason:'));
    console.error(`   ${rec.summary}`);
    
    if (rec.commands.length > 0) {
      console.error(pc.green('\n   Recommendation:'));
      rec.commands.forEach(cmd => console.error(`     ${cmd}`));
    }
  }
  
  if (options.debug) {
    console.error(pc.dim('\n   --- DEBUG DIAGNOSTICS ---'));
    console.error(pc.dim(`   Error Code: ${err.code}`));
    console.error(pc.dim(`   Node: ${process.version} (${process.arch})`));
    console.error(pc.dim(`   OS: ${process.platform}`));
    console.error(pc.dim(`   PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'Not set'}`));
    if (err.originalError && (err.originalError as Error).stack) {
      console.error(pc.dim(`   ${(err.originalError as Error).stack!}`));
    }
    console.error(pc.dim('   -------------------------'));
  
  } else if (!options.verbose) {
    const hasUsefulDebug = err.originalError || err.code === Md2PdfErrorCode.ERR_UNKNOWN || err.code === Md2PdfErrorCode.ERR_BROWSER_LAUNCH_FAILED || err.code === Md2PdfErrorCode.ERR_MISSING_DEPENDENCIES;
    if (hasUsefulDebug) {
      console.error(pc.dim('\n   Run with --verbose or --debug for more information.'));
    }
  }

  
  console.error('');

  // Exit code mapping
  let code = EXIT.ENVIRONMENT_ERROR;
  if (err.code === Md2PdfErrorCode.ERR_UNKNOWN) code = EXIT.INTERNAL_BUG;
  if (err.code === Md2PdfErrorCode.ERR_INVALID_MARKDOWN || err.code === Md2PdfErrorCode.ERR_CONFIG_ERROR || err.code === Md2PdfErrorCode.ERR_INVALID_INPUT) code = EXIT.USAGE_ERROR;
  
  process.exitCode = code;
}

/** Minimal interface satisfied by both ora and the noop fallback. */
export interface SpinnerLike {
  start(): void;
  stop(): void;
  succeed(text?: string): void;
  warn(text?: string): void;
  fail(text?: string): void;
  info(text?: string): void;
  text: string;
}

/** Silent spinner used when --json-errors or --quiet is active. */
export const noopSpinner: SpinnerLike = {
  start: () => {}, stop: () => {}, succeed: () => {},
  warn: () => {}, fail: () => {}, info: () => {}, text: ''
};

/**
 * Emit a structured JSON error to stdout and exit immediately.
 * Used for pre-flight errors that occur before a file is being processed.
 */
export function emitJsonErrorAndExit(code: string, title: string, reason: string): never {
  jsonOut({ success: false, error: { code, title, reason } });
  let exitCode = EXIT.USAGE_ERROR;
  if (
    code === 'ERR_PERMISSION_DENIED' ||
    code === 'ERR_FILE_TOO_LARGE' ||
    code === 'ERR_DOCUMENT_TOO_COMPLEX'
  ) {
    exitCode = EXIT.ENVIRONMENT_ERROR;
  }
  process.exit(exitCode);
}

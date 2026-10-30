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

export function jsonOut(data: {
  schemaVersion?: number;
  success: boolean;
  results?: any[];
  error?: any;
  skipped?: number;
  [key: string]: any;
}) {
  const schemaVersion = 1;
  const success = data.success;
  
  // Format results array
  let results = data.results;
  if (!results) {
    if (data.error) {
      results = [{
        input: data.error.context?.markdownFile || null,
        output: data.error.context?.outputPath || null,
        error: data.error.reason || data.error.message || data.error,
        code: data.error.code || 'ERR_UNKNOWN'
      }];
    } else {
      results = [];
    }
  }

  // Format error object
  let error = data.error;
  if (!error && !success && results.length > 0) {
    const firstErr = results.find(r => r.error || r.code);
    if (firstErr) {
      error = {
        code: firstErr.code || 'ERR_UNKNOWN',
        title: firstErr.code || 'Error',
        reason: firstErr.error || 'An error occurred during conversion'
      };
    }
  }

  const payload: any = {
    schemaVersion,
    success,
    results,
    ...(error ? { error } : {}),
    ...(data.skipped !== undefined ? { skipped: data.skipped } : {})
  };

  const str = JSON.stringify(payload, null, 2);
  process.stdout.write(str + '\n');
}

export function renderCliError(err: Md2PdfError, options: CliOptions) {
  if (options.jsonErrors) {
    jsonOut({
      success: false,
      error: {
        code: err.code,
        title: err.title || 'Error',
        reason: err.reason || err.message
      },
      results: [{
        input: err.context?.markdownFile || null,
        output: err.context?.outputPath || null,
        error: err.reason || err.message,
        code: err.code,
      }]
    });
    let code = EXIT.ENVIRONMENT_ERROR;
    if (err.code === Md2PdfErrorCode.ERR_UNKNOWN) code = EXIT.INTERNAL_BUG;
    if (
      err.code === Md2PdfErrorCode.ERR_INVALID_MARKDOWN ||
      err.code === Md2PdfErrorCode.ERR_CONFIG_ERROR ||
      err.code === Md2PdfErrorCode.ERR_INVALID_INPUT ||
      err.code === Md2PdfErrorCode.ERR_INVALID_ARGUMENT ||
      err.code === Md2PdfErrorCode.ERR_NO_INPUT ||
      err.code === Md2PdfErrorCode.ERR_INVALID_BROWSER ||
      err.code === Md2PdfErrorCode.ERR_VAULT_ROOT_NOT_FOUND
    ) {
      code = EXIT.USAGE_ERROR;
    }
    if (
      err.code === Md2PdfErrorCode.ERR_BROWSER_MISSING ||
      err.code === Md2PdfErrorCode.ERR_BROWSER_LAUNCH_FAILED ||
      err.code === Md2PdfErrorCode.ERR_PERMISSION_DENIED ||
      err.code === Md2PdfErrorCode.ERR_INVALID_THEME ||
      err.code === Md2PdfErrorCode.ERR_NETWORK_TIMEOUT
    ) {
      code = EXIT.ENVIRONMENT_ERROR;
    }
    
    process.exitCode = code;
    return;
  }

  const rec = getRecommendation(err);
  
  console.error('');
  console.error(pc.red(`  ✖ Error: ${err.title}`));
  
  const reasonText = err.reason.split('\n').map(l => `    ${l}`).join('\n');
  console.error(reasonText);
  
  if (rec) {
    console.error('');
    console.error(pc.yellow('    Reason:'));
    const summaryText = rec.summary.split('\n').map(l => `      ${l}`).join('\n');
    console.error(summaryText);
    
    if (rec.commands.length > 0) {
      console.error('');
      console.error(pc.green('    Recommendation:'));
      rec.commands.forEach(cmd => console.error(`      ${cmd}`));
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
  if (err.code === Md2PdfErrorCode.ERR_BROWSER_MISSING || err.code === Md2PdfErrorCode.ERR_BROWSER_LAUNCH_FAILED || err.code === 'ERR_PERMISSION_DENIED' || err.code === 'ERR_INVALID_THEME') code = EXIT.ENVIRONMENT_ERROR;
  
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
    code === 'ERR_DOCUMENT_TOO_COMPLEX' ||
    code === 'ERR_BROWSER_MISSING' ||
    code === 'ERR_BROWSER_LAUNCH_FAILED' ||
    code === 'ERR_NETWORK_TIMEOUT'
  ) {
    exitCode = EXIT.ENVIRONMENT_ERROR;
  }
  process.exit(exitCode);
}

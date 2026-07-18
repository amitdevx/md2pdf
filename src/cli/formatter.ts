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
  if ((data as any).success === false && !(data as any).results) {
    process.stderr.write(str + '\n');
  } else {
    process.stdout.write(str + '\n');
  }
}

export function renderCliError(err: Md2PdfError, options: CliOptions) {
  if (options.jsonErrors) {
    jsonOut({
      success: false,
      error: {
        code: err.code,
        title: err.title,
        reason: err.reason,
        context: err.context
      }
    });
    process.exit(EXIT.ENVIRONMENT_ERROR);
  }

  const rec = getRecommendation(err);
  
  console.error('\n' + pc.dim('────────────────────────────────────────'));
  console.error(pc.red(`✖ ${err.title}`));
  console.error(err.reason);
  
  if (rec) {
    console.error(pc.yellow('\nReason'));
    console.error(rec.summary);
    
    if (rec.commands.length > 0) {
      console.error(pc.green('\nRecommendation'));
      rec.commands.forEach(cmd => console.error(`  ${cmd}`));
    }
  }

  console.error(pc.cyan(`\nError Code: ${err.code}`));
  
  if (options.debug) {
    console.error(pc.dim('\n--- DEBUG DIAGNOSTICS ---'));
    console.error(pc.dim(`Node: ${process.version} (${process.arch})`));
    console.error(pc.dim(`OS: ${process.platform}`));
    console.error(pc.dim(`PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'Not set'}`));
    if (err.originalError && (err.originalError as Error).stack) {
      console.error(pc.dim((err.originalError as Error).stack!));
    }
    console.error(pc.dim('-------------------------'));
  } else if (!options.verbose) {
    console.error(pc.dim('\nRun with --verbose or --debug for more information, or try `md2pdf doctor`'));
  }
  
  console.error(pc.dim('────────────────────────────────────────\n'));

  // Exit code mapping
  let code = EXIT.ENVIRONMENT_ERROR;
  if (err.code === Md2PdfErrorCode.ERR_UNKNOWN) code = EXIT.INTERNAL_BUG;
  if (err.code === Md2PdfErrorCode.ERR_INVALID_MARKDOWN) code = EXIT.USAGE_ERROR;
  
  process.exitCode = code;
  process.exit(code);
}

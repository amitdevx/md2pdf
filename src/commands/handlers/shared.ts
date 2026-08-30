/**
 * Shared types and helpers used by both single.ts and batch.ts handlers.
 */
import pc from 'picocolors';
import { EXIT, jsonOut } from '../../cli/formatter.js';

export interface SpinnerLike {
  start(): void;
  stop(): void;
  succeed(text?: string): void;
  warn(text?: string): void;
  fail(text?: string): void;
  info(text?: string): void;
  text: string;
}

export const noopSpinner: SpinnerLike = {
  start: () => {}, stop: () => {}, succeed: () => {},
  warn: () => {}, fail: () => {}, info: () => {}, text: ''
};

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

export enum Md2PdfErrorCode {
  // Core
  ERR_BROWSER_MISSING = 'ERR_BROWSER_MISSING',
  ERR_BROWSER_LAUNCH_FAILED = 'ERR_BROWSER_LAUNCH_FAILED',
  ERR_MISSING_DEPENDENCIES = 'ERR_MISSING_DEPENDENCIES',
  ERR_SANDBOX = 'ERR_SANDBOX',
  ERR_PERMISSION_DENIED = 'ERR_PERMISSION_DENIED',
  ERR_OUT_OF_MEMORY = 'ERR_OUT_OF_MEMORY',
  ERR_UNSUPPORTED_ARCH = 'ERR_UNSUPPORTED_ARCH',
  ERR_NETWORK_TIMEOUT = 'ERR_NETWORK_TIMEOUT',

  // I/O & Configuration
  ERR_OUTPUT_DIR_MISSING = 'ERR_OUTPUT_DIR_MISSING',
  ERR_INVALID_MARKDOWN = 'ERR_INVALID_MARKDOWN',
  ERR_CONFIG_ERROR = 'ERR_CONFIG_ERROR',
  ERR_PUBLISH_SKIPPED = 'ERR_PUBLISH_SKIPPED',
  ERR_FILE_TOO_LARGE = 'ERR_FILE_TOO_LARGE',
  ERR_INVALID_INPUT = 'ERR_INVALID_INPUT',
  ERR_PATH_TRAVERSAL = 'ERR_PATH_TRAVERSAL',

  // Future-proofing
  ERR_INVALID_THEME = 'ERR_INVALID_THEME',
  ERR_PLUGIN_FAILURE = 'ERR_PLUGIN_FAILURE',
  ERR_FONT_MISSING = 'ERR_FONT_MISSING',
  ERR_REMOTE_ASSET_FAILED = 'ERR_REMOTE_ASSET_FAILED',

  // Fallback
  ERR_UNKNOWN = 'ERR_UNKNOWN'
}

export interface ErrorContext {
  browserPath?: string;
  missingLibraries?: string[];
  outputPath?: string;
  markdownFile?: string;
  platform?: string;
  [key: string]: any;
}

export class Md2PdfError extends Error {
  public code: Md2PdfErrorCode;
  public title: string;
  public reason: string;
  public context: ErrorContext;
  public originalError?: Error | unknown;

  constructor(
    code: Md2PdfErrorCode,
    title: string,
    reason: string,
    context: ErrorContext = {},
    originalError?: Error | unknown
  ) {
    super(reason);
    this.name = 'Md2PdfError';
    this.code = code;
    this.title = title;
    this.reason = reason;
    this.context = context;
    this.originalError = originalError;
  }
}

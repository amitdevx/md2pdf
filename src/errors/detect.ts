import { Md2PdfError, Md2PdfErrorCode, ErrorContext } from './index.js';

export function detectBrowserError(error: unknown, contextBase: Partial<ErrorContext> = {}): Md2PdfError {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errStack = error instanceof Error ? error.stack || '' : '';
  const errName = error instanceof Error ? error.name : 'Unknown';
  
  const fullText = `${errName}: ${errMessage}\n${errStack}`;

  const context: ErrorContext = {
    platform: process.platform,
    ...contextBase
  };

  // 1. Missing Browser Executable
  if (fullText.match(/Executable doesn't exist/i) || fullText.match(/playwright install/i)) {
    return new Md2PdfError(
      Md2PdfErrorCode.ERR_BROWSER_MISSING,
      'Browser Missing',
      'The required Chromium browser executable could not be found.',
      context,
      error
    );
  }

  // 2. Missing Linux Dependencies
  const libMatch = fullText.match(/(lib[a-z0-9-]+\.so(?:\.[0-9]+)?)/i);
  if (fullText.match(/error while loading shared libraries/i) || libMatch) {
    if (libMatch) {
      context.missingLibraries = [libMatch[1]];
    }
    return new Md2PdfError(
      Md2PdfErrorCode.ERR_MISSING_DEPENDENCIES,
      'Missing System Dependencies',
      'The browser requires system libraries that are currently missing.',
      context,
      error
    );
  }

  // 3. Sandbox Issues
  if (fullText.match(/No usable sandbox/i) || fullText.match(/zygote/i)) {
    return new Md2PdfError(
      Md2PdfErrorCode.ERR_SANDBOX,
      'Sandboxing Failed',
      'The browser failed to start because OS sandboxing is unavailable or restricted.',
      context,
      error
    );
  }

  // 4. Out of Memory
  if (fullText.match(/ENOMEM/i) || fullText.match(/Cannot allocate memory/i)) {
    return new Md2PdfError(
      Md2PdfErrorCode.ERR_OUT_OF_MEMORY,
      'Out Of Memory',
      'The system does not have enough memory to launch the browser.',
      context,
      error
    );
  }

  // 5. Permission Denied
  if (fullText.match(/EACCES/i) || fullText.match(/Permission denied/i)) {
    return new Md2PdfError(
      Md2PdfErrorCode.ERR_PERMISSION_DENIED,
      'Permission Denied',
      'The browser executable cannot be accessed due to restrictive filesystem permissions.',
      context,
      error
    );
  }

  // 6. Unsupported Architecture
  if (fullText.match(/Exec format error/i) || fullText.match(/ELF/i)) {
    return new Md2PdfError(
      Md2PdfErrorCode.ERR_UNSUPPORTED_ARCH,
      'Unsupported Architecture',
      'The downloaded browser binary is incompatible with your CPU architecture.',
      context,
      error
    );
  }

  // 7. Network Timeout
  if (fullText.match(/ETIMEDOUT|ECONNRESET|ECONNREFUSED/i)) {
    return new Md2PdfError(
      Md2PdfErrorCode.ERR_NETWORK_TIMEOUT,
      'Network Connection Failed',
      'Failed to connect due to network timeout or reset.',
      context,
      error
    );
  }

  // 8. General Launch Failure (Fallback if it's a launch error but no specific reason matched)
  if (fullText.match(/browserType\.launch/i)) {
    return new Md2PdfError(
      Md2PdfErrorCode.ERR_BROWSER_LAUNCH_FAILED,
      'Browser Launch Failed',
      'The browser executable was found but crashed or failed to start.',
      context,
      error
    );
  }

  // 9. Unknown Error
  return new Md2PdfError(
    Md2PdfErrorCode.ERR_UNKNOWN,
    'Unknown Error',
    'An unexpected error occurred during PDF rendering.',
    context,
    error
  );
}

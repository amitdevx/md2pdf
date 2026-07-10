import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';

export function isMissingExecutableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Executable doesn't exist") || msg.includes("not found");
}

export async function getBrowser(): Promise<Browser> {
  const inCI = process.env.CI || process.env.DOCKER || !process.env.DISPLAY;
  const sandboxArgs = inCI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
  
  const launchOptions = {
    args: [...sandboxArgs, '--disable-gpu', '--js-flags="--max-old-space-size=256"'],
  };

  try {
    // 1. Try the system-installed Google Chrome
    return await chromium.launch({ ...launchOptions, channel: 'chrome' }); 
  } catch (err1) {
    if (!isMissingExecutableError(err1)) throw err1;

    try {
      // 2. Fallback to the system-installed Microsoft Edge (Windows default)
      return await chromium.launch({ ...launchOptions, channel: 'msedge' });
    } catch (err2) {
      if (!isMissingExecutableError(err2)) throw err2;

      try {
        // 3. Final attempt: Try Playwright's default downloaded Chromium 
        // (This only works if they explicitly ran your init command)
        return await chromium.launch(launchOptions);
      } catch (err3) {
        if (!isMissingExecutableError(err3)) throw err3;

        // 4. Genuine Executable Missing Error
        // Attach the original Playwright error context but append our tip for detect.ts
        if (err3 instanceof Error) {
          err3.message = err3.message + "\n💡 Tip: No compatible system browser found (Chrome or Edge). Please run `md2pdf init`.";
          throw err3;
        }
        
        throw new Error("Executable doesn't exist. No compatible system browser found. Please run `md2pdf init`.");
      }
    }
  }
}

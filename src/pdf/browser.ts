import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';

export async function getBrowser(): Promise<Browser> {
  const launchOptions = {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--js-flags="--max-old-space-size=256"'],
  };

  try {
    // 1. Try the system-installed Google Chrome
    return await chromium.launch({ ...launchOptions, channel: 'chrome' }); 
  } catch {
    try {
      // 2. Fallback to the system-installed Microsoft Edge (Windows default)
      return await chromium.launch({ ...launchOptions, channel: 'msedge' });
    } catch {
      try {
        // 3. Final attempt: Try Playwright's default downloaded Chromium 
        // (This only works if they explicitly ran your init command)
        return await chromium.launch(launchOptions);
      } catch {
        // 4. Graceful Error Handling
        throw new Error("Executable doesn't exist. No compatible system browser found (Chrome or Edge). Please run `md2pdf init`.");
      }
    }
  }
}

import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function isMissingExecutableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("Executable doesn't exist") || msg.includes("not found");
}

const CACHE_DIR = path.join(os.homedir(), '.md2pdf');
const CACHE_FILE = path.join(CACHE_DIR, 'browser-cache.json');

function readCache(): { channel?: string; default?: boolean; executablePath?: string } | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {
    // Ignore error
  }
  return null;
}

function writeCache(data: { channel?: string; default?: boolean; executablePath?: string }) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch {
    // Ignore error
  }
}

export async function getBrowser(): Promise<Browser> {
  const inCI = process.env.CI || process.env.DOCKER || !process.env.DISPLAY;
  const isRoot = process.getuid && process.getuid() === 0;
  const sandboxArgs = (inCI || isRoot) ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];
  
  const launchOptions = {
    args: [...sandboxArgs, '--disable-gpu', '--js-flags="--max-old-space-size=256"'],
  };

  const cached = readCache();
  if (cached) {
    try {
      if (cached.executablePath) {
        return await chromium.launch({ ...launchOptions, executablePath: cached.executablePath });
      } else if (cached.default) {
        return await chromium.launch(launchOptions);
      } else if (cached.channel) {
        return await chromium.launch({ ...launchOptions, channel: cached.channel });
      }
    } catch (err) {
      if (!isMissingExecutableError(err)) throw err;
      // If missing, continue to cascade
    }
  }

  try {
    const browser = await chromium.launch({ ...launchOptions, channel: 'chrome' }); 
    writeCache({ channel: 'chrome', executablePath: browser.browserType().executablePath() || process.env.PLAYWRIGHT_BROWSERS_PATH });
    return browser;
  } catch (err1) {
    if (!isMissingExecutableError(err1)) throw err1;

    try {
      const browser = await chromium.launch({ ...launchOptions, channel: 'msedge' });
      writeCache({ channel: 'msedge', executablePath: browser.browserType().executablePath() || process.env.PLAYWRIGHT_BROWSERS_PATH });
      return browser;
    } catch (err2) {
      if (!isMissingExecutableError(err2)) throw err2;

      try {
        const browser = await chromium.launch(launchOptions);
        writeCache({ default: true, executablePath: browser.browserType().executablePath() || process.env.PLAYWRIGHT_BROWSERS_PATH });
        return browser;
      } catch (err3) {
        if (!isMissingExecutableError(err3)) throw err3;

        if (err3 instanceof Error) {
          err3.message = err3.message + "\n💡 Tip: No compatible system browser found (Chrome or Edge). Please run `md2pdf init`.";
          throw err3;
        }
        
        throw new Error("Executable doesn't exist. No compatible system browser found. Please run `md2pdf init`.");
      }
    }
  }
}

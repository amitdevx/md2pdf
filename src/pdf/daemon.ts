import type { Browser } from 'playwright-core';
import { getBrowser } from './browser.js';

let warmBrowser: Browser | null = null;
let browserPromise: Promise<Browser> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_TIMEOUT_MS = 30_000; // Close browser after 30s of inactivity

export async function getWarmBrowser(): Promise<Browser> {
  // Reset idle timer
  if (idleTimer) clearTimeout(idleTimer);
  
  if (warmBrowser && warmBrowser.isConnected()) {
    return warmBrowser;
  }
  
  if (browserPromise) {
    return browserPromise;
  }
  
  browserPromise = getBrowser().then(browser => {
    warmBrowser = browser;
    browserPromise = null;
    // Auto-close after idle period
    warmBrowser.on('disconnected', () => { 
      warmBrowser = null; 
      browserPromise = null; 
    });
    return browser;
  });
  
  return browserPromise;
}

export function scheduleClose(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (warmBrowser?.isConnected()) {
      await warmBrowser.close();
      warmBrowser = null;
    }
  }, IDLE_TIMEOUT_MS);
  idleTimer.unref();
}

export async function forceClose(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  if (warmBrowser?.isConnected()) {
    await warmBrowser.close();
    warmBrowser = null;
  }
}

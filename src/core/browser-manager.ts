import type { Browser } from 'playwright-core';
import { getBrowser } from '../pdf/browser.js';

class BrowserManager {
  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;
  private activeJobCount = 0;
  private idleTimer: NodeJS.Timeout | null = null;
  private readonly IDLE_TIMEOUT_MS = 30_000;

  async acquireBrowser(): Promise<Browser> {
    this.activeJobCount++;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.browserPromise) {
      return this.browserPromise;
    }

    this.browserPromise = getBrowser().then(browser => {
      this.browser = browser;
      this.browserPromise = null;
      this.browser.on('disconnected', () => {
        this.browser = null;
        this.browserPromise = null;
      });
      return browser;
    });

    return this.browserPromise;
  }

  releaseBrowser(): void {
    this.activeJobCount = Math.max(0, this.activeJobCount - 1);
    if (this.activeJobCount === 0) {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(async () => {
        if (this.browser?.isConnected() && this.activeJobCount === 0) {
          await this.browser.close();
          this.browser = null;
        }
      }, this.IDLE_TIMEOUT_MS);
      this.idleTimer.unref();
    }
  }

  async forceClose(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.browser?.isConnected()) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export const globalBrowserManager = new BrowserManager();

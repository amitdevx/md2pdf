import { chromium } from 'playwright-core';
import type { Browser, LaunchOptions } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ─── Cache ───────────────────────────────────────────────────
const CACHE_DIR  = path.join(os.homedir(), '.md2pdf');
const CACHE_FILE = path.join(CACHE_DIR, 'browser-cache.json');

interface BrowserCache {
  executablePath?: string;
  channel?: string;
  browserName: string;
  md2pdfVersion: string;
}

export function readCache(): BrowserCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const c: BrowserCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    // Invalidate if the binary was uninstalled
    if (c.executablePath && !fs.existsSync(c.executablePath)) {
      fs.unlinkSync(CACHE_FILE); return null;
    }
    return c;
  } catch { return null; }
}

export function writeCache(data: BrowserCache): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch { /* non-fatal */ }
}

// ─── Platform discovery ───────────────────────────────────────
interface BrowserEntry { name: string; path?: string; channel?: string; }

export function getPlatformCandidates(): BrowserEntry[] {
  const p = process.platform;

  if (p === 'darwin') {
    const home = os.homedir();
    return [
      { name: 'Chrome',   path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
      { name: 'Brave',    path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' },
      { name: 'Edge',     path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
      { name: 'Arc',      path: '/Applications/Arc.app/Contents/MacOS/Arc' },
      { name: 'Opera',    path: '/Applications/Opera.app/Contents/MacOS/Opera' },
      { name: 'Vivaldi',  path: '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi' },
      { name: 'Chromium', path: '/Applications/Chromium.app/Contents/MacOS/Chromium' },
      // User-scoped installs
      { name: 'Chrome',   path: `${home}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` },
      { name: 'Brave',    path: `${home}/Applications/Brave Browser.app/Contents/MacOS/Brave Browser` },
    ];
  }

  if (p === 'win32') {
    const pf    = process.env['PROGRAMFILES']       ?? 'C:\\Program Files';
    const pfx86 = process.env['PROGRAMFILES(X86)']  ?? 'C:\\Program Files (x86)';
    const local = process.env['LOCALAPPDATA']        ?? '';
    return [
      { name: 'Chrome',   path: path.join(pf,    'Google','Chrome','Application','chrome.exe') },
      { name: 'Chrome',   path: path.join(pfx86, 'Google','Chrome','Application','chrome.exe') },
      { name: 'Chrome',   path: path.join(local, 'Google','Chrome','Application','chrome.exe') },
      { name: 'Edge',     path: path.join(pfx86, 'Microsoft','Edge','Application','msedge.exe') },
      { name: 'Edge',     path: path.join(pf,    'Microsoft','Edge','Application','msedge.exe') },
      { name: 'Brave',    path: path.join(pf,    'BraveSoftware','Brave-Browser','Application','brave.exe') },
      { name: 'Brave',    path: path.join(local, 'BraveSoftware','Brave-Browser','Application','brave.exe') },
      { name: 'Opera',    path: path.join(local, 'Programs','Opera','launcher.exe') },
      { name: 'Opera GX', path: path.join(local, 'Programs','Opera GX','launcher.exe') },
      { name: 'Vivaldi',  path: path.join(local, 'Vivaldi','Application','vivaldi.exe') },
      { name: 'Arc',      path: path.join(local, 'Arc','Arc.exe') },
      { name: 'Chromium', path: path.join(pf,    'Chromium','Application','chrome.exe') },
    ].filter(e => e.path && !e.path.startsWith('\\'));
  }

  // Linux + FreeBSD
  return [
    { name: 'Chrome',           path: '/usr/bin/google-chrome' },
    { name: 'Chrome Stable',    path: '/usr/bin/google-chrome-stable' },
    { name: 'Brave',            path: '/usr/bin/brave-browser' },
    { name: 'Edge Stable',      path: '/usr/bin/microsoft-edge-stable' },
    { name: 'Edge',             path: '/usr/bin/microsoft-edge' },
    { name: 'Opera',            path: '/usr/bin/opera' },
    { name: 'Vivaldi',          path: '/usr/bin/vivaldi' },
    { name: 'Vivaldi Stable',   path: '/usr/bin/vivaldi-stable' },
    { name: 'Chromium',         path: '/usr/bin/chromium-browser' },
    { name: 'Chromium',         path: '/usr/bin/chromium' },
    // Snap
    { name: 'Chromium (snap)',  path: '/snap/bin/chromium' },
    { name: 'Chrome (snap)',    path: '/snap/bin/google-chrome' },
    // Flatpak
    { name: 'Chromium (flatpak)', path: '/var/lib/flatpak/exports/bin/org.chromium.Chromium' },
    { name: 'Chrome (flatpak)',   path: '/var/lib/flatpak/exports/bin/com.google.Chrome' },
    { name: 'Brave (flatpak)',    path: '/var/lib/flatpak/exports/bin/com.brave.Browser' },
    // NixOS
    { name: 'Chromium (nix)',   path: '/run/current-system/sw/bin/chromium' },
  ];
}

export function discoverBrowser(): { executablePath: string; name: string } | null {
  // CHROME_PATH / BROWSER_PATH env override
  const envPath = process.env.CHROME_PATH ?? process.env.BROWSER_PATH;
  if (envPath && fs.existsSync(envPath)) return { executablePath: envPath, name: 'env override' };

  for (const candidate of getPlatformCandidates()) {
    if (candidate.path && fs.existsSync(candidate.path)) {
      return { executablePath: candidate.path, name: candidate.name };
    }
  }
  return null;
}

// ─── Launch ───────────────────────────────────────────────────
export function isMissingExecutableError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return msg.includes("executable doesn't exist") || msg.includes('not found');
}

export async function getBrowser(): Promise<Browser> {
  const isCI    = !!process.env.CI || !!process.env.DOCKER || !process.env.DISPLAY;
  const isRoot  = typeof process.getuid === 'function' && process.getuid() === 0;
  const sandbox = (isCI || isRoot) ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];

  const launchOpts: LaunchOptions = {
    args: [...sandbox, '--disable-gpu', '--js-flags=--max-old-space-size=256'],
  };

  // ── 0. Explicit --browser path ───────────────────────────────
  const cliPath = process.env.MD2PDF_BROWSER;
  if (cliPath) {
    if (!fs.existsSync(cliPath)) throw new Error(`Browser not found at '${cliPath}'`);
    return chromium.launch({ ...launchOpts, executablePath: cliPath });
  }

  // ── 1. Disk cache hit ─────────────────────────────────────────
  const cached = readCache();
  if (cached?.executablePath) {
    try {
      return await chromium.launch({ ...launchOpts, executablePath: cached.executablePath });
    } catch (e) {
      if (!isMissingExecutableError(e)) throw e;
      fs.unlinkSync(CACHE_FILE); // stale — clear and rediscover
    }
  }

  // ── 2. Platform discovery (O(1) fs.existsSync scan) ──────────
  const found = discoverBrowser();
  if (found) {
    try {
      const browser = await chromium.launch({ ...launchOpts, executablePath: found.executablePath });
      writeCache({ executablePath: found.executablePath, browserName: found.name, md2pdfVersion: process.env.npm_package_version ?? 'unknown' });
      return browser;
    } catch (e) {
      if (!isMissingExecutableError(e)) throw e;
      // Binary exists but won't launch (missing libs etc.) — fall through
    }
  }

  // ── 3. Playwright's own bundled Chromium (from md2pdf init) ──
  try {
    const browser = await chromium.launch(launchOpts);
    const exePath = chromium.executablePath();
    if (exePath) writeCache({ executablePath: exePath, browserName: 'Playwright Chromium', md2pdfVersion: process.env.npm_package_version ?? 'unknown' });
    return browser;
  } catch (e) {
    if (!isMissingExecutableError(e)) throw e;
    throw new Error(
      'No Chromium-based browser found.\n\n' +
      'Options:\n' +
      '  1. Install Chrome, Brave, Edge, Opera, Vivaldi, or Chromium\n' +
      '  2. Run `md2pdf init` to download a bundled browser\n' +
      '  3. Set CHROME_PATH=/path/to/browser in your environment\n' +
      '  4. Use MD2PDF_BROWSER=/path/to/browser before the command'
    );
  }
}

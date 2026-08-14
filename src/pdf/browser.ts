import { chromium } from 'playwright-core';
import type { Browser, LaunchOptions } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

function verifyChromiumEngine(executablePath: string): void {
  try {
    // Almost all browsers respond to --version
    const output = execSync(`"${executablePath}" --version`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000 // Don't let it hang
    }).toLowerCase();

    // ALLOWLIST: If the version string contains any of these, it's safe.
    const allowed = [
      'chrome', 'chromium', 'edge', 'brave', 'vivaldi', 'opera', 'arc', 'yandex',
      'whale', '360', 'baidu', 'sogou', 'jiosphere', 'thorium', 'ungoogled',
      'cromite', 'iridium', 'maxthon', 'slimjet', 'cent', 'avast', 'avg',
      'ccleaner', 'comodo', 'epic', 'iron', 'chedot', 'orbitum', 'colibri', 'sidekick'
    ];
    const isChromium = allowed.some(name => output.includes(name));

    if (!isChromium) {
      throw new Error(`ERR_UNSUPPORTED_ENGINE: The executable at '${executablePath}' does not appear to be a Chromium-based browser.\nOutput: ${output.trim()}\nmd2pdf requires Chromium engines (Chrome, Edge, Brave, etc.) to generate PDFs.`);
    }
  } catch (err: any) {
    if (err.message.includes('ERR_UNSUPPORTED_ENGINE')) throw err;
    // If it fails to run --version entirely, we let Playwright's 5-second timeout handle it.
  }
}

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
      { name: 'Chrome Beta', path: '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta' },
      { name: 'Chrome Dev', path: '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev' },
      { name: 'Chrome Canary', path: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary' },
      { name: 'Brave',    path: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser' },
      { name: 'Brave Nightly', path: '/Applications/Brave Browser Nightly.app/Contents/MacOS/Brave Browser Nightly' },
      { name: 'Edge',     path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
      { name: 'Edge Beta', path: '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta' },
      { name: 'Edge Dev', path: '/Applications/Microsoft Edge Dev.app/Contents/MacOS/Microsoft Edge Dev' },
      { name: 'Arc',      path: '/Applications/Arc.app/Contents/MacOS/Arc' },
      { name: 'Opera',    path: '/Applications/Opera.app/Contents/MacOS/Opera' },
      { name: 'Opera GX', path: '/Applications/Opera GX.app/Contents/MacOS/Opera GX' },
      { name: 'Vivaldi',  path: '/Applications/Vivaldi.app/Contents/MacOS/Vivaldi' },
      { name: 'Chromium', path: '/Applications/Chromium.app/Contents/MacOS/Chromium' },
      { name: 'Yandex',   path: '/Applications/Yandex.app/Contents/MacOS/Yandex' },
      { name: 'Whale',    path: '/Applications/Whale.app/Contents/MacOS/Whale' },
      { name: '360 Secure Browser', path: '/Applications/360Browser.app/Contents/MacOS/360Browser' },
      { name: 'Thorium',  path: '/Applications/Thorium.app/Contents/MacOS/Thorium' },
      { name: 'Ungoogled Chromium', path: '/Applications/Ungoogled Chromium.app/Contents/MacOS/Ungoogled Chromium' },
      { name: 'Iridium',  path: '/Applications/Iridium.app/Contents/MacOS/Iridium' },
      { name: 'Maxthon',  path: '/Applications/Maxthon.app/Contents/MacOS/Maxthon' },
      { name: 'Slimjet',  path: '/Applications/Slimjet.app/Contents/MacOS/Slimjet' },
      { name: 'Avast Secure Browser', path: '/Applications/Avast Secure Browser.app/Contents/MacOS/Avast Secure Browser' },
      { name: 'AVG Secure Browser', path: '/Applications/AVG Secure Browser.app/Contents/MacOS/AVG Secure Browser' },
      { name: 'CCleaner Browser', path: '/Applications/CCleaner Browser.app/Contents/MacOS/CCleaner Browser' },
      { name: 'Comodo Dragon', path: '/Applications/Comodo Dragon.app/Contents/MacOS/Comodo Dragon' },
      { name: 'Epic',     path: '/Applications/Epic.app/Contents/MacOS/Epic' },
      { name: 'SRWare Iron', path: '/Applications/Iron.app/Contents/MacOS/Iron' },
      { name: 'Colibri',  path: '/Applications/Colibri.app/Contents/MacOS/Colibri' },
      { name: 'Sidekick', path: '/Applications/Sidekick.app/Contents/MacOS/Sidekick' },
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
      { name: 'Chrome Beta', path: path.join(pf, 'Google','Chrome Beta','Application','chrome.exe') },
      { name: 'Chrome Dev', path: path.join(pf, 'Google','Chrome Dev','Application','chrome.exe') },
      { name: 'Chrome Canary', path: path.join(local, 'Google','Chrome SxS','Application','chrome.exe') },
      { name: 'Edge',     path: path.join(pfx86, 'Microsoft','Edge','Application','msedge.exe') },
      { name: 'Edge',     path: path.join(pf,    'Microsoft','Edge','Application','msedge.exe') },
      { name: 'Edge Beta', path: path.join(pfx86, 'Microsoft','Edge Beta','Application','msedge.exe') },
      { name: 'Edge Dev', path: path.join(pfx86, 'Microsoft','Edge Dev','Application','msedge.exe') },
      { name: 'Brave',    path: path.join(pf,    'BraveSoftware','Brave-Browser','Application','brave.exe') },
      { name: 'Brave',    path: path.join(local, 'BraveSoftware','Brave-Browser','Application','brave.exe') },
      { name: 'Brave Nightly', path: path.join(pf, 'BraveSoftware','Brave-Browser-Nightly','Application','brave.exe') },
      { name: 'Opera',    path: path.join(local, 'Programs','Opera','launcher.exe') },
      { name: 'Opera GX', path: path.join(local, 'Programs','Opera GX','launcher.exe') },
      { name: 'Vivaldi',  path: path.join(local, 'Vivaldi','Application','vivaldi.exe') },
      { name: 'Arc',      path: path.join(local, 'Arc','Arc.exe') },
      { name: 'Chromium', path: path.join(pf,    'Chromium','Application','chrome.exe') },
      { name: 'Yandex',   path: path.join(local, 'Yandex','YandexBrowser','Application','browser.exe') },
      { name: 'Whale',    path: path.join(local, 'Naver','Naver Whale','Application','whale.exe') },
      { name: '360',      path: path.join(pf,    '360','360Chrome','Chrome','Application','360chrome.exe') },
      { name: 'Baidu',    path: path.join(pf,    'Baidu','Baidu Browser','baidu.exe') },
      { name: 'Sogou',    path: path.join(local, 'SogouExplorer','SogouExplorer.exe') },
      { name: 'Thorium',  path: path.join(local, 'Thorium','Application','thorium.exe') },
      { name: 'Ungoogled', path: path.join(pf,   'Ungoogled Chromium','chrome.exe') },
      { name: 'Iridium',  path: path.join(local, 'Iridium','Application','iridium.exe') },
      { name: 'Maxthon',  path: path.join(pf,    'Maxthon5','Bin','Maxthon.exe') },
      { name: 'Slimjet',  path: path.join(pf,    'Slimjet','slimjet.exe') },
      { name: 'Cent',     path: path.join(local, 'CentBrowser','Application','chrome.exe') },
      { name: 'Avast',    path: path.join(pf,    'AVAST Software','Browser','Application','AvastBrowser.exe') },
      { name: 'AVG',      path: path.join(pf,    'AVG','Browser','Application','AVGBrowser.exe') },
      { name: 'CCleaner', path: path.join(pf,    'CCleaner Browser','Application','CCleanerBrowser.exe') },
      { name: 'Comodo',   path: path.join(pf,    'Comodo','Dragon','dragon.exe') },
      { name: 'Epic',     path: path.join(local, 'Epic Privacy Browser','Application','epic.exe') },
      { name: 'Iron',     path: path.join(pf,    'SRWare Iron','chrome.exe') },
      { name: 'Chedot',   path: path.join(local, 'Chedot','Application','chedot.exe') },
      { name: 'Orbitum',  path: path.join(local, 'Orbitum','Application','orbitum.exe') },
      { name: 'Colibri',  path: path.join(local, 'Colibri','Colibri.exe') },
      { name: 'Sidekick', path: path.join(local, 'Sidekick','Application','sidekick.exe') },
    ].filter(e => e.path && !e.path.startsWith('\\'));
  }

  // Linux + FreeBSD
  return [
    { name: 'Chrome',           path: '/usr/bin/google-chrome' },
    { name: 'Chrome Stable',    path: '/usr/bin/google-chrome-stable' },
    { name: 'Chrome Beta',      path: '/usr/bin/google-chrome-beta' },
    { name: 'Chrome Dev',       path: '/usr/bin/google-chrome-unstable' },
    { name: 'Brave',            path: '/usr/bin/brave-browser' },
    { name: 'Brave Nightly',    path: '/usr/bin/brave-browser-nightly' },
    { name: 'Edge Stable',      path: '/usr/bin/microsoft-edge-stable' },
    { name: 'Edge',             path: '/usr/bin/microsoft-edge' },
    { name: 'Edge Beta',        path: '/usr/bin/microsoft-edge-beta' },
    { name: 'Edge Dev',         path: '/usr/bin/microsoft-edge-dev' },
    { name: 'Opera',            path: '/usr/bin/opera' },
    { name: 'Opera GX',         path: '/usr/bin/opera-gx' },
    { name: 'Vivaldi',          path: '/usr/bin/vivaldi' },
    { name: 'Vivaldi Stable',   path: '/usr/bin/vivaldi-stable' },
    { name: 'Chromium',         path: '/usr/bin/chromium-browser' },
    { name: 'Chromium',         path: '/usr/bin/chromium' },
    { name: 'Yandex',           path: '/usr/bin/yandex-browser' },
    { name: 'Whale',            path: '/usr/bin/naver-whale' },
    { name: 'Thorium',          path: '/usr/bin/thorium-browser' },
    { name: 'Cromite',          path: '/usr/bin/cromite' },
    { name: 'Iridium',          path: '/usr/bin/iridium-browser' },
    { name: 'Maxthon',          path: '/usr/bin/maxthon' },
    { name: 'Slimjet',          path: '/usr/bin/flashpeak-slimjet' },
    { name: 'Cent',             path: '/usr/bin/centbrowser' },
    { name: 'Comodo',           path: '/usr/bin/comodo-dragon' },
    { name: 'Epic',             path: '/usr/bin/epic' },
    { name: 'Iron',             path: '/usr/bin/iron' },
    { name: 'Colibri',          path: '/usr/bin/colibri' },
    { name: 'Sidekick',         path: '/usr/bin/sidekick-browser' },
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
    
    verifyChromiumEngine(cliPath);

    try {
      return await chromium.launch({ ...launchOpts, executablePath: cliPath });
    } catch (err: any) {
      if (err.message.includes('Timeout')) {
        throw new Error(`ERR_CDP_TIMEOUT: Failed to connect to the browser at '${cliPath}'. Ensure it is a valid, Chromium-based browser.`);
      }
      throw err;
    }
  }

  // ── 1. Disk cache hit ─────────────────────────────────────────
  const cached = readCache();
  if (cached?.executablePath) {
    try {
      return await chromium.launch({ ...launchOpts, executablePath: cached.executablePath });
    } catch (e: any) {
      if (e.message?.includes('Timeout') || isMissingExecutableError(e)) {
        fs.unlinkSync(CACHE_FILE); // Stale, unsupported, or removed binary — clear and rediscover
      } else {
        throw e;
      }
    }
  }

  // ── 2. Platform discovery (O(1) fs.existsSync scan) ──────────
  const found = discoverBrowser();
  if (found) {
    try {
      const browser = await chromium.launch({ ...launchOpts, executablePath: found.executablePath });
      writeCache({ executablePath: found.executablePath, browserName: found.name, md2pdfVersion: process.env.npm_package_version ?? 'unknown' });
      return browser;
    } catch (e: any) {
      if (!e.message?.includes('Timeout') && !isMissingExecutableError(e)) {
        throw e;
      }
      // Binary exists but won't launch or timed out (e.g., Firefox overriding a Chromium path) — fall through
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

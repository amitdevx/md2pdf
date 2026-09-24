import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getCacheDir(): string {
  return process.env.MD2PDF_CACHE_DIR || path.join(os.homedir(), '.md2pdf', 'render-cache');
}

export function clearCache() {
  const md2pdfDir = getCacheDir();
  if (fs.existsSync(md2pdfDir)) {
    fs.rmSync(md2pdfDir, { recursive: true, force: true });
  }
}

function getCachePath(inputPath: string): string {
  let resolvedPath = path.resolve(inputPath);
  if (process.platform === 'win32' || process.platform === 'darwin') {
    resolvedPath = resolvedPath.toLowerCase();
  }
  const pathHash = crypto.createHash('sha256').update(resolvedPath).digest('hex');
  return path.join(getCacheDir(), pathHash);
}

export function computeHash(content: string, options: any): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  
  const stableOptions = { ...options };
  delete stableOptions.input;
  delete stableOptions.output;
  delete stableOptions.vaultRoot;
  delete stableOptions.sharedBrowser;
  delete stableOptions.sharedMermaidPage;
  delete stableOptions.__preparsed;
  
  hash.update(JSON.stringify(stableOptions));
  
  try {
    const pkgPath1 = path.resolve(__dirname, '../../package.json');
    const pkgPath2 = path.resolve(__dirname, '../package.json');
    const pkgPath = fs.existsSync(pkgPath1) ? pkgPath1 : pkgPath2;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    hash.update(pkg.version);
  } catch {
    hash.update('v0.9.8');
  }

  if (options.theme && options.theme !== 'default' && options.theme !== 'light' && options.theme !== 'dark') {
    try {
      if (fs.existsSync(options.theme)) {
        hash.update(fs.readFileSync(options.theme, 'utf-8'));
      }
    } catch { /* ignore */ }
  }

  return hash.digest('hex');
}

export function checkCache(inputPath: string, hash: string, outputPath: string): boolean {
  const cacheBase = getCachePath(inputPath);
  const metaFile = `${cacheBase}.json`;
  const pdfFile = `${cacheBase}.pdf`;

  if (!fs.existsSync(metaFile) || !fs.existsSync(pdfFile)) return false;

  try {
    const entry = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
    if (entry && entry.hash === hash) {
      fs.copyFileSync(pdfFile, outputPath);
      return true;
    }
  } catch {
    // Ignore invalid
  }
  return false;
}

export function updateCache(inputPath: string, hash: string, outputPath: string) {
  const dir = getCacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const cacheBase = getCachePath(inputPath);
  const metaFile = `${cacheBase}.json`;
  const pdfFile = `${cacheBase}.pdf`;

  const tmpMeta = metaFile + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  const tmpPdf = pdfFile + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';

  fs.copyFileSync(outputPath, tmpPdf);
  fs.writeFileSync(tmpMeta, JSON.stringify({ hash }, null, 2), 'utf-8');
  
  fs.renameSync(tmpPdf, pdfFile);
  fs.renameSync(tmpMeta, metaFile);
}

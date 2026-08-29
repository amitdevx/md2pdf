import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import os from 'node:os';

const CACHE_DIR = path.join(os.homedir(), '.md2pdf', 'render-cache');

interface CacheEntry {
  hash: string;
  output: string;
}

export function clearCache() {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }
}

function getCachePath(inputPath: string): string {
  let resolvedPath = path.resolve(inputPath);
  if (process.platform === 'win32' || process.platform === 'darwin') {
    resolvedPath = resolvedPath.toLowerCase();
  }
  const pathHash = crypto.createHash('sha256').update(resolvedPath).digest('hex');
  return path.join(CACHE_DIR, `${pathHash}.json`);
}

export function computeHash(content: string, options: any): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  // PERF-3: Hash only stable options, not output path or environment details
  const stableOptions = { ...options };
  delete stableOptions.input;
  delete stableOptions.output;
  delete stableOptions.vaultRoot;
  delete stableOptions.sharedBrowser;
  delete stableOptions.sharedMermaidPage;
  hash.update(JSON.stringify(stableOptions));
  return hash.digest('hex');
}

export function checkCache(inputPath: string, hash: string, outputPath: string): boolean {
  const cacheFile = getCachePath(inputPath);
  if (!fs.existsSync(cacheFile)) return false;
  try {
    const entry: CacheEntry = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    if (entry && entry.hash === hash) {
      if (entry.output === outputPath) {
        if (fs.existsSync(outputPath)) return true;
      } else {
        if (fs.existsSync(entry.output)) {
          fs.copyFileSync(entry.output, outputPath);
          updateCache(inputPath, hash, outputPath);
          return true;
        }
      }
    }
  } catch {
    // Ignore invalid cache files
  }
  return false;
}

export function updateCache(inputPath: string, hash: string, outputPath: string) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const cacheFile = getCachePath(inputPath);
  const tmpFile = cacheFile + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify({ hash, output: outputPath }, null, 2), 'utf-8');
  fs.renameSync(tmpFile, cacheFile);
}

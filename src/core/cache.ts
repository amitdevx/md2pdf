import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_DIR = '.md2pdf-cache';
const INDEX_FILE = path.join(CACHE_DIR, 'index.json');

interface CacheEntry {
  hash: string;
  output: string;
}

export function clearCache() {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  }
}

function loadCache(): Record<string, CacheEntry> {
  if (!fs.existsSync(INDEX_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(INDEX_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>) {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  fs.writeFileSync(INDEX_FILE, JSON.stringify(cache, null, 2), 'utf-8');
}

export function computeHash(content: string, options: any): string {
  const hash = crypto.createHash('sha256');
  hash.update(content);
  hash.update(JSON.stringify(options));
  return hash.digest('hex');
}

export function checkCache(inputPath: string, hash: string, outputPath: string): boolean {
  const cache = loadCache();
  const entry = cache[inputPath];
  if (entry && entry.hash === hash && entry.output === outputPath) {
    // Check if the output file actually exists
    if (fs.existsSync(outputPath)) {
      return true;
    }
  }
  return false;
}

export function updateCache(inputPath: string, hash: string, outputPath: string) {
  const cache = loadCache();
  cache[inputPath] = { hash, output: outputPath };
  saveCache(cache);
}

import { computeHash } from './dist/core/cache.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const input = path.resolve('test_cache.md');
const pathHash = crypto.createHash('sha256').update(input).digest('hex');
const cacheFile = path.join(process.env.HOME, '.md2pdf/render-cache', `${pathHash}.json`);
console.log('Cache file path:', cacheFile);
if (fs.existsSync(cacheFile)) {
  console.log('Cache file contents:', fs.readFileSync(cacheFile, 'utf-8'));
} else {
  console.log('Cache file does NOT exist!');
}

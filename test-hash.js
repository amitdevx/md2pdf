import { computeHash } from './dist/cache.js';
import fs from 'fs';
const rawContent = fs.readFileSync('/tmp/md2pdf_test/test1.md', 'utf-8');
const opts1 = { theme: 'github', margin: '20mm' };
const hash1 = computeHash(rawContent, opts1);
const opts2 = { theme: 'github', margin: '20mm', someNewThing: true };
const hash2 = computeHash(rawContent, opts2);
console.log('hash1:', hash1);
console.log('hash2:', hash2);

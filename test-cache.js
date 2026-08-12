const { checkCache, computeHash } = require('./dist/cache.js');
console.log(checkCache('/tmp/md2pdf_test/test1.md', 'somehash', '/tmp/md2pdf_test/out/test1.pdf'));

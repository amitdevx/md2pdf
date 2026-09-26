const fs = require('fs');

let core = fs.readFileSync('src/core/index.ts', 'utf-8');
core = core.replace(/require\('node:path'\)/g, '(await import(\'node:path\')).default');
core = core.replace(/let finalProcessedHtml/, 'const finalProcessedHtml');
fs.writeFileSync('src/core/index.ts', core);

let convert = fs.readFileSync('src/commands/convert.ts', 'utf-8');
// Fix TS2554: Expected 4-5 arguments, but got 6 in handleBatch or something?
// Wait, I deleted originalPaths from batch.ts! So handleBatch only takes 2 arguments now!
// Let me just restore batch.ts and convert.ts to their original states and fix them cleanly!

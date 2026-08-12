const fs = require('fs');
let code = fs.readFileSync('src/commands/convert.ts', 'utf-8');
code = code.replace(/output = input\.replace\(\/\\\.md\$\/i, '\.pdf'\);\n\s*\}\n/m, "output = input.replace(/\\.md$/i, '.pdf');\n          }\n          output = require('path').resolve(output);\n");
fs.writeFileSync('src/commands/convert.ts', code);

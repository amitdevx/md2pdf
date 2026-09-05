import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BRAIN_PATH = 'docs/brain.md';
let content = fs.readFileSync(BRAIN_PATH, 'utf-8');

const today = new Date().toISOString().split('T')[0];

// Update headers
content = content.replace(/Version: v[0-9\.]+/, 'Version: v0.9.1');
content = content.replace(/Last Updated: [0-9\-]+/, `Last Updated: ${today}`);
content = content.replace(/\| \*\*Version\*\* \| `[0-9\.]+` \|/, '| **Version** | `0.9.1` |');

// Helper to generate file dumps
function getFiles(dir, ext = '') {
  try {
    const output = execSync(`find ${dir} -type f -name "*${ext}" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/.tmp*" | sort`).toString();
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function generateDump(files) {
  let dump = '';
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const ext = path.extname(file).slice(1) || 'text';
    const code = fs.readFileSync(file, 'utf-8');
    dump += `### \`${file}\`\n\n\`\`\`${ext}\n${code}\n\`\`\`\n\n`;
  }
  return dump;
}

// Generate Tree
const tree = execSync('tree -I "node_modules|dist|.git|.md2pdf-cache|.tmp*" -L 4').toString();

// Generate Sections
const section3 = `## 3. Full File Tree\n\n\`\`\`text\n${tree}\`\`\`\n\n`;

const srcFiles = getFiles('src', '.ts');
const section4 = `## 4. Every Source File — Complete Code\n\n${generateDump(srcFiles)}`;

const testFiles = getFiles('tests', '.ts');
const section5 = `## 5. Every Test File — Complete Code\n\n${generateDump(testFiles)}`;

const configFiles = ['package.json', 'tsconfig.json', 'eslint.config.js', 'vitest.config.ts', 'CHANGELOG.md'];
const section6 = `## 6. Every Config File — Complete Contents\n\n${generateDump(configFiles)}`;

// Splice the content
const sec3Idx = content.indexOf('## 3. Full File Tree');
const sec7Idx = content.indexOf('## 7. Dependency Graph');

if (sec3Idx !== -1 && sec7Idx !== -1) {
  const before = content.slice(0, sec3Idx);
  const after = content.slice(sec7Idx);
  
  content = before + section3 + section4 + section5 + section6 + after;
}

fs.writeFileSync(BRAIN_PATH, content, 'utf-8');
console.log('brain.md upgraded to v0.9.1!');

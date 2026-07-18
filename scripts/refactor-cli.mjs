import fs from 'fs';

const cliIndex = fs.readFileSync('src/cli/index.ts', 'utf-8');
const lines = cliIndex.split('\n');

const optionsBlock = lines.slice(50, 79).join('\n').replace('interface CliOptions', 'export interface CliOptions');
fs.writeFileSync('src/cli/options.ts', optionsBlock + '\n');

const formatterImports = `import pc from 'picocolors';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import { getRecommendation } from '../errors/recommendations.js';
import type { CliOptions } from './options.js';

export const EXIT = {
  OK: 0,
  USAGE_ERROR: 1,
  ENVIRONMENT_ERROR: 2,
  INTERNAL_BUG: 3,
};
`;

const formatterBlock = lines.slice(79, 143).join('\n').replace('function jsonOut', 'export function jsonOut').replace('function renderCliError', 'export function renderCliError');
fs.writeFileSync('src/cli/formatter.ts', formatterImports + '\n' + formatterBlock + '\n');

const convertImports = `import { convert } from '../core/index.js';
import ora from 'ora';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import { loadConfig } from '../config/loader.js';
import { mergeConfig } from '../config/merge.js';
import { jsonOut, renderCliError, EXIT } from '../cli/formatter.js';
import type { CliOptions } from '../cli/options.js';
`;

let convertBlock = lines.slice(209, 574).join('\n');
convertBlock = convertBlock.replace('.action(async (inputsRaw: string[], options: CliOptions) => {', 'export async function runConvert(inputsRaw: string[], options: CliOptions) {');
convertBlock = convertBlock.substring(0, convertBlock.lastIndexOf(')')); // remove the closing parenthesis of .action
fs.mkdirSync('src/commands', { recursive: true });
fs.writeFileSync('src/commands/convert.ts', convertImports + '\n' + convertBlock + '\n');

let newIndexLines = [];
newIndexLines.push(...lines.slice(0, 15));
// skip 15 (ora), 16 (pc)
newIndexLines.push("import pc from 'picocolors';");
newIndexLines.push(...lines.slice(16, 21));
// skip 21-25 (errors, config)
newIndexLines.push(...lines.slice(25, 28));
// skip 28 (fast-glob)
// add imports
newIndexLines.push("import { runConvert } from '../commands/convert.js';");
newIndexLines.push("import type { CliOptions } from './options.js';");

// skip 29-35 (EXIT)
newIndexLines.push(...lines.slice(36, 50));
// skip 50-78 (options)
// skip 79-143 (formatter)
newIndexLines.push(...lines.slice(144, 209));
newIndexLines.push("  .action(runConvert);\n");

// Filter out the duplicated imports like `pc` if they exist in slice(16, 21), wait:
let finalIndex = newIndexLines.join('\n');
finalIndex = finalIndex
  .replace(/import ora from 'ora';\n/, '')
  .replace(/import fg from 'fast-glob';\n/, '')
  .replace(/import \{ convert \}.*\n/, '');

fs.writeFileSync('src/cli/index.ts', finalIndex);

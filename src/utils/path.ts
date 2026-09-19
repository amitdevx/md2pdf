import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export function getProjectRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));
  while (currentDir !== '/' && currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  throw new Error("Could not find project root");
}

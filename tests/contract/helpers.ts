import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

const resolveBrowserPath = (): string => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.env.MD2PDF_BROWSER) return process.env.MD2PDF_BROWSER;
  
  try {
    const cachePath = path.join(os.homedir(), '.md2pdf', 'browser-cache.json');
    if (fs.existsSync(cachePath)) {
      const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (cache && cache.executablePath) {
        return cache.executablePath;
      }
    }
  } catch {
    // Ignore error and fall back to empty string
  }
  return '';
};

export const CHROME_PATH = resolveBrowserPath();

export interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function runCli(args: string): CliResult {
  try {
    const env = { ...process.env };
    if (CHROME_PATH) {
      env.CHROME_PATH = CHROME_PATH;
    }
    const cliPath = path.resolve(process.cwd(), 'dist/cli/index.js');
    const stdout = execSync(`"${process.execPath}" "${cliPath}" ${args}`, {
      timeout: 30000,
      encoding: 'utf-8',
      env
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e: any) {
    return {
      status: e.status ?? 1,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? e.message ?? ''
    };
  }
}

export function runCliJson(args: string): { status: number; json: any; stderr: string } {
  const result = runCli(`${args} --json-errors`);
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    // Cannot parse
  }
  return { status: result.status, json, stderr: result.stderr };
}

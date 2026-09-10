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
      encoding: 'utf-8',
      env
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error: any) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? (error.message || ''),
    };
  }
}

/**
 * Runs the CLI with --json-errors and parses the output.
 */
export function runCliJson(args: string, envOverrides?: Record<string, string>): { status: number; json: any; stderr: string } {
  try {
    const env = { ...process.env, ...envOverrides };
    const CHROME_PATH = resolveBrowserPath();
    if (CHROME_PATH) {
      env.CHROME_PATH = CHROME_PATH;
    }
    const cliPath = path.resolve(process.cwd(), 'dist/cli/index.js');
    const stdout = execSync(`"${process.execPath}" "${cliPath}" ${args} --json-errors`, {
      encoding: 'utf-8',
      env
    });
    return { status: 0, json: JSON.parse(stdout), stderr: '' };
  } catch (e: any) {
    let json = null;
    try {
      json = JSON.parse(e.stdout);
    } catch {
      // Cannot parse
    }
    return { 
      status: e.status ?? 1, 
      json, 
      stderr: e.stderr ?? (e.message || '') 
    };
  }
}

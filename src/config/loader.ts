import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';


import * as yaml from 'js-yaml';
import { validateConfig } from './validate.js';
import type { Md2PdfConfig } from '../types/config.js';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';



const CONFIG_FILES = [
  'md2pdf.config.ts',
  'md2pdf.config.js',
  'md2pdf.config.mjs',
  '.md2pdf.json',
  '.md2pdfrc.json',
  '.md2pdfrc.yaml',
  '.md2pdfrc.yml'
];

export async function loadConfig(cwd = process.cwd(), explicitPath?: string): Promise<{ config: Md2PdfConfig, filepath: string | null }> {
  let filepath = explicitPath ? path.resolve(cwd, explicitPath) : null;

  if (!filepath) {
    let current = cwd;
    const root = path.parse(cwd).root;
    while (true) {
      for (const file of CONFIG_FILES) {
        const p = path.resolve(current, file);
        if (existsSync(p)) {
          filepath = p;
          break;
        }
      }
      if (filepath) break;
      
      const pkgPath = path.resolve(current, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          // We read it synchronously here to avoid async in the loop if we can,
          // but fs.readFile is async so we use await.
          const pkgData = await fs.readFile(pkgPath, 'utf8');
          const pkg = JSON.parse(pkgData);
          if (pkg.md2pdf) {
            filepath = pkgPath;
            break;
          }
        } catch {
          // ignore
        }
      }

      if (current === root) break;
      current = path.dirname(current);
    }
  }

  let rawConfig: any = {};

  if (filepath) {
    if (!existsSync(filepath)) {
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_CONFIG_ERROR,
        'Config File Not Found',
        `The specified config file does not exist: ${filepath}`,
        { configFile: filepath }
      );
    }

    try {
      const ext = path.extname(filepath);
      if (ext === '.json') {
        const parsed = JSON.parse(await fs.readFile(filepath, 'utf8'));
        if (path.basename(filepath) === 'package.json') {
          rawConfig = parsed.md2pdf || {};
        } else {
          rawConfig = parsed;
        }
      } else if (ext === '.yaml' || ext === '.yml') {
        rawConfig = yaml.load(await fs.readFile(filepath, 'utf8'));
      } else {
        const jiti = (await import('jiti')).default;
        const load = jiti(filepath, { interopDefault: true });
        rawConfig = load(filepath);
      }
    } catch (err: any) {
      throw new Md2PdfError(
        Md2PdfErrorCode.ERR_CONFIG_ERROR,
        'Config Load Error',
        `Failed to parse config file ${filepath}: ${err.message}`,
        { configFile: filepath },
        err
      );
    }
  }

  if (Object.keys(rawConfig).length === 0) {
    return { config: {}, filepath: null };
  }

  try {
    const validConfig = validateConfig(rawConfig);
    return { config: validConfig as Md2PdfConfig, filepath };
  } catch (err: any) {
    throw new Md2PdfError(
      Md2PdfErrorCode.ERR_CONFIG_ERROR,
      'Config Validation Error',
      `Invalid configuration in ${filepath}: ${err.message}`,
      { configFile: filepath },
      err
    );
  }
}

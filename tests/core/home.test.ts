import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { getMd2PdfHome } from '../../src/core/home.js';

describe('Home Directory Isolation (T1)', () => {
  const originalEnv = process.env.MD2PDF_HOME;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MD2PDF_HOME = originalEnv;
    } else {
      delete process.env.MD2PDF_HOME;
    }
  });

  it('defaults to ~/.md2pdf when MD2PDF_HOME is not set', () => {
    delete process.env.MD2PDF_HOME;
    expect(getMd2PdfHome()).toBe(path.join(os.homedir(), '.md2pdf'));
  });

  it('uses MD2PDF_HOME environment variable when set', () => {
    process.env.MD2PDF_HOME = '/custom/isolated/md2pdf';
    expect(getMd2PdfHome()).toBe('/custom/isolated/md2pdf');
  });
});

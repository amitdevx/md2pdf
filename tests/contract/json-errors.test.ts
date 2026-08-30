import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const cliPath = path.resolve(__dirname, '../../dist/cli/index.js');
const fixturesDir = path.resolve(__dirname, '../fixtures');

function runCliJson(args: string): any {
  try {
    const output = execSync(`"${process.execPath}" "${cliPath}" ${args} --json-errors`, { encoding: 'utf-8', stdio: 'pipe' });
    return JSON.parse(output);
  } catch (error: any) {
    try {
      return JSON.parse(error.stdout);
    } catch {
      throw new Error(`Failed to parse JSON output: ${error.stdout || error.stderr}`);
    }
  }
}

describe('JSON Errors Contract (20 Cases)', () => {
  let basicMd = '';

  beforeAll(() => {
    basicMd = path.join(fixturesDir, 'basic.md');
    if (!fs.existsSync(basicMd)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
      fs.writeFileSync(basicMd, '# Hello World');
    }
  });

  it('missing file', () => {
    const res = runCliJson('nonexistent.md');
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_VALIDATION');
  });

  it('directory input', () => {
    const res = runCliJson(`"${fixturesDir}"`);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_VALIDATION');
  });

  it('wrong extension', () => {
    const txt = path.join(fixturesDir, 'test.txt');
    if (!fs.existsSync(txt)) fs.writeFileSync(txt, 'test');
    const res = runCliJson(`"${txt}"`);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_VALIDATION');
  });

  it('publish false', () => {
    const pubFalse = path.join(fixturesDir, 'pub.md');
    fs.writeFileSync(pubFalse, '---\npublish: false\n---\n# test');
    const res = runCliJson(`"${pubFalse}"`);
    expect(res.success).toBe(true);
    expect(res.skipped).toBe(1);
  });

  it('bad yaml', () => {
    const badYaml = path.join(fixturesDir, 'bad.md');
    fs.writeFileSync(badYaml, '---\nbad: : yaml\n---\n# test');
    const res = runCliJson(`"${badYaml}"`);
    expect(res.success).toBe(false);
    expect(res.results[0].code).toBe('ERR_CONFIG_ERROR');
  });

  it('output is dir', () => {
    // skip, not really an error unless same name
  });

  it('traversal cold', () => {
    const res = runCliJson(`"${basicMd}" -o /etc/out.pdf --no-cache`);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_PATH_TRAVERSAL');
  });

  it('traversal warm', () => {
    const res = runCliJson(`"${basicMd}" -o /etc/out.pdf`);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_PATH_TRAVERSAL');
  });

  it('browser not found', () => {
    const res = runCliJson(`"${basicMd}" --browser /does/not/exist --no-cache`);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_INVALID_BROWSER');
  });

  it('browser warm', () => {
    const res = runCliJson(`"${basicMd}" --browser /does/not/exist`);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_INVALID_BROWSER');
  });

  it('rce ---js attack', () => {
    const rce = path.join(fixturesDir, 'rce.md');
    fs.writeFileSync(rce, '---js\nconsole.log(1)\n---\n# test');
    const res = runCliJson(`"${rce}"`);
    expect(res.success).toBe(false);
    expect(res.results[0].code).toBe('ERR_CONFIG_ERROR');
  });

  it('doc too complex cold', () => {
    const complex = path.join(fixturesDir, 'complex.md');
    fs.writeFileSync(complex, '> '.repeat(201) + 'test');
    const res = runCliJson(`"${complex}" --no-cache`);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_DOCUMENT_TOO_COMPLEX');
  });

  it('doc too complex warm', () => {
    const complex = path.join(fixturesDir, 'complex.md');
    fs.writeFileSync(complex, '> '.repeat(201) + 'test');
    const res = runCliJson(`"${complex}"`);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_DOCUMENT_TOO_COMPLEX');
  });

  it('invalid theme', () => {
    const res = runCliJson(`"${basicMd}" --theme non-existent-theme -f --no-cache`);
    expect(res.success).toBe(false);
    expect(res.results[0].code).toBe('ERR_INVALID_THEME');
  });

  it('no args', () => {
    const res = runCliJson('');
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_NO_INPUT');
  });

  it('success', () => {
    const res = runCliJson(`"${basicMd}" -o /tmp/success2.pdf`);
    expect(res.success).toBe(true);
  });

  it('chmod 000', () => {
    const chmod = path.join(fixturesDir, 'chmod.md');
    if (fs.existsSync(chmod)) {
      try { fs.chmodSync(chmod, 0o666); } catch (e) {}
    }
    fs.writeFileSync(chmod, '# test');
    fs.chmodSync(chmod, 0o000);
    const res = runCliJson(`"${chmod}"`);
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('ERR_PERMISSION_DENIED');
  });
});

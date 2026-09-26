import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

const fixturesDir = path.resolve(__dirname, '../fixtures-exit-codes');
import { runCli, isRoot } from './helpers';

describe('Exit Code Contract (27 Matrix Rows)', () => {
  afterAll(() => {
    const toDelete = ['batch/test.pdf', 'batch/test.md', 'batch', 'bad-yaml.md', 'bad.md', 'chmod.md', 'complex.md', 'large.md', 'pub-false.md', 'pub.md', 'rce.md', 'test.txt', 'temp.txt', 'temp_skip.md', 'bad_yaml.md', 'basic.pdf', 'bad-yaml.pdf', 'bad.pdf', 'pub-false.pdf', 'pub.pdf', 'complex.pdf', 'rce.pdf', 'large.pdf', 'test.pdf', 'empty_dir'];
    for (const file of toDelete) {
      try { 
        const p = path.join(fixturesDir, file);
        if (fs.existsSync(p)) {
          if (fs.statSync(p).isDirectory()) {
            fs.rmSync(p, { recursive: true, force: true });
          } else {
            fs.unlinkSync(p);
          }
        }
      } catch { /* ignore */ }
    }
  });
  let basicMd = '';

  beforeAll(() => {
    basicMd = path.join(fixturesDir, 'basic.md');
    if (!fs.existsSync(basicMd)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
      fs.writeFileSync(basicMd, '# Hello World');
    }
  });

  // USAGE ERRORS (Exit 1)
  it('1. No input -> exits 1', () => { expect(runCli('').status).toBe(1); });
  it('2. Missing file -> exits 1', () => { expect(runCli('missing-file-that-does-not-exist.md').status).toBe(1); });
  it('3. Directory with no Markdown -> exits 1', () => {
    const emptyDir = path.join(fixturesDir, 'empty_dir');
    if (!fs.existsSync(emptyDir)) fs.mkdirSync(emptyDir);
    expect(runCli(emptyDir).status).toBe(1);
  });
  it('4. Unsupported extension -> exits 1', () => {
    const txtFile = path.join(fixturesDir, 'temp.txt');
    fs.writeFileSync(txtFile, 'hello');
    expect(runCli(txtFile).status).toBe(1);
  });
  it('5. Input/output same path -> exits 1', () => { expect(runCli(`"${basicMd}" -o "${basicMd}"`).status).toBe(1); });
  it('6. Invalid paper -> exits 1', () => { expect(runCli(`"${basicMd}" --paper A3`).status).toBe(1); });
  it('7. Invalid margin -> exits 1', () => { expect(runCli(`"${basicMd}" --margin 20`).status).toBe(1); });
  it('8. Invalid Mermaid theme -> exits 1', () => { expect(runCli(`"${basicMd}" --mermaid-theme invalid-theme`).status).toBe(1); });
  it('9. Invalid Mermaid timeout -> exits 1', () => { expect(runCli(`"${basicMd}" --mermaid-timeout -5`).status).toBe(1); });
  it('10. Invalid concurrency -> exits 1', () => { expect(runCli(`"${basicMd}" --concurrency 0`).status).toBe(1); });
  it('11. Invalid TOC depth -> exits 1', () => { expect(runCli(`"${basicMd}" --toc-depth 10`).status).toBe(1); });
  it('12. Invalid split heading -> exits 1', () => { expect(runCli(`"${basicMd}" --split-by -1`).status).toBe(1); });
  it('13. Invalid max attachment size -> exits 1', () => { expect(runCli(`"${basicMd}" --max-attachment-size abc`).status).toBe(1); });
  it.skipIf(process.platform === 'win32')('14. Output is an invalid directory/file combination -> exits 1', () => { expect(runCli(`"${basicMd}" -o /dev/null/out.pdf`).status).toBe(1); });
  it.skipIf(process.platform === 'win32')('15. Trailing-slash output directory behavior -> exits 1 or creates', () => { expect(runCli(`"${basicMd}" -o "/does/not/exist/"`).status).toBeGreaterThanOrEqual(1); });
  it('16. Invalid browser arg -> exits 1', () => { expect(runCli(`"${basicMd}" --browser /does/not/exist`).status).toBeGreaterThanOrEqual(1); });
  it('17. Invalid vault root -> exits 1', () => { expect(runCli(`"${basicMd}" --vault-root /does/not/exist/vault`).status).toBe(1); });
  it.skipIf(process.platform === 'win32')('18. Path traversal -> exits 1', () => { expect(runCli(`"${basicMd}" -o /etc/out.pdf`).status).toBe(1); });
  it.skipIf(process.platform === 'win32')('19. Protected system directory -> exits 1', () => { expect(runCli(`"${basicMd}" -o /root/out.pdf`).status).toBe(1); });
  it('20. Invalid CLI argument -> exits 1', () => { expect(runCli(`"${basicMd}" --unknown-flag`).status).toBe(1); });
  it('21. Invalid configuration -> exits 1', () => {
    const badYaml = path.join(fixturesDir, 'bad-yaml.md');
    fs.writeFileSync(badYaml, '---\nbad: : yaml\n---\n# Test');
    expect(runCli(badYaml).status).toBe(1);
  });

  // RUNTIME / ENVIRONMENT ERRORS (Exit 2)
  it('22. File >30 MB -> exits 2', () => {
    const large = path.join(fixturesDir, 'large.md');
    if (!fs.existsSync(large)) { fs.writeFileSync(large, 'a'.repeat(31 * 1024 * 1024)); }
    expect(runCli(`"${large}"`).status).toBe(2);
  });
  it('23. Deeply nested document -> exits 2', () => {
    const complex = path.join(fixturesDir, 'complex.md');
    fs.writeFileSync(complex, '> '.repeat(201) + 'test');
    expect(runCli(`"${complex}"`).status).toBe(2);
  });
  it('24. Missing browser -> exits 2', () => { expect(runCli(`"${basicMd}" --browser /path/does/not/exist/for/browser --no-cache`).status).toBe(2); });
  it('25. Browser launch failure -> exits 2', () => { expect(runCli(`"${basicMd}" --browser "${basicMd}" --no-cache`).status).toBe(2); });
  it.skipIf(isRoot || process.platform === 'win32')('26. Permission denied -> exits 2', () => {
    const chmod = path.join(fixturesDir, 'chmod.md');
    if (fs.existsSync(chmod)) { try { fs.chmodSync(chmod, 0o666); } catch { /* ignore */ } }
    fs.writeFileSync(chmod, '# test');
    fs.chmodSync(chmod, 0o000);
    expect(runCli(`"${chmod}"`).status).toBe(2);
  });
  it('27. Invalid theme during conversion -> exits 2', () => { expect(runCli(`"${basicMd}" --theme non-existent-theme --no-cache -f`).status).toBe(2); });
});

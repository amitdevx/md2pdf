import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const cliPath = path.resolve(__dirname, '../../dist/cli/index.js');
const fixturesDir = path.resolve(__dirname, '../fixtures');

function runCli(args: string): { status: number; stdout: string; stderr: string } {
  try {
    const output = execSync(`node ${cliPath} ${args}`, { encoding: 'utf-8', stdio: 'pipe' });
    return { status: 0, stdout: output, stderr: '' };
  } catch (error: any) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

describe('CLI End-to-End Tests', () => {
  it('should fail on missing file with exit code 1', () => {
    const result = runCli('nonexistent.md');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Input file 'nonexistent.md' does not exist");
  });

  it('should fail on directory input with exit code 1', () => {
    const result = runCli(path.resolve(__dirname, '../../src'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is a directory, not a file');
  });

  it('should fail on non-.md input with exit code 1', () => {
    const tempTxt = path.resolve(__dirname, 'temp.txt');
    fs.writeFileSync(tempTxt, 'hello');
    const result = runCli(tempTxt);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is not a markdown file');
    fs.unlinkSync(tempTxt);
  });

  it('should fail on invalid --toc-depth with exit code 1', () => {
    const result = runCli(`README.md --toc-depth abc`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("error: option '--toc-depth <depth>' argument 'abc' is invalid.");
  });

  it('should fail on invalid --paper with exit code 1', () => {
    const result = runCli(`README.md --paper garbage`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("error: option '--paper <format>' argument 'garbage' is invalid.");
  });

  it('should fail on invalid --margin with exit code 1', () => {
    const result = runCli(`README.md --margin abc`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("error: option '--margin <margin>' argument 'abc' is invalid.");
  });

  it('should fail on same input and output with exit code 1', () => {
    const result = runCli(`README.md -o README.md`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Input and output cannot be the same file');
  });

  it('should fail on trailing slash output with exit code 1', () => {
    const result = runCli(`README.md -o /tmp/`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is a directory, not a file');
  });

  it('should exit with 1 on publish: false file', () => {
    const skipMd = path.resolve(__dirname, 'skip.md');
    fs.writeFileSync(skipMd, '---\npublish: false\n---\n# Title');
    const result = runCli(skipMd);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('publish: false');
    fs.unlinkSync(skipMd);
  });

  it('should exit with 1 on bad YAML frontmatter', () => {
    const badYaml = path.resolve(__dirname, 'bad-yaml.md');
    fs.writeFileSync(badYaml, '---\ntitle: [\n---\n# Title');
    const result = runCli(badYaml);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid Frontmatter');
    fs.unlinkSync(badYaml);
  });

  it('should successfully convert markdown to PDF with exit code 0', () => {
    const validMd = path.resolve(fixturesDir, 'basic.md');
    const outPdf = path.resolve(__dirname, 'out.pdf');
    const result = runCli(`${validMd} -o ${outPdf}`);
    expect(result.status).toBe(0);
    expect(fs.existsSync(outPdf)).toBe(true);
    if (fs.existsSync(outPdf)) fs.unlinkSync(outPdf);
  }, 30000);
});

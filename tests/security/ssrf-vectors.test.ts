import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { convert } from '../../src/core/index.js';

describe('SSRF Vector Regression Tests (S6)', () => {
  let server: http.Server;
  let serverPort: number;
  let requestCount = 0;
  let lastRequestedUrl = '';
  let tempDir: string;

  // 1x1 transparent PNG
  const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'md2pdf-ssrf-test-'));

    server = http.createServer((req, res) => {
      requestCount++;
      lastRequestedUrl = req.url || '';

      if (req.url === '/image.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(PNG_1X1);
      } else if (req.url === '/redirect-to-private') {
        res.writeHead(302, { Location: `http://127.0.0.1:${serverPort}/image.png` });
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          serverPort = address.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    requestCount = 0;
    lastRequestedUrl = '';
    delete process.env.MD2PDF_ALLOW_PRIVATE_NETWORK;
  });

  it('vector 1: blocks markdown image targeting loopback', async () => {
    const mdPath = path.join(tempDir, 'vec1.md');
    const outPath = path.join(tempDir, 'vec1.pdf');
    await fs.writeFile(mdPath, `# SSRF Test\n\n![private](http://127.0.0.1:${serverPort}/image.png)`);

    const result = await convert({ input: mdPath, output: outPath });
    expect(result.outputPath).toBe(outPath);
    expect(requestCount).toBe(0);
  });

  it('vector 2: blocks raw img tag targeting loopback', async () => {
    const mdPath = path.join(tempDir, 'vec2.md');
    const outPath = path.join(tempDir, 'vec2.pdf');
    await fs.writeFile(
      mdPath,
      `# SSRF Test\n\n<img src="http://127.0.0.1:${serverPort}/image.png" alt="private" />`
    );

    const result = await convert({ input: mdPath, output: outPath });
    expect(result.outputPath).toBe(outPath);
    expect(requestCount).toBe(0);
  });

  it('vector 3: blocks redirect chain leading to loopback', async () => {
    const mdPath = path.join(tempDir, 'vec3.md');
    const outPath = path.join(tempDir, 'vec3.pdf');
    await fs.writeFile(
      mdPath,
      `# SSRF Test\n\n![redirect](http://127.0.0.1:${serverPort}/redirect-to-private)`
    );

    const result = await convert({ input: mdPath, output: outPath });
    expect(result.outputPath).toBe(outPath);
    // Initial fetch was loopback so url-guard blocked it upfront before even sending GET
    expect(requestCount).toBe(0);
  });

  it('vector 4: strips url() in inline style attributes', async () => {
    const mdPath = path.join(tempDir, 'vec4.md');
    const outPath = path.join(tempDir, 'vec4.pdf');
    await fs.writeFile(
      mdPath,
      `# CSS Injection\n\n<div style="background-image: url('http://127.0.0.1:${serverPort}/image.png'); color: red;">Styled</div>`
    );

    const result = await convert({ input: mdPath, output: outPath });
    expect(result.outputPath).toBe(outPath);
    expect(requestCount).toBe(0);
    // Verify the HTML stripped url() from the inline style
    expect(result.html).not.toContain(`url('http://127.0.0.1:${serverPort}`);
    expect(result.html).toContain('color: red;');
  });

  it('vector 5: offline mode bypasses remote image fetches completely', async () => {
    const mdPath = path.join(tempDir, 'vec5.md');
    const outPath = path.join(tempDir, 'vec5.pdf');
    await fs.writeFile(mdPath, `# Offline Test\n\n![remote](http://example.com/banner.png)`);

    const result = await convert({ input: mdPath, output: outPath, offline: true });
    expect(result.outputPath).toBe(outPath);
    expect(requestCount).toBe(0);
  });

  it('positive: allows private network image when MD2PDF_ALLOW_PRIVATE_NETWORK=1', async () => {
    process.env.MD2PDF_ALLOW_PRIVATE_NETWORK = '1';

    const mdPath = path.join(tempDir, 'positive.md');
    const outPath = path.join(tempDir, 'positive.pdf');
    await fs.writeFile(mdPath, `# Allowed\n\n![local](http://127.0.0.1:${serverPort}/image.png)`);

    const result = await convert({ input: mdPath, output: outPath });
    expect(result.outputPath).toBe(outPath);
    expect(requestCount).toBe(1);
    expect(lastRequestedUrl).toBe('/image.png');
    // Result HTML should contain the embedded base64 data URI
    expect(result.html).toContain('data:image/png;base64,');
  });
});

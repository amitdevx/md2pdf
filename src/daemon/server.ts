import http from 'node:http';
import { convert } from '../core/index.js';
import type { ConvertOptions } from '../types/index.js';
import { generateToken } from './token.js';

const BODY_LIMIT = 1 * 1024 * 1024; // 1 MB - sufficient for all convert options

let daemonToken: string;
let daemonMermaidPage: import('playwright-core').Page | null = null;

async function getDaemonMermaidPage() {
  if (daemonMermaidPage && !daemonMermaidPage.isClosed()) return daemonMermaidPage;
  try {
    const { globalBrowserManager } = await import('../core/browser-manager.js');
    const { initializeMermaid } = await import('../plugins/mermaid/runtime.js');
    const browser = await globalBrowserManager.acquireBrowser();
    const ctx = await browser.newContext({ deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await initializeMermaid(page);
    daemonMermaidPage = page;
    // We intentionally DO NOT release the browser lock here!
    // The daemon will hold 1 active job count permanently,
    // ensuring the Playwright browser stays warm and never closes.
    return daemonMermaidPage;
  } catch {
    return null;
  }
}

/**
 * Reject requests that carry an Origin header (browser cross-origin requests
 * always include Origin). Pure same-process / CLI clients do not send Origin.
 */
function hasForbiddenOrigin(req: http.IncomingMessage): boolean {
  const origin = req.headers['origin'];
  if (!origin) return false;
  // Allow only explicit opt-in from localhost (should still be blocked, but
  // being conservative: any Origin header from a web context is rejected).
  return true;
}

export function startDaemon() {
  process.env.MD2PDF_DAEMON = '1';

  daemonToken = generateToken();
  console.log(`Daemon token written to ~/.md2pdf/daemon.token (mode 0600)`);

  const PORT = 47231;
  const HOST = '127.0.0.1';

  const server = http.createServer(async (req, res) => {
    // 1. Only allow loopback connections
    if (
      req.socket.remoteAddress !== '127.0.0.1' &&
      req.socket.remoteAddress !== '::1' &&
      req.socket.remoteAddress !== '::ffff:127.0.0.1'
    ) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    // 2. Reject cross-origin requests (CSRF protection)
    if (hasForbiddenOrigin(req)) {
      res.writeHead(403);
      res.end('Forbidden: cross-origin request rejected');
      return;
    }

    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'alive' }));
      return;
    }

    // 3. All mutating endpoints require Bearer token auth
    const authHeader = req.headers['authorization'] || '';
    const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!provided || provided !== daemonToken) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/convert') {
      // 4. Require JSON content-type
      const ct = req.headers['content-type'] || '';
      if (!ct.includes('application/json')) {
        res.writeHead(415, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Content-Type must be application/json' }));
        return;
      }

      // 5. Body size limit (1 MB)
      let bodyLen = 0;
      const chunks: Buffer[] = [];
      let tooLarge = false;
      req.on('data', (chunk: Buffer) => {
        bodyLen += chunk.length;
        if (bodyLen > BODY_LIMIT) {
          tooLarge = true;
          req.destroy();
        } else {
          chunks.push(chunk);
        }
      });
      req.on('end', async () => {
        if (tooLarge) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Request body too large (max 1 MB)' }));
          return;
        }
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          const options = JSON.parse(body) as ConvertOptions;

          // 6. Ensure output has .pdf suffix
          if (options.output && !options.output.toLowerCase().endsWith('.pdf')) {
            options.output = options.output + '.pdf';
          }

          // 7. Path safety check
          const { isSafeOutputPath } = await import('../validation/path.js');
          if (options.output && !isSafeOutputPath(options.output)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Path Traversal Blocked' }));
            return;
          }

          options.sharedMermaidPage = await getDaemonMermaidPage() || undefined;

          const result = await convert(options);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, result }));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/stop') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'stopping' }));
      setTimeout(() => process.exit(0), 100);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(PORT, HOST, () => {
    console.log(`Daemon listening on ${HOST}:${PORT}`);
  });
}

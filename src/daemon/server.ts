import http from 'node:http';
import { convert } from '../core/index.js';
import type { ConvertOptions } from '../types/index.js';

export function startDaemon() {
  process.env.MD2PDF_DAEMON = '1';
  const PORT = 47231;
  const HOST = '127.0.0.1';

  const server = http.createServer(async (req, res) => {
    // Only allow localhost
    if (req.socket.remoteAddress !== '127.0.0.1' && req.socket.remoteAddress !== '::1' && req.socket.remoteAddress !== '::ffff:127.0.0.1') {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (req.method === 'GET' && req.url === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'alive' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/convert') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const options = JSON.parse(body) as ConvertOptions;
          // Ensure paths are restricted or validated
          const { isSafeOutputPath } = await import('../validation/path.js');
          if (options.output && !isSafeOutputPath(options.output)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Path Traversal Blocked' }));
            return;
          }
          
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

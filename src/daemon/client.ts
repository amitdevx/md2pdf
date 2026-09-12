import http from 'node:http';
import type { ConvertOptions, ConvertResult } from '../types/index.js';

const PORT = 47231;
const HOST = '127.0.0.1';

export async function isDaemonAlive(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://${HOST}:${PORT}/status`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export async function stopDaemon(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(`http://${HOST}:${PORT}/stop`, { method: 'POST' }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export async function submitToDaemon(options: ConvertOptions): Promise<ConvertResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://${HOST}:${PORT}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk.toString());
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.success) {
            resolve(data.result);
          } else {
            reject(new Error(data.error || 'Daemon conversion failed'));
          }
        } catch {
          reject(new Error('Invalid response from daemon'));
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(options));
    req.end();
  });
}

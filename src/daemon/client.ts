import http from 'node:http';
import type { ConvertOptions, ConvertResult } from '../types/index.js';
import { readToken } from './token.js';

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
  const token = readToken();
  return new Promise((resolve) => {
    const req = http.request(`http://${HOST}:${PORT}/stop`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      }
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

export async function submitToDaemon(options: ConvertOptions): Promise<ConvertResult> {
  const token = readToken();
  if (!token) {
    throw new Error('Daemon token not found (~/.md2pdf/daemon.token). Is the daemon running?');
  }

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(options);
    const req = http.request(`http://${HOST}:${PORT}/convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(body),
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk.toString());
      res.on('end', () => {
        try {
          const data = JSON.parse(responseBody);
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
    req.write(body);
    req.end();
  });
}

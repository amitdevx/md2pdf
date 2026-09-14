import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const TOKEN_DIR  = path.join(os.homedir(), '.md2pdf');
const TOKEN_FILE = path.join(TOKEN_DIR, 'daemon.token');

/**
 * Generate a new random 256-bit token, persist it to ~/.md2pdf/daemon.token
 * with mode 0600 and return it.
 */
export function generateToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, token, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // If we cannot persist the token the daemon will still work for this session;
    // clients that read from disk will fall back to prompting or --daemon-token.
  }
  return token;
}

/**
 * Read the persisted token. Returns null if the file does not exist or cannot
 * be read.
 */
export function readToken(): string | null {
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch {
    return null;
  }
}

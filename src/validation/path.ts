import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Checks if the resolved output path is safe to write to.
 *
 * Strategy: allow any path the user owns EXCEPT known OS-critical system directories.
 * We do NOT restrict to process.cwd() — users must be able to write output anywhere
 * they have permission (e.g. ~/Documents, /tmp, custom output dirs, etc).
 */
export function isSafeOutputPath(resolvedPath: string): boolean {
  let realPath = resolvedPath;
  try {
    // Walk up to find the nearest existing ancestor and resolve symlinks
    let checkPath = resolvedPath;
    while (checkPath !== path.parse(checkPath).root && !fs.existsSync(checkPath)) {
      checkPath = path.dirname(checkPath);
    }
    if (fs.existsSync(checkPath)) {
      const realAncestor = fs.realpathSync(checkPath);
      realPath = path.join(realAncestor, resolvedPath.slice(checkPath.length));
    }
  } catch {
    // If we cannot resolve, use the path as-is
    realPath = resolvedPath;
  }

  // Normalize to forward slashes for pattern matching
  const normalized = realPath.replace(/\\/g, '/');

  // --- Windows system blocklist ---
  if (process.platform === 'win32') {
    const winBlocked = [
      /^[a-zA-Z]:[/\\]Windows([/\\]|$)/i,
      /^[a-zA-Z]:[/\\]System32([/\\]|$)/i,
      /^[a-zA-Z]:[/\\]Program Files([/\\]|$)/i,
      /^[a-zA-Z]:[/\\]ProgramData([/\\]|$)/i,
    ];
    if (winBlocked.some(re => re.test(realPath))) {
      return false;
    }
    return true;
  }

  // --- Unix/Linux/macOS system blocklist ---
  // Only block kernel, OS, and package-manager directories.
  // Notably: /tmp, /var/tmp, ~/Downloads are NOT blocked.
  const blockedPrefixes = [
    '/etc',
    '/root',
    '/usr',
    '/bin',
    '/sbin',
    '/proc',
    '/sys',
    '/dev',
    '/boot',
    '/lib',
    '/lib64',
  ];

  // On macOS, /etc -> /private/etc etc. Resolve real paths for these too.
  const resolvedBlocked = new Set<string>();
  for (const dir of blockedPrefixes) {
    resolvedBlocked.add(dir);
    try {
      if (fs.existsSync(dir)) {
        resolvedBlocked.add(fs.realpathSync(dir));
      }
    } catch {
      // Ignore
    }
  }

  for (const dir of resolvedBlocked) {
    const dirNorm = dir.replace(/\\/g, '/');
    if (normalized === dirNorm || normalized.startsWith(dirNorm + '/')) {
      return false;
    }
  }

  // Block writing directly into another user's home directory (not current user)
  const currentHome = os.homedir();
  const homeParent = path.dirname(currentHome); // e.g. /home
  if (
    normalized.startsWith(homeParent + '/') &&
    !normalized.startsWith(currentHome + '/') &&
    normalized !== currentHome
  ) {
    return false;
  }

  return true;
}

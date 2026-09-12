import fs from 'node:fs';
import path from 'node:path';

export function isSafeOutputPath(resolvedPath: string): boolean {
  let realPath;
  try {
    // If the path exists or partially exists, resolve it fully
    // If the file doesn't exist, resolve its parent directory
    let checkPath = resolvedPath;
    while (!fs.existsSync(checkPath) && checkPath !== path.parse(checkPath).root) {
      checkPath = path.dirname(checkPath);
    }
    realPath = fs.existsSync(checkPath) 
      ? path.join(fs.realpathSync(checkPath), resolvedPath.slice(checkPath.length))
      : resolvedPath;
  } catch {
    realPath = resolvedPath;
  }

  // Windows Blocklist
  if (/^([a-zA-Z]:)?[/\\](?:Windows|System32|Program Files|Users[/\\]Administrator)/i.test(realPath)) {
    return false;
  }

  // Unix/Linux Blocklist
  const blockedDirs = [
    '/etc', '/root', '/var', '/usr', '/bin', '/proc', 
    '/sys', '/dev', '/boot', '/lib', '/lib64', '/sbin', 
    '/opt', '/srv', '/run', '/tmp'
  ];

  // We ensure it starts with the block directory exactly, handling trailing slashes
  // e.g. /etc/passwd -> true, /etc_stuff -> false
  for (const dir of blockedDirs) {
    if (realPath === dir || realPath.startsWith(dir + path.sep) || realPath.startsWith(dir + '/')) {
      return false;
    }
  }

  return true;
}

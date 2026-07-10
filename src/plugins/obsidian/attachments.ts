import fs from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';

export async function resolveAttachmentPath(
  target: string,
  currentFilePath: string,
  vaultRoot: string,
  attachmentFolder?: string
): Promise<string | null> {
  const currentDir = path.dirname(currentFilePath);
  
  // 1. Try exact relative path from current file
  let candidate = path.resolve(currentDir, target);
  if (await fileExists(candidate)) return candidate;

  // 2. Try configured attachment folder
  if (attachmentFolder) {
    candidate = path.resolve(vaultRoot, attachmentFolder, target);
    if (await fileExists(candidate)) return candidate;
  }

  // 3. Try common attachment folder names
  const commonFolders = ['assets', 'attachments', 'files', 'Attachments'];
  for (const folder of commonFolders) {
    candidate = path.resolve(vaultRoot, folder, target);
    if (await fileExists(candidate)) return candidate;
  }

  // 4. Fallback: Search anywhere in the vault (simulated by checking root, but a full recursive search is expensive)
  // For now, check vaultRoot root.
  candidate = path.resolve(vaultRoot, target);
  if (await fileExists(candidate)) return candidate;

  // TODO: Full recursive vault search if needed
  return null;
}

export async function getBase64DataUri(filePath: string, maxMb: number = 10): Promise<string | null> {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > maxMb * 1024 * 1024) {
      console.warn(`[md2pdf] Warning: Attachment ${filePath} is larger than ${maxMb}MB and will be skipped.`);
      return null;
    }
    const data = await fs.readFile(filePath);
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

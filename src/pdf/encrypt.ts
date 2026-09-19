import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

export function encryptPdf(pdfPath: string, password: string): void {
  try {
    // Check if qpdf is available
    execFileSync('qpdf', ['--version'], { stdio: 'ignore' });
  } catch {
    throw new Error('AES-256 PDF encryption via --password requires "qpdf" to be installed on your system. Please install qpdf to use this feature.');
  }

  const tempPath = pdfPath + '.encrypted';
  
  // Use qpdf to encrypt the file with AES-256
  // --encrypt user-password owner-password key-length --
  execFileSync('qpdf', [
    '--encrypt',
    password, // User password (required to open)
    password, // Owner password (same as user password for simplicity)
    '256',    // AES-256
    '--',
    pdfPath,
    tempPath
  ], { stdio: 'ignore' });

  // Replace original file with the encrypted version
  fs.renameSync(tempPath, pdfPath);
}

import fs from 'node:fs';
import * as pdfLib from 'pdf-lib';

let configured = false;

export async function encryptPdf(pdfPath: string, password: string): Promise<void> {
  // @ts-ignore
  const { lock, configure } = await import('pdf-lib-encrypt');
  if (!configured) {
    configure(pdfLib);
    configured = true;
  }
  
  const pdfBytes = fs.readFileSync(pdfPath);
  const encryptedBytes = await lock(pdfBytes, password);
  fs.writeFileSync(pdfPath, encryptedBytes);
}

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import * as pdfLib from 'pdf-lib';

// ponytail: Lean PDF inspection helper using pdf-lib and pdftotext fallback

export interface PdfInspection {
  pageCount: number;
  pageSize: { width: number; height: number };
}

export async function inspectPdf(pdfPath: string): Promise<PdfInspection> {
  const bytes = fs.readFileSync(pdfPath);
  const doc = await pdfLib.PDFDocument.load(bytes);
  const pageCount = doc.getPageCount();
  const page = doc.getPage(0);
  const pageSize = page.getSize();
  return { pageCount, pageSize };
}

export function extractPdfText(pdfPath: string, options?: { layout?: boolean }): string {
  try {
    const layoutFlag = options?.layout ? '-layout' : '';
    const text = execSync(`pdftotext ${layoutFlag} "${pdfPath}" -`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return text;
  } catch {
    // If pdftotext is not installed in the environment, fallback to raw string representation
    const bytes = fs.readFileSync(pdfPath);
    return bytes.toString('latin1');
  }
}

export async function verifyEncryptedPdf(
  pdfPath: string,
  correctPassword: string,
  wrongPassword: string
): Promise<{ unauthenticatedFailed: boolean; wrongPasswordFailed: boolean; pageCount: number }> {
  const bytes = fs.readFileSync(pdfPath);

  // 1. Unauthenticated load must fail
  let unauthenticatedFailed = false;
  try {
    await pdfLib.PDFDocument.load(bytes);
  } catch {
    unauthenticatedFailed = true;
  }

  // 2. Configure pdf-lib-encrypt
  // @ts-expect-error - dynamic import of pdf-lib-encrypt
  const { unlockInPlace, configure } = await import('pdf-lib-encrypt');
  configure(pdfLib);

  // 3. Wrong password must fail
  let wrongPasswordFailed = false;
  try {
    const wrongDoc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    await unlockInPlace(wrongDoc, wrongPassword);
  } catch {
    wrongPasswordFailed = true;
  }

  // 4. Correct password must unlock and yield valid doc
  const doc = await pdfLib.PDFDocument.load(bytes, { ignoreEncryption: true });
  await unlockInPlace(doc, correctPassword);
  const pageCount = doc.getPageCount();

  return {
    unauthenticatedFailed,
    wrongPasswordFailed,
    pageCount,
  };
}

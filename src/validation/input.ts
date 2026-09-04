import fs from 'node:fs';
import path from 'node:path';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';

export function validateInput(input: string): Md2PdfError | null {
  if (input === '-') {
    return null; // Valid stdin!
  }

  if (!fs.existsSync(input)) {
    return new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'File Not Found', 'File not found', { markdownFile: input });
  }

  const stat = fs.statSync(input);
  const MAX_SIZE_BYTES = 5 * 1024 * 1024;
  
  if (stat.size > MAX_SIZE_BYTES) {
    return new Md2PdfError(Md2PdfErrorCode.ERR_FILE_TOO_LARGE, 'File Too Large', `Input markdown exceeds 5MB (${(stat.size/1024/1024).toFixed(2)}MB).`, { markdownFile: input });
  }

  if (stat.isDirectory()) {
    return new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Input', 'Is a directory, not a file', { markdownFile: input });
  }

  if (path.extname(input).toLowerCase() !== '.md') {
    return new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Input', 'Not a markdown file', { markdownFile: input });
  }

  try {
    fs.accessSync(input, fs.constants.R_OK);
  } catch {
    return new Md2PdfError(Md2PdfErrorCode.ERR_PERMISSION_DENIED, 'Permission Denied', 'Permission denied', { markdownFile: input });
  }

  let complexityDepth = 0;
  try {
    const rawContent = fs.readFileSync(input, 'utf-8');
    complexityDepth = Math.max(0, ...rawContent.split('\n').map(
      line => (line.match(/^(>\s*)+/) || [''])[0].split('>').length - 1
    ));
  } catch { /* ignore */ }
  
  if (complexityDepth > 200) {
    return new Md2PdfError(Md2PdfErrorCode.ERR_DOCUMENT_TOO_COMPLEX, 'Document Too Complex', `The document contains blockquote nesting ${complexityDepth} levels deep. Maximum supported depth is 200.`, { markdownFile: input });
  }

  return null;
}

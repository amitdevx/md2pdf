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
  const MAX_SIZE_BYTES = 30 * 1024 * 1024;
  
  if (stat.size > MAX_SIZE_BYTES) {
    return new Md2PdfError(Md2PdfErrorCode.ERR_FILE_TOO_LARGE, 'File Too Large', `Input markdown exceeds 30MB (${(stat.size/1024/1024).toFixed(2)}MB).`, { markdownFile: input });
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
    let pos = 0;
    while (pos < rawContent.length) {
      let nextNewline = rawContent.indexOf('\n', pos);
      if (nextNewline === -1) nextNewline = rawContent.length;
      
      let depth = 0;
      let i = pos;
      while (i < nextNewline) {
        const char = rawContent[i];
        if (char === '>') depth++;
        else if (char !== ' ' && char !== '\t') break;
        i++;
      }
      if (depth > complexityDepth) complexityDepth = depth;
      pos = nextNewline + 1;
    }
  } catch { /* ignore */ }
  
  if (complexityDepth > 200) {
    return new Md2PdfError(Md2PdfErrorCode.ERR_DOCUMENT_TOO_COMPLEX, 'Document Too Complex', `The document contains blockquote nesting ${complexityDepth} levels deep. Maximum supported depth is 200.`, { markdownFile: input });
  }

  return null;
}

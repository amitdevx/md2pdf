import fs from 'node:fs';
import path from 'node:path';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';

export interface ValidationResult {
  validInputs: string[];
  errors: { input: string; error: Md2PdfError; isFatal: boolean }[];
}

export function validateInputFiles(inputs: string[], isBatch: boolean, options: any): ValidationResult {
  const validInputs: string[] = [];
  const errors: { input: string; error: Md2PdfError; isFatal: boolean }[] = [];

  for (const input of inputs) {
    if (input === '-') {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Input', 'Stdin Input Is Not Supported', { markdownFile: input }),
        isFatal: false
      });
      continue;
    }
    if (!fs.existsSync(input)) {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'File Not Found', 'File not found', { markdownFile: input }),
        isFatal: false
      });
      continue;
    }

    const stat = fs.statSync(input);
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    
    if (stat.size > MAX_SIZE_BYTES) {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_FILE_TOO_LARGE, 'File Too Large', `Input markdown exceeds 5MB (${(stat.size/1024/1024).toFixed(2)}MB).`, { markdownFile: input }),
        isFatal: true
      });
      continue;
    }

    if (stat.isDirectory()) {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Input', 'Is a directory, not a file', { markdownFile: input }),
        isFatal: false
      });
      continue;
    }

    if (path.extname(input).toLowerCase() !== '.md') {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Input', 'Not a markdown file', { markdownFile: input }),
        isFatal: false
      });
      continue;
    }

    try {
      fs.accessSync(input, fs.constants.R_OK);
    } catch {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_PERMISSION_DENIED, 'Permission Denied', 'Permission denied', { markdownFile: input }),
        isFatal: true
      });
      continue;
    }

    let complexityDepth = 0;
    try {
      const rawContent = fs.readFileSync(input, 'utf-8');
      complexityDepth = Math.max(0, ...rawContent.split('\n').map(
        line => (line.match(/^(>\s*)+/) || [''])[0].split('>').length - 1
      ));
    } catch { /* ignore */ }
    
    if (complexityDepth > 200) {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_DOCUMENT_TOO_COMPLEX, 'Document Too Complex', `The document contains blockquote nesting ${complexityDepth} levels deep. Maximum supported depth is 200.`, { markdownFile: input }),
        isFatal: true
      });
      continue;
    }

    let predictedOutput = options.output;
    if (predictedOutput && path.resolve(input) === path.resolve(predictedOutput)) {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Input', 'Input and output cannot be the same file', { markdownFile: input }),
        isFatal: false
      });
      continue;
    }

    if (predictedOutput) {
      if (fs.existsSync(predictedOutput) && fs.statSync(predictedOutput).isDirectory()) {
        predictedOutput = path.join(predictedOutput, path.basename(input).replace(/\.md$/i, '.pdf'));
      } else if (isBatch) {
        predictedOutput = path.join(predictedOutput, path.basename(input).replace(/\.md$/i, '.pdf'));
      } else if (!predictedOutput.toLowerCase().endsWith('.pdf')) {
        predictedOutput += '.pdf';
      }
    } else {
      predictedOutput = input.replace(/\.md$/i, '.pdf');
    }

    if (path.resolve(input) === path.resolve(predictedOutput)) {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Input', 'Input and output cannot be the same file', { markdownFile: input }),
        isFatal: false
      });
      continue;
    }

    const sensitiveDirs = ['/etc', '/root', '/var', '/usr', '/bin'];
    const outputAbs = path.resolve(process.cwd(), predictedOutput);
    const isSensitive = sensitiveDirs.some(dir => outputAbs.startsWith(dir + path.sep) || outputAbs === dir) || new RegExp('^([a-zA-Z]:)?[/\\\\\\\\]Windows', 'i').test(outputAbs);
    if (isSensitive) {
      errors.push({
        input,
        error: new Md2PdfError(Md2PdfErrorCode.ERR_PATH_TRAVERSAL, 'Access Denied', 'Cannot write output to protected system directory.', { markdownFile: input, outputPath: outputAbs }),
        isFatal: true 
      });
      continue;
    }

    validInputs.push(input);
  }

  return { validInputs, errors };
}

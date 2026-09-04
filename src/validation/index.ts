import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import { validateInput } from './input.js';
import { predictOutputPath, validateOutput } from './output.js';

export interface ValidationResult {
  validInputs: string[];
  errors: { input: string; error: Md2PdfError; isFatal: boolean }[];
}

export function validateInputFiles(inputs: string[], isBatch: boolean, options: any): ValidationResult {
  const validInputs: string[] = [];
  const errors: { input: string; error: Md2PdfError; isFatal: boolean }[] = [];

  // First: do a standalone output path check (path traversal / sensitive dirs) that
  // fires regardless of whether input files exist. This prevents bypassing the guard
  // by passing a non-existent input file with a dangerous output path.
  if (options.output) {
    const dummyPredicted = predictOutputPath('-', options.output, isBatch);
    const outputOnlyErr = validateOutput('-', options.output, dummyPredicted);
    if (outputOnlyErr && outputOnlyErr.code === Md2PdfErrorCode.ERR_PATH_TRAVERSAL) {
      // Fatal — return immediately
      return {
        validInputs: [],
        errors: inputs.map(input => ({ input, error: outputOnlyErr, isFatal: true }))
      };
    }
  }

  for (const input of inputs) {
    const inputErr = validateInput(input);
    if (inputErr) {
      errors.push({
        input,
        error: inputErr,
        // Match the previous isFatal logic for backward compatibility in tests
        isFatal: inputErr.code === Md2PdfErrorCode.ERR_PERMISSION_DENIED || inputErr.code === Md2PdfErrorCode.ERR_DOCUMENT_TOO_COMPLEX || inputErr.code === Md2PdfErrorCode.ERR_FILE_TOO_LARGE
      });
      continue;
    }

    const predictedOutput = predictOutputPath(input, options.output, isBatch);
    const outputErr = validateOutput(input, options.output, predictedOutput);
    
    if (outputErr) {
      errors.push({
        input,
        error: outputErr,
        isFatal: outputErr.code === Md2PdfErrorCode.ERR_PATH_TRAVERSAL
      });
      continue;
    }

    validInputs.push(input);
  }

  return { validInputs, errors };
}

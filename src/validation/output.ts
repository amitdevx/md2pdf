import fs from 'node:fs';
import path from 'node:path';
import { Md2PdfError, Md2PdfErrorCode } from '../errors/index.js';
import { isSafeOutputPath } from './path.js';

export function predictOutputPath(input: string, outputOption: string | undefined, isBatch: boolean): string {
  let predictedOutput = outputOption;

  if (predictedOutput) {
    if (fs.existsSync(predictedOutput) && fs.statSync(predictedOutput).isDirectory()) {
      predictedOutput = path.join(predictedOutput, input === '-' ? 'output.pdf' : path.basename(input).replace(/\.md$/i, '.pdf'));
    } else if (isBatch) {
      predictedOutput = path.join(predictedOutput, input === '-' ? 'output.pdf' : path.basename(input).replace(/\.md$/i, '.pdf'));
    } else if (!predictedOutput.toLowerCase().endsWith('.pdf')) {
      predictedOutput += '.pdf';
    }
  } else {
    predictedOutput = input === '-' ? 'output.pdf' : input.replace(/\.md$/i, '.pdf');
  }

  return predictedOutput;
}

export function validateOutput(input: string, outputOption: string | undefined, predictedOutput: string): Md2PdfError | null {
  if (outputOption && path.resolve(input) === path.resolve(outputOption)) {
    return new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Input', `${input} - Input and Output Cannot Be the Same File`, { markdownFile: input });
  }
  
  if (path.resolve(input) === path.resolve(predictedOutput)) {
    return new Md2PdfError(Md2PdfErrorCode.ERR_INVALID_INPUT, 'Invalid Input', `${input} - Input and Output Cannot Be the Same File`, { markdownFile: input });
  }

  const outputAbs = path.resolve(process.cwd(), predictedOutput);
  
  if (!isSafeOutputPath(outputAbs)) {
    return new Md2PdfError(Md2PdfErrorCode.ERR_PATH_TRAVERSAL, 'Access Denied', 'Cannot write output to protected system directory.', { markdownFile: input, outputPath: outputAbs });
  }

  return null;
}

import { InvalidArgumentError } from 'commander';

export function validateTocDepth(val: string) {
  const n = parseInt(val);
  if (isNaN(n) || n < 1 || n > 6) {
    throw new InvalidArgumentError(`must be a number between 1 and 6`);
  }
  return n;
}

export function validatePaper(val: string) {
  const valid = ['A4', 'Letter', 'Legal'];
  if (!valid.includes(val)) {
    throw new InvalidArgumentError(`must be one of: A4, Letter, Legal`);
  }
  return val;
}

export function validateMargin(val: string) {
  if (!/^(0|\d+(\.\d+)?(mm|cm|in|px|pt|pc|em|rem|%))$/.test(val)) {
    throw new InvalidArgumentError(`use CSS units like 20mm, 1in, 1.5cm, or 0`);
  }
  return val;
}

export function validateMermaidTheme(val: string) {
  const valid = ['default', 'dark', 'base', 'neutral'];
  if (!valid.includes(val)) {
    throw new InvalidArgumentError(`must be one of: ${valid.join(', ')}`);
  }
  return val;
}

export function validatePositiveInt(val: string) {
  const n = parseInt(val);
  if (isNaN(n) || n <= 0) {
    throw new InvalidArgumentError(`must be a positive integer`);
  }
  return n;
}

export function validatePositiveIntMs(val: string) {
  const n = parseInt(val);
  if (isNaN(n) || n <= 0) {
    throw new InvalidArgumentError(`must be a positive integer in milliseconds`);
  }
  return n;
}

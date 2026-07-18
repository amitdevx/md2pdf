import { describe, it, expect } from 'vitest';
import { convert } from '../../src/core/index.js';

describe('convert()', () => {
  it('should reject non-string input', async () => {
    await expect(convert({ input: 123 as any, output: 'out.pdf' } as any))
      .rejects.toThrow('input property must be a string');
  });

  it('should reject output to sensitive directories', async () => {
    await expect(convert({ input: 'test.md', output: '/etc/passwd' } as any))
      .rejects.toThrow('protected system directory');
  });
});

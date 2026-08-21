import { describe, it, expect } from 'vitest';
import { convert } from '../../src/core/index.js';

describe('convert()', () => {
  it('should reject non-string input', async () => {
    await expect(convert({ input: 123 as any, output: 'out.pdf' } as any))
      .rejects.toThrow('input property must be a string');
  
});

  it('should block JavaScript frontmatter (---js) for security', async () => {
    const fs = require('fs');
    const path = require('path');
    const input2 = path.join(__dirname, 'evil2.md');
    fs.writeFileSync(input2, '---js\nconsole.log(1)\n---\n# content');
    
    await expect(convert({ input: input2, output: 'out.pdf' } as any))
      .rejects.toThrow('JavaScript frontmatter (---js) is disabled');
      
    if (fs.existsSync(input2)) fs.unlinkSync(input2);
  });


  it('should reject output to sensitive directories', async () => {
    const sensitivePath = process.platform === 'win32' ? 'C:\\Windows\\System32\\config' : '/etc/passwd';
    await expect(convert({ input: 'test.md', output: sensitivePath } as any))
      .rejects.toThrow('protected system directory');
  });
});

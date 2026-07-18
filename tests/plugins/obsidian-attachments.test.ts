import { describe, it, expect } from 'vitest';
import { resolveAttachmentPath } from '../../src/plugins/obsidian/attachments.js';


describe('resolveAttachmentPath', () => {
  it('should return null if file not found anywhere', async () => {
    const result = await resolveAttachmentPath('nonexistent.png', process.cwd(), process.cwd());
    expect(result).toBeNull();
  });
});

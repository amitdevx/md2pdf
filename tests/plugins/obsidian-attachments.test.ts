import { describe, it, expect } from 'vitest';
import { resolveAttachmentPath } from '../../src/plugins/obsidian/attachments.js';
import path from 'path';

describe('resolveAttachmentPath', () => {
  it('should return null if file not found anywhere', () => {
    const result = resolveAttachmentPath('nonexistent.png', process.cwd());
    expect(result).toBeNull();
  });
});

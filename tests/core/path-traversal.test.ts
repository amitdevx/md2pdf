import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runConvert } from '../../src/commands/convert';

describe('Path Traversal Security (M-01)', () => {
  let jsonOutMock: any;

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('process.exit'); });
    jsonOutMock = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should block explicit sensitive directories', async () => {
    await expect(runConvert(['test.md'], { output: '/etc/out.pdf', jsonErrors: true })).rejects.toThrow('process.exit');
  });

  it('should NOT block legitimate paths that share a prefix with sensitive dirs', async () => {
    // /etc-backups should not be blocked by /etc
    try {
      await runConvert(['test.md'], { output: '/etc-backups/out.pdf', jsonErrors: true });
    } catch {
      // It might fail on reading test.md, but it shouldn't fail with ERR_PATH_TRAVERSAL
    }
    // We check that jsonOutMock wasn't called with ERR_PATH_TRAVERSAL
    const calls = jsonOutMock.mock.calls;
    for (const call of calls) {
      if (typeof call[0] === 'string' && call[0].includes('ERR_PATH_TRAVERSAL')) {
        throw new Error('Blocked legitimate path!');
      }
    }
  });
});

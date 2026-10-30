import { describe, it, expect, vi } from 'vitest';
import { registerShutdownHandler, executeShutdown } from '../../src/core/shutdown.js';

describe('Shutdown Registry (R2)', () => {
  it('registers and executes hooks on shutdown', async () => {
    const executed: string[] = [];

    const hook1 = vi.fn().mockImplementation(() => {
      executed.push('hook1');
    });
    const hook2 = vi.fn().mockImplementation(async () => {
      executed.push('hook2');
    });

    const unreg1 = registerShutdownHandler(hook1);
    const unreg2 = registerShutdownHandler(hook2);

    await executeShutdown();

    expect(hook1).toHaveBeenCalledTimes(1);
    expect(hook2).toHaveBeenCalledTimes(1);
    // Reverse registration order
    expect(executed).toEqual(['hook2', 'hook1']);

    // Unregister should prevent further calls
    unreg1();
    unreg2();
  });

  it('unregisters hook correctly', async () => {
    const hook = vi.fn();
    const unregister = registerShutdownHandler(hook);
    unregister();

    await executeShutdown();
    expect(hook).not.toHaveBeenCalled();
  });
});

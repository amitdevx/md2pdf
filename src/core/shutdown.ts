/**
 * Unified Process Shutdown Registry
 * Handles SIGINT, SIGTERM, and SIGHUP signals with an unreferenced force-exit timer.
 */

type ShutdownHook = () => Promise<void> | void;

const shutdownHooks = new Set<ShutdownHook>();
let signalsInitialized = false;
let isShuttingDown = false;

function onSignal(): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  // Unreferenced 3-second force-exit timer to prevent hanging during teardown
  const forceTimer = setTimeout(() => {
    process.exit(130);
  }, 3000);
  forceTimer.unref();

  executeShutdown().finally(() => {
    process.exit(130);
  });
}

function initSignalListeners(): void {
  if (signalsInitialized) return;
  signalsInitialized = true;

  process.once('SIGINT', () => onSignal());
  process.once('SIGTERM', () => onSignal());
  process.once('SIGHUP', () => onSignal());
}

/**
 * Register a cleanup hook to run on process termination (SIGINT, SIGTERM, SIGHUP).
 * Returns an unregister function to remove the hook when work completes normally.
 */
export function registerShutdownHandler(hook: ShutdownHook): () => void {
  initSignalListeners();
  shutdownHooks.add(hook);
  return () => {
    shutdownHooks.delete(hook);
  };
}

/**
 * Execute all registered shutdown handlers.
 */
export async function executeShutdown(): Promise<void> {
  const hooks = Array.from(shutdownHooks).reverse();
  await Promise.allSettled(
    hooks.map(async (hook) => {
      try {
        await hook();
      } catch {
        // Suppress shutdown handler errors to avoid masking exit
      }
    })
  );
  shutdownHooks.clear();
}

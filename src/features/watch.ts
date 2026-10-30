import fs from 'node:fs';
import pc from 'picocolors';
import { registerShutdownHandler } from '../core/shutdown.js';

export async function watchFiles(files: string[], buildFn: (file?: string) => Promise<void>) {
  console.log(pc.cyan(`\n👀 Watch mode enabled. Watching ${files.length} file(s) for changes...`));
  let isRebuilding = false;
  let pendingBuild = false;
  const watchers: fs.FSWatcher[] = [];

  const cleanupWatchers = () => {
    for (const watcher of watchers) {
      try {
        watcher.close();
      } catch {
        // ignore
      }
    }
    watchers.length = 0;
  };

  registerShutdownHandler(() => {
    cleanupWatchers();
  });

  const triggerBuild = async () => {
    if (isRebuilding) {
      pendingBuild = true;
      return;
    }
    isRebuilding = true;
    try {
      console.log(pc.gray('\n[Watch] Rebuilding...'));
      await buildFn();
    } catch (err) {
      console.error(pc.red('[Watch] Build failed:'), err);
    } finally {
      isRebuilding = false;
      if (pendingBuild) {
        pendingBuild = false;
        triggerBuild();
      }
    }
  };

  // Perform initial build
  await triggerBuild();

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      const watcher = fs.watch(file, (eventType) => {
        if (eventType === 'change') {
          triggerBuild();
        }
      });
      watchers.push(watcher);
    } catch (e: any) {
      if (e.code === 'ENOSPC') {
        console.warn(pc.yellow(`⚠ Warning: OS watch limit reached. Could not watch ${file}`));
      } else {
        console.warn(pc.yellow(`⚠ Warning: Failed to watch ${file} - ${e.message}`));
      }
    }
  }
  return new Promise(() => {});
}

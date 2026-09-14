import fs from 'node:fs';
import pc from 'picocolors';

export async function watchFiles(files: string[], buildFn: (file?: string) => Promise<void>) {
  console.log(pc.cyan(`\n👀 Watch mode enabled. Watching ${files.length} file(s) for changes...`));
  let isRebuilding = false;
  let pendingBuild = false;

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
    fs.watch(file, (eventType) => {
      if (eventType === 'change') {
        triggerBuild();
      }
    });
  }
}

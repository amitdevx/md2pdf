import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 120000,
    pool: 'threads',
    fileParallelism: false,
    poolOptions: {
      threads: {
        maxThreads: 2,
        minThreads: 1
      },
      forks: {
        singleFork: true
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    }
  }
});

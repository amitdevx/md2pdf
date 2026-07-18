import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: false,
  clean: true,
  treeshake: true,
  minify: true,
  splitting: false,
  outDir: 'dist',
});

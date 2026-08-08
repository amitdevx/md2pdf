import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: false,
  clean: true,
  treeshake: true,
  outDir: 'dist',
  noExternal: [
    'unified', 'remark-parse', 'remark-rehype', 'rehype-stringify',
    'remark-gfm', 'remark-math', 'rehype-katex', 'rehype-slug',
    'unist-util-visit', '@shikijs/rehype'
  ],
  external: ['playwright-core', 'shiki', 'mermaid'],
});

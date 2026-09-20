import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "node_modules/",
      "src/assets/",
      "tmp/",
      ".md2pdf-cache/",
      ".md2pdf/",
      "coverage/",
      "playwright-report/",
      "test-results/"
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);

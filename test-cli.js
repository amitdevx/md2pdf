const { execSync } = require('child_process');
try {
  execSync(`node dist/cli/index.js README.md -o "tests/cli/"`, { stdio: 'inherit' });
} catch (e) {}

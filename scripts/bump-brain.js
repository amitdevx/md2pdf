import fs from 'node:fs';

const BRAIN_PATH = 'brain.md';
let content = fs.readFileSync(BRAIN_PATH, 'utf-8');

// Replace headings that have 0.4.2
content = content.replace(/\(v0\.4\.2\)/g, '(v0.5.0)');
content = content.replace(/v0\.4\.2/g, 'v0.5.0');
// Revert historical phase filenames
content = content.replace(/phase\/v0\.5\.0-obsidian-embeds\.md/g, 'phase/v0.4.1-obsidian-embeds.md');
content = content.replace(/phase\/v0\.5\.0-obsidian-core\.md/g, 'phase/v0.4.0-obsidian-core.md');
content = content.replace(/phase\/v0\.5\.0-config\.md/g, 'phase/v0.5.0-config.md');

// Add the new configuration capabilities to the "Current Capabilities" list if not there
if (!content.includes('Persistent Configuration')) {
  content = content.replace(
    '### Current Capabilities\n\n',
    '### Current Capabilities\n\n- **Persistent Configuration**: Auto-discovers `md2pdf.config.ts`, `.md2pdfrc.json`, `.md2pdfrc.yaml`, or `package.json` (`md2pdf` key) with Zod validation. Supports `defineConfig` for typed authoring and multiple profiles (`--profile`).\n'
  );
}

fs.writeFileSync(BRAIN_PATH, content, 'utf-8');
console.log('brain.md bumped to 0.5.0!');

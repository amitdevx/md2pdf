import { readFileSync, writeFileSync } from 'fs';

const interWoff2 = readFileSync('assets/fonts/Inter-Variable.woff2');
const jbMonoWoff2 = readFileSync('assets/fonts/JetBrainsMono-Variable.woff2');

const css = `
@font-face {
  font-family: 'Inter';
  src: url(data:font/woff2;base64,${interWoff2.toString('base64')}) format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url(data:font/woff2;base64,${jbMonoWoff2.toString('base64')}) format('woff2');
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}
`;

writeFileSync('src/assets/fonts.ts', `export const fontCss = ${JSON.stringify(css)};`);

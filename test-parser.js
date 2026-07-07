import { parseMarkdown } from './dist/parser/index.js';
parseMarkdown('```javascript\nconst a = 1;\n```').then(res => console.log(res.html));

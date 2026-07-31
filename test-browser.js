import { getBrowser } from './dist/pdf/browser.js';
console.log("Starting getBrowser...");
const b = await getBrowser();
console.log("Got browser");
await b.close();
console.log("Closed browser");

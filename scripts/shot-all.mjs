import { chromium } from 'playwright';
import path from 'node:path';

const pages = [
  ['seed', '/campaigns/new/seed'],
  ['case', '/campaigns/new/case'],
  ['lookalikes', '/campaigns/new/lookalikes'],
  ['contacts', '/campaigns/new/contacts'],
  ['sequence', '/campaigns/new/sequence'],
  ['review', '/campaigns/new/review'],
  ['company', '/companies/c1'],
];

const outDir = process.argv[2] || '.';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const [name, url] of pages) {
  await page.goto('http://localhost:3000' + url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(outDir, `nextjs-${name}.png`), fullPage: true });
  console.log('shot', name);
}
await browser.close();

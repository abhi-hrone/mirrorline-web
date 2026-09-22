import { chromium } from 'playwright';
const url = process.argv[2] || 'http://localhost:3000';
const out = process.argv[3] || 'shot.png';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();

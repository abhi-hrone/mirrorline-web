// Drives seed -> lookalikes -> contacts against a running dev server.
// Navigates by clicking the stepper (client-side) so wizard state survives.
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => ['error', 'warning'].includes(m.type()) && console.log(`[console.${m.type()}]`, m.text().slice(0, 300)));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText));
page.on('response', (r) => r.url().includes('/api/') && console.log('[api]', r.request().method(), new URL(r.url()).pathname, r.status()));

await page.goto(`${base}/campaigns/new/seed`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('example.com').fill('dbschenker.com');

await page.getByRole('link', { name: /Lookalikes/ }).click();
await page.waitForURL('**/lookalikes');
await page.getByText(/of \d+ companies/).waitFor();
await page.waitForResponse((r) => r.url().includes('/api/lookalikes'), { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1500);
console.log('lookalikes counter:', await page.getByText(/of \d+ companies/).innerText());
console.log('error text:', await page.locator('p[class*="B3402A"]').allInnerTexts());

// tick the first three visible rows
const boxes = page.locator('button[class*="h-[17px]"]');
console.log('rows:', await boxes.count());
for (let i = 0; i < Math.min(3, await boxes.count()); i++) await boxes.nth(i).click();
console.log('selected:', await page.getByText(/companies selected/).innerText());

await page.getByRole('link', { name: /Contacts/ }).click();
await page.waitForURL('**/contacts');
await page.getByRole('button', { name: /Find contacts at/ }).click();
await page.waitForResponse((r) => r.url().includes('/api/contacts'), { timeout: 90000 });
await page.waitForTimeout(1000);
console.log('contacts header:', await page.getByText(/contacts across/).innerText());
await page.screenshot({ path: process.env.SHOT ?? 'contacts.png', fullPage: true });
await browser.close();

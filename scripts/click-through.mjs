import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:3000/campaigns', { waitUntil: 'networkidle' });
await page.getByText('New campaign from a customer').click();
await page.waitForURL('**/campaigns/new/seed');

// Change the seed name — this should still show up on the lookalikes screen
// (context state persisting across a real navigation), and also verify
// unchecking a lookalike changes the Review screen's "Companies" count.
await page.fill('input[value="Veldhoven Freight"]', 'Acme Freight Test');
await page.getByText('Continue to case study').click();
await page.waitForURL('**/campaigns/new/case');
await page.getByText('Find lookalikes').click();
await page.waitForURL('**/campaigns/new/lookalikes');

const seedShown = await page.locator('text=Acme Freight Test').count();
console.log('seed name carried over to lookalikes:', seedShown > 0);

// Uncheck Rhenus Bulk Services (starts picked) then go straight to review.
await page.locator('button').filter({ has: page.locator('text=✓') }).first().click();

// Use a client-side nav (stepper link), not page.goto — goto would be a full
// reload and reset the in-memory Context state, defeating the point of the test.
await page.getByRole('link', { name: /Review/ }).click();
await page.waitForURL('**/campaigns/new/review');
const companiesStat = await page.locator('text=Companies').locator('..').innerText();
console.log('Review companies stat block:', companiesStat.replace(/\n/g, ' | '));

await browser.close();

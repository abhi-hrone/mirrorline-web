// Click-driven extraction (the only approach that actually works here — see
// diag2.mjs: calling setState directly on the fiber-located instance updates
// .state but never re-renders the DOM, so real UI clicks are required).
// Clickable elements in this canvas are marked with inline `cursor: pointer`,
// which we use to disambiguate from plain text that happens to match a label.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const sourceHtml = path.join(projectRoot, 'Mirrorline.html');
const outDir = path.join(projectRoot, 'extracted', 'screens-final');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (err) => console.error('pageerror:', err));

await page.goto('file:///' + sourceHtml.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !document.getElementById('__bundler_loading'), null, { timeout: 30000 });
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(300);

async function clickInteractive(text) {
  const loc = page.locator('[style*="cursor: pointer"]').filter({ hasText: text }).first();
  await loc.click({ timeout: 5000 });
  await page.waitForTimeout(200);
}

async function snap(name, expectText) {
  await page.waitForTimeout(150);
  if (expectText) {
    const bodyText = await page.evaluate(() => document.body.textContent);
    if (!bodyText.includes(expectText)) {
      console.warn(`  WARNING: expected text "${expectText}" not found on screen "${name}" — capture may be wrong screen`);
    }
  }
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  fs.writeFileSync(path.join(outDir, `${name}.html`), html, 'utf-8');
  await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true }).catch((e) => console.error('screenshot failed', name, e.message));
  console.log('captured', name);
}

await snap('01-signin', 'Sign in to your workspace');

await clickInteractive('Continue with Microsoft');
await snap('02-campaigns', 'Referral-led outbound');

await clickInteractive('Workspace');
await snap('03-setup');

await clickInteractive('Campaigns');
await snap('04-campaigns');

// Enter the new-campaign wizard.
await clickInteractive('New campaign');
await snap('05-seed', 'Which customer');

await clickInteractive('Case study');
await snap('06-case');

await clickInteractive('Lookalikes');
await snap('07-lookalikes');

await clickInteractive('Contacts');
await snap('08-contacts');

await clickInteractive('Sequence');
await snap('09-sequence');

await clickInteractive('Review');
await snap('10-review');

console.log('Done main flow. Output in', outDir);
await browser.close();

// Second pass, fresh page: drill into a lookalike's company detail screen
// separately (its own dead end, no "back" nav to chain off of reliably).
const browser2 = await chromium.launch();
const page2 = await browser2.newPage({ viewport: { width: 1440, height: 900 } });
await page2.goto('file:///' + sourceHtml.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
await page2.waitForFunction(() => !document.getElementById('__bundler_loading'), null, { timeout: 30000 });
await page2.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
await page2.waitForTimeout(300);

async function click2(text) {
  const loc = page2.locator('[style*="cursor: pointer"]').filter({ hasText: text }).first();
  await loc.click({ timeout: 5000 });
  await page2.waitForTimeout(200);
}
async function snap2(name) {
  await page2.waitForTimeout(150);
  const html = await page2.evaluate(() => document.documentElement.outerHTML);
  fs.writeFileSync(path.join(outDir, `${name}.html`), html, 'utf-8');
  await page2.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
  console.log('captured', name);
}

await click2('Continue with Microsoft');
await click2('New campaign');
await click2('Lookalikes');
await click2('Rhenus Bulk Services');
await snap2('11-company-detail');

console.log('Done. Output in', outDir);
await browser2.close();

// One-off extraction script: renders the self-unpacking Mirrorline.html bundle
// in headless Chromium, waits for it to unpack itself, then dumps the real
// DOM + all blob: assets to disk so we can port them into Next.js.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const sourceHtml = path.join(projectRoot, 'Mirrorline.html');
const outDir = path.join(projectRoot, 'extracted');
const assetsDir = path.join(outDir, 'assets');

fs.mkdirSync(assetsDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.goto('file:///' + sourceHtml.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });

// The bundler replaces document.documentElement once unpacking finishes,
// which destroys the #__bundler_loading node entirely.
await page.waitForFunction(() => !document.getElementById('__bundler_loading'), null, { timeout: 30000 });
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);

const title = await page.title();

// Collect every blob: URL referenced anywhere in the live DOM (img/src,
// css background-image, @font-face, etc.) by scanning serialized HTML +
// all stylesheet text.
const { html, styleSheetsText } = await page.evaluate(() => {
  const styleSheetsText = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      styleSheetsText.push(Array.from(sheet.cssRules).map((r) => r.cssText).join('\n'));
    } catch (e) {
      styleSheetsText.push('/* inaccessible sheet: ' + (sheet.href || 'inline') + ' */');
    }
  }
  return { html: document.documentElement.outerHTML, styleSheetsText };
});

const blobUrlRe = /blob:[^"'\s)]+/g;
const found = new Set();
for (const m of html.matchAll(blobUrlRe)) found.add(m[0]);
for (const css of styleSheetsText) for (const m of css.matchAll(blobUrlRe)) found.add(m[0]);

console.log('Found', found.size, 'unique blob: URLs');

const assetMap = {}; // blobUrl -> local relative path
let i = 0;
for (const blobUrl of found) {
  i += 1;
  const dataUrl = await page.evaluate(async (url) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }, blobUrl);
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) {
    console.warn('Could not read blob', blobUrl);
    continue;
  }
  const mime = match[1];
  const base64 = match[2];
  const ext = mimeToExt(mime);
  const filename = `asset-${String(i).padStart(3, '0')}${ext}`;
  fs.writeFileSync(path.join(assetsDir, filename), Buffer.from(base64, 'base64'));
  assetMap[blobUrl] = `assets/${filename}`;
}

function mimeToExt(mime) {
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'font/woff2': '.woff2',
    'font/woff': '.woff',
    'font/ttf': '.ttf',
    'application/font-woff2': '.woff2',
    'application/x-font-ttf': '.ttf',
    'text/css': '.css',
    'application/javascript': '.js',
    'text/javascript': '.js',
  };
  return map[mime] || '.bin';
}

let rewritten = html;
for (const [blobUrl, localPath] of Object.entries(assetMap)) {
  rewritten = rewritten.split(blobUrl).join('/' + localPath);
}

fs.writeFileSync(path.join(outDir, 'rendered.html'), rewritten, 'utf-8');
fs.writeFileSync(path.join(outDir, 'stylesheets.css'), styleSheetsText.join('\n\n'), 'utf-8');
fs.writeFileSync(path.join(outDir, 'asset-map.json'), JSON.stringify(assetMap, null, 2), 'utf-8');
fs.writeFileSync(path.join(outDir, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2), 'utf-8');

console.log('Title:', title);
console.log('Assets written:', Object.keys(assetMap).length);
console.log('Console errors captured:', consoleErrors.length);
console.log('Output dir:', outDir);

await browser.close();

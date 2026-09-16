// Preview proof for issue 142 — run `PORT=5199 npm run dev`, then
// `node .scratch/142_vtc-mosaic-sheet-lxw/shoot.mjs` (playwright is the global
// install under /opt/node22; ESM ignores NODE_PATH, so it is imported by path).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const OUT = '.scratch/142_vtc-mosaic-sheet-lxw';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
pg.on('console', m => { if (m.type() === 'error' && !/CERT|404/.test(m.text())) console.log('PAGE ERR:', m.text()); });
await pg.goto('http://localhost:5199/preview.html', { waitUntil: 'networkidle' });
await pg.waitForTimeout(800);
const row = pg.locator('tr', { hasText: 'VTCTUWHMOSHEX' }).first();
console.log('ROW:', (await row.innerText()).replace(/\n/g, ' | '));
const table = row.locator('xpath=ancestor::table[1]');
await table.screenshot({ path: `${OUT}/preview-book-page.png` });
await row.screenshot({ path: `${OUT}/preview-book-row.png` });
await b.close();
console.log('done');

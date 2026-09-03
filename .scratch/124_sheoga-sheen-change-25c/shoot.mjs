// Preview proof for issue 124 — run `PORT=5199 npm run dev`, then
// `node .scratch/124_sheoga-sheen-change-25c/shoot.mjs` (playwright-core on NODE_PATH).
import { chromium } from 'playwright-core';
const OUT = '.scratch/124_sheoga-sheen-change-25c';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1180, height: 940 }, deviceScaleFactor: 2 });
pg.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });
await pg.goto('http://localhost:5199/.scratch/023_sheoga-configurator-prototype/harness.html', { waitUntil: 'networkidle' });
await pg.getByRole('button', { name: 'Open configurator' }).click();
await pg.waitForTimeout(500);
const pop = pg.locator('[data-sheoga-pop]').first();
const sel = (opt) => pg.locator('select').filter({ has: pg.locator('option', { hasText: opt }) }).first();
const say = async (tag) => {
  console.log(tag, 'DESC:', await pg.locator('[data-sheoga-desc]').first().innerText().catch(() => '(none)'));
  console.log(tag, 'SELL:', await pg.locator('[data-sheoga-sell]').first().innerText().catch(() => '(none)'));
  console.log(tag, 'CARD:', (await pop.innerText()).split('\n').filter(l => /sheen|Small-order|Sheen/i.test(l)).join(' | '));
};

// 1) Stocked tab: White Oak Cattail char 5¼", 300 sf job, sheen → 5
await pg.getByRole('button', { name: 'Stocked prefinished' }).first().click();
await pg.waitForTimeout(300);
await pg.locator('input[data-sheoga-sf]').fill('300');
await pg.getByRole('button', { name: /^Cattail/ }).first().click();
await pg.waitForTimeout(200);
await sel('30-sheen').selectOption('5');
await pg.waitForTimeout(400);
await pop.screenshot({ path: `${OUT}/P1-stocked-sheen-change.png` });
await say('P1');

// 2) Floor tab: Established stain Fresh Cut (standard 5) left at 30 → 25¢ row
await pg.getByRole('button', { name: 'Unfinished & custom' }).first().click();
await pg.waitForTimeout(300);
await pg.locator('input[data-sheoga-sf]').fill('1000');
await sel('Established stain').selectOption('est');
await pg.waitForTimeout(200);
await sel('Fresh Cut').selectOption('Fresh Cut');
await pg.waitForTimeout(400);
await pop.screenshot({ path: `${OUT}/P2-floor-freshcut-30.png` });
await say('P2');

// 3) same, sheen back to the standard 5 → no row
await sel('30-sheen').selectOption('5');
await pg.waitForTimeout(300);
await pop.screenshot({ path: `${OUT}/P3-floor-freshcut-5-standard.png` });
await say('P3');

// 4) custom color T-1: no standard, no charge
await sel('Custom color T-1').selectOption('t1');
await pg.waitForTimeout(400);
await pop.screenshot({ path: `${OUT}/P4-floor-custom-color.png` });
await say('P4');

await b.close();
console.log('done');

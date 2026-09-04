// Preview proof for issue 125 — run `PORT=5199 npm run dev`, then
// `node .scratch/125_sheoga-natural-sheen-small-order-fee/shoot.mjs` (playwright-core on NODE_PATH).
import { chromium } from 'playwright-core';
const OUT = '.scratch/125_sheoga-natural-sheen-small-order-fee';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1180, height: 940 }, deviceScaleFactor: 2 });
pg.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });
await pg.goto('http://localhost:5199/.scratch/023_sheoga-configurator-prototype/harness.html', { waitUntil: 'networkidle' });
await pg.getByRole('button', { name: 'Open configurator' }).click();
await pg.waitForTimeout(500);
const pop = pg.locator('[data-sheoga-pop]').first();
const sel = (opt) => pg.locator('select').filter({ has: pg.locator('option', { hasText: opt }) }).first();
const sfBox = pg.locator('input[data-sheoga-sf]');
const say = async (tag) => {
  console.log(tag, 'SF BOX:', JSON.stringify(await sfBox.inputValue()));
  console.log(tag, 'SELL:', await pg.locator('[data-sheoga-sell]').first().innerText().catch(() => '(none)'));
  console.log(tag, 'CARD:', (await pop.innerText()).split('\n').filter(l => /sheen|Small-order|Sheen|Job size/i.test(l)).join(' | '));
};

// 1) Job size: click, backspace the seed 1 → box goes blank, then type 300
await pg.getByRole('button', { name: 'Stocked prefinished' }).first().click();
await pg.waitForTimeout(300);
await sfBox.click();
await sfBox.press('End');
await sfBox.press('Backspace');
await pg.waitForTimeout(150);
await say('P1-blank');
await pop.screenshot({ path: `${OUT}/P1-jobsize-backspaced-blank.png` });
await sfBox.type('300');
await pg.waitForTimeout(300);
await say('P1-typed');

// 2) Stocked: White Oak Natural char 5¼", 300 sf, sheen → 5 → 25¢ + $300 small-order fee
await pg.getByRole('button', { name: /^Natural/ }).first().click();
await pg.waitForTimeout(200);
await sel('30-sheen').selectOption('5');
await pg.waitForTimeout(400);
await pop.screenshot({ path: `${OUT}/P2-stocked-natural-sheen5-300sf.png` });
await say('P2');

// 3) Floor tab: Prefinished Natural, 200 sf, sheen 5 → $600 fee; back to 30 → none
await pg.getByRole('button', { name: 'Unfinished & custom' }).first().click();
await pg.waitForTimeout(300);
await sfBox.click(); await sfBox.press('End'); await sfBox.press('Backspace'); await sfBox.press('Backspace'); await sfBox.press('Backspace'); await sfBox.type('200');
await sel('Prefinished — Natural').selectOption('nat');
await pg.waitForTimeout(200);
await sel('30-sheen').selectOption('5');
await pg.waitForTimeout(400);
await pop.screenshot({ path: `${OUT}/P3-floor-natural-sheen5-200sf.png` });
await say('P3');
await sel('30-sheen').selectOption('30');
await pg.waitForTimeout(300);
await say('P4-standard');
await b.close();
console.log('done');

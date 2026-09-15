// Preview proof for issue 141 — run `PORT=5199 npm run dev`, then
// `node .scratch/141_sheoga-custom-tab-stock-match/shoot.mjs` (playwright-core on NODE_PATH).
import { chromium } from 'playwright-core';
const OUT = '.scratch/141_sheoga-custom-tab-stock-match';
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
  console.log(tag, 'SELL:', await pg.locator('[data-sheoga-sell]').first().innerText().catch(() => '(none)'));
  console.log(tag, 'CARD:', (await pop.innerText()).split('\n').filter(l => /Small-order|Stocked item|Made to order|no fee|micro bevel|Prefinished|fee under/i.test(l)).join(' | '));
  console.log(tag, 'EDGE:', await sel('Micro bevel').inputValue(), 'square disabled:', await sel('Micro bevel').locator('option[value="square"]').isDisabled());
};

// Floor tab, 200 sf: Hickory · Character · 4¼" · Prefinished Established stain · Toasted Acorn (30 std)
await pg.getByRole('button', { name: 'Unfinished & custom' }).first().click();
await pg.waitForTimeout(300);
await sfBox.click(); await sfBox.press('End'); await sfBox.press('Backspace'); await sfBox.type('200');
await pg.getByRole('button', { name: /^Hickory/ }).first().click();
await pg.getByRole('button', { name: /^Char/ }).first().click();
await pg.getByRole('button', { name: /^4¼"/ }).first().click();
await sel('Prefinished — Natural').selectOption('est');
await pg.waitForTimeout(200);
await sel('Pick color…').selectOption('Toasted Acorn');
await pg.waitForTimeout(400);
await say('P1-stock');
await pop.screenshot({ path: `${OUT}/P1-floor-hickory-toasted-acorn-4q-200sf-no-fee.png` });

// Same build one width off stock (2¼" is a white cell) → made to order, $600 fee
await pg.getByRole('button', { name: /^2¼"/ }).first().click();
await pg.waitForTimeout(400);
await say('P2-white');
await pop.screenshot({ path: `${OUT}/P2-floor-same-at-2q-made-to-order-fee.png` });

// Back to 4¼", sheen 5 → off standard → made to order again
await pg.getByRole('button', { name: /^4¼"/ }).first().click();
await sel('30-sheen').selectOption('5');
await pg.waitForTimeout(400);
await say('P3-sheen');
await pop.screenshot({ path: `${OUT}/P3-floor-4q-sheen5-made-to-order-fee.png` });

// Stocked tab, same item: the reference — no fee
await sel('30-sheen').selectOption('30');
await pg.getByRole('button', { name: 'Stocked prefinished' }).first().click();
await pg.waitForTimeout(300);
await pg.getByRole('button', { name: /^Hickory/ }).first().click();
await pg.getByRole('button', { name: /^Toasted Acorn/ }).first().click();
await pg.getByRole('button', { name: /^4¼"/ }).first().click();
await pg.waitForTimeout(400);
console.log('P4', 'CARD:', (await pop.innerText()).split('\n').filter(l => /Small-order|Stocked item|Prefinished/i.test(l)).join(' | '));
await pop.screenshot({ path: `${OUT}/P4-stocked-hickory-toasted-acorn-4q-reference.png` });
await b.close();
console.log('done');

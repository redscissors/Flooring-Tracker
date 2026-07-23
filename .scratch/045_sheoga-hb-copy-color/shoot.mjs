import { chromium } from 'playwright';
const OUT = '.scratch/045_sheoga-hb-copy-color';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
pg.on('console', m => { if (m.type()==='error') console.log('PAGE ERR:', m.text()); });
await pg.goto('http://localhost:5199/preview.html', { waitUntil: 'networkidle' });
await pg.waitForTimeout(600);

// 1) the seeded floor tab (source config)
await pg.screenshot({ path: `${OUT}/preview-1-floor-seed.png` });

// go to Herringbone tab
await pg.getByRole('button', { name: 'Herringbone' }).first().click();
await pg.waitForTimeout(300);
// type a slat length so it prices
const slat = pg.locator('input[data-sheoga-slatlen]');
await slat.fill('24');
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${OUT}/preview-2-hb-before-copy.png` });

// click Copy floor
await pg.getByRole('button', { name: /Copy floor/ }).click();
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${OUT}/preview-3-after-copy.png` });

// grab the build card description text
const desc = await pg.locator('[data-sheoga-desc]').first().innerText().catch(()=>'(none)');
console.log('DESC:', desc);
const sell = await pg.locator('[data-sheoga-sell]').first().innerText().catch(()=>'(none)');
console.log('SELL:', sell);

// switch finishing to a custom color T-2 to show sample fee + custom stain input
await pg.getByText('Finishing', { exact: true }).first().scrollIntoViewIfNeeded();
const finSelect = pg.locator('select').filter({ hasText: 'Custom color T-2' }).first();
await finSelect.selectOption({ label: /Custom color T-2/ }).catch(async()=>{ /* fallback */ });
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${OUT}/preview-4-custom-color.png` });
const desc2 = await pg.locator('[data-sheoga-desc]').first().innerText().catch(()=>'(none)');
console.log('DESC2:', desc2);

await b.close();
console.log('done');

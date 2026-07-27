import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 2 });
pg.on('pageerror', e => console.log('PAGE THROW:', e.message));
await pg.goto('http://localhost:5199/.scratch/058_qty-override-drift/preview.html', { waitUntil: 'networkidle' });
await pg.waitForTimeout(500);

const body = () => pg.locator('body').innerText();
console.log('BEFORE carton chip:', (await body()).includes('this row is set to 17'));
await pg.getByRole('button', { name: 'Use 30' }).click();
await pg.waitForTimeout(200);
const after = await body();
console.log('AFTER  carton chip gone:', !after.includes('this row is set to 17'));
console.log('AFTER  recalculated line:', /No chip — the row is calculating (\d+) CT/.exec(after)?.[1],
            '| total:', /= \$([\d,.]+)/.exec(after)?.[1]);

console.log('BEFORE grout chip:', after.includes('this line is set to 9'));
await pg.getByRole('button', { name: 'Use 4' }).click();
await pg.waitForTimeout(200);
const after2 = await body();
console.log('AFTER  grout chip gone:', !after2.includes('this line is set to 9'));
console.log('AFTER  grout box value:', await pg.locator('input[type=number]').last().inputValue());
await b.close();

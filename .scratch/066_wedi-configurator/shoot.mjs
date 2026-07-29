import { chromium } from 'playwright';
const OUT = '.scratch/066_wedi-configurator';
const URL = 'http://localhost:5199/.scratch/066_wedi-configurator/prototype.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
const errs = [];
pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
pg.on('pageerror', e => errs.push(String(e)));
await pg.goto(URL, { waitUntil: 'load' });
await pg.waitForTimeout(900);

const popup = pg.locator('.popup');

// P1 — Kits tab, 36×60 fundo house kit built (boot state)
await popup.screenshot({ path: `${OUT}/P1-kits-house-kit.png` });

// P2 — curbless kit: click the 48×72 curbless card (US9200008)
await pg.click('[data-pan="US9200003"]');
await pg.waitForTimeout(300);
await popup.screenshot({ path: `${OUT}/P2-kits-curbless.png` });

// P3 — Custom tab: 48×66 curbed (boot solver input), extend option selected
await pg.click('[data-tab="custom"]');
await pg.waitForTimeout(300);
await pg.click('[data-opt="0"]');
await pg.waitForTimeout(400);
await popup.screenshot({ path: `${OUT}/P3-custom-48x66.png` });

// P4 — Custom: 54×66 curbless — two-side extension + corner piece; Builder tier
await pg.fill('#rw', '54'); await pg.dispatchEvent('#rw', 'change');
await pg.waitForTimeout(200);
await pg.fill('#rd', '66'); await pg.dispatchEvent('#rd', 'change');
await pg.waitForTimeout(200);
await pg.click('#segcurb [data-v="curbless"]');
await pg.waitForTimeout(300);
await pg.click('[data-tier="builder"]');
await pg.waitForTimeout(300);
await popup.screenshot({ path: `${OUT}/P4-custom-curbless-corner-builder.png` });

// P5 — Custom: 32×72 linear module + extension
await pg.click('[data-tier="retail"]');
await pg.waitForTimeout(200);
await pg.click('#segcurb [data-v="curbed"]');
await pg.waitForTimeout(200);
await pg.fill('#rw', '32'); await pg.dispatchEvent('#rw', 'change');
await pg.waitForTimeout(200);
await pg.fill('#rd', '72'); await pg.dispatchEvent('#rd', 'change');
await pg.waitForTimeout(200);
await pg.click('#segdrain [data-v="linear"]');
await pg.waitForTimeout(400);
await popup.screenshot({ path: `${OUT}/P5-custom-linear-module.png` });

// P6 — Browse tab with the consumables card + a search
await pg.click('[data-tab="browse"]');
await pg.waitForTimeout(300);
await pg.fill('#bq', 'niche');
await pg.waitForTimeout(300);
await popup.screenshot({ path: `${OUT}/P6-browse-niche.png` });

// P7 — the payload modal (Add to product lines)
await pg.fill('#bq', '');
await pg.waitForTimeout(200);
await pg.click('#badd');
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${OUT}/P7-payload-modal.png`, clip: { x: 0, y: 60, width: 1400, height: 900 } });
await pg.click('.overlay .xbtn');

// P8 — search-entry demo (E section)
await pg.locator('.ewrap').screenshot({ path: `${OUT}/P8-search-entry.png` });

// P9 — print layout sheet (emulate print media)
await pg.click('[data-tab="custom"]');
await pg.waitForTimeout(300);
await pg.fill('#rw', '48'); await pg.dispatchEvent('#rw', 'change');
await pg.waitForTimeout(150);
await pg.fill('#rd', '66'); await pg.dispatchEvent('#rd', 'change');
await pg.waitForTimeout(400);
await pg.evaluate(() => { window.print = () => {}; document.getElementById('bprint').click(); });
await pg.emulateMedia({ media: 'print' });
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${OUT}/P9-print-layout.png`, fullPage: true });
await pg.emulateMedia({ media: 'screen' });

console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'no page errors');
await b.close();

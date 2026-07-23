import { chromium } from 'playwright';
const OUT = '.scratch/047_sheoga-hb-edge-notes-mpb770';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const pg = await b.newPage({ viewport: { width: 1180, height: 940 }, deviceScaleFactor: 2 });
pg.on('console', m => console.log(`PAGE ${m.type()}:`, m.text().slice(0, 400)));
await pg.goto('http://localhost:5199/.scratch/047_sheoga-hb-edge-notes-mpb770/preview.html', { waitUntil: 'networkidle' });
await pg.waitForTimeout(800);

// 1) herringbone tab with the new Edge dropdown (default square)
const edgeSelect = pg.locator('select').filter({ hasText: 'Hand pillowed' }).first();
await edgeSelect.scrollIntoViewIfNeeded();
await pg.waitForTimeout(300);
await pg.screenshot({ path: `${OUT}/preview-1-hb-edge-dropdown.png` });

// 2) pick Hand pillowed — build card shows the +$1.00/sf edge line
await edgeSelect.selectOption({ index: 2 });
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${OUT}/preview-2-hb-edge-pillowed.png` });

// 3) the MPB770 trims popup — every Preservation Fossil trim from the export
await pg.goto('http://localhost:5199/.scratch/047_sheoga-hb-edge-notes-mpb770/preview.html?pane=trims', { waitUntil: 'networkidle' });
await pg.waitForTimeout(800);
await pg.screenshot({ path: `${OUT}/preview-3-mpb770-trims.png` });

await b.close();
console.log('done');

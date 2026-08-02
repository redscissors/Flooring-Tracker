// The bottom of the drawings rail — where the legend paragraph used to sit.
//   node .scratch/076_wedi-iso-cleanup/shoot-bottom.mjs <label>
import { chromium } from "playwright";
const OUT = ".scratch/076_wedi-iso-cleanup/shots";
const LABEL = process.argv[2] || "before";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 1.5 });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);
await pg.locator("[data-wedi-pan]").first().click();
await pg.waitForTimeout(1200);
await pg.locator(".diagcol").evaluate((el) => { el.scrollTop = el.scrollHeight; });
await pg.waitForTimeout(400);
await pg.locator(".diagcol").screenshot({ path: `${OUT}/${LABEL}-5-rail-bottom.png` });
await b.close();

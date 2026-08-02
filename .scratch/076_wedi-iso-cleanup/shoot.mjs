// Shoots the wedi configurator's drawings rail: a stock kit build (walls +
// curb) and the print layout, before/after the rail text cleanup.
//   node .scratch/076_wedi-iso-cleanup/shoot.mjs <label>
import { chromium } from "playwright";

const OUT = ".scratch/076_wedi-iso-cleanup/shots";
const LABEL = process.argv[2] || "before";
const URL = "http://127.0.0.1:5199/wedi-preview.html";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 1.5 });
pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForTimeout(1200);

// Kits tab: first pan row builds the house kit.
await pg.locator("[data-wedi-pan]").first().click();
await pg.waitForTimeout(1200);
await pg.screenshot({ path: `${OUT}/${LABEL}-1-kit-full.png` });
await pg.locator(".diagcol").screenshot({ path: `${OUT}/${LABEL}-2-rail.png` });

// Custom shower, so the rail carries a solved layout too.
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(1000);
const solve = pg.locator("button", { hasText: /^Solve/ });
if (await solve.count()) { await solve.first().click(); await pg.waitForTimeout(1200); }
const opt = pg.locator(".optcard").first();
if (await opt.count()) { await opt.click(); await pg.waitForTimeout(1200); }
await pg.locator(".diagcol").screenshot({ path: `${OUT}/${LABEL}-3-rail-custom.png` });

const print = pg.locator("button", { hasText: "Print layout" });
if (await print.count() && await print.first().isEnabled()) {
  await print.first().click();
  await pg.waitForTimeout(900);
  await pg.emulateMedia({ media: "print" });
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: `${OUT}/${LABEL}-4-print.png`, fullPage: true });
  await pg.emulateMedia({ media: "screen" });
}

await pg.close();
await b.close();
console.log(errs.length ? "console errors:\n" + errs.join("\n") : "clean");

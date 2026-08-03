// The owner's cut-pan repro: a 24 x 33 room with the drain pinned at 6" x 16"
// lands a base CUT DOWN. The hips (fold lines) must still aim at where the
// UNCUT pan's corners were — cutting a base can't re-pitch its moulded planes.
//   node .scratch/078_wedi-tile-thickness-fit/shoot-hips.mjs <label>
import { chromium } from "playwright";

const OUT = ".scratch/078_wedi-tile-thickness-fit/shots";
const LABEL = process.argv[2] || "before";
const URL = "http://127.0.0.1:5199/wedi-preview.html";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForTimeout(1000);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(700);

const size = pg.locator(".rfgrp", { hasText: "Size & curb" }).locator(".rinp");
await size.nth(0).fill("24"); await size.nth(0).press("Enter"); await pg.waitForTimeout(350);
await size.nth(1).fill("33"); await size.nth(1).press("Enter"); await pg.waitForTimeout(700);
const drain = pg.locator(".rfgrp", { hasText: "Drain" }).locator(".rinp");
await drain.nth(0).fill("6"); await drain.nth(0).press("Enter"); await pg.waitForTimeout(350);
await drain.nth(1).fill("16"); await drain.nth(1).press("Enter"); await pg.waitForTimeout(900);

// Take the first CUT option so the hips have something to disagree about.
const cards = pg.locator(".optcard");
const n = await cards.count();
let picked = -1;
for (let i = 0; i < n; i++) {
  if (/cut/i.test(await cards.nth(i).innerText())) { await cards.nth(i).click(); picked = i; break; }
}
if (picked < 0 && n) { await cards.first().click(); picked = 0; }
await pg.waitForTimeout(1100);
console.log("option:", picked < 0 ? "none" : (await cards.nth(picked).innerText()).replace(/\n/g, " | "));

await pg.locator(".diagcol").screenshot({ path: `${OUT}/hips-${LABEL}-1-rail.png` });
const plan = pg.locator(".diagcol svg").first();
await plan.screenshot({ path: `${OUT}/hips-${LABEL}-2-plan.png` });
await pg.locator(".diagcol svg").nth(1).screenshot({ path: `${OUT}/hips-${LABEL}-3-iso.png` });

await pg.close();
await b.close();
console.log(errs.length ? "page errors:\n" + errs.join("\n") : "clean");

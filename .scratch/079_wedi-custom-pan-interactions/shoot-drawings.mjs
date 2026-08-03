// Issue 079 — the drawings as they stand now, at a size you can actually read
// them: each configuration's plan and isometric, plus the corners blown up.
//   node .scratch/079_wedi-custom-pan-interactions/shoot-drawings.mjs
import { chromium } from "playwright";

const OUT = ".scratch/079_wedi-custom-pan-interactions/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 3 });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);
await pg.locator(".pancard").nth(2).click();     // 3' × 5' curbed
await pg.waitForTimeout(700);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(500);

const plan = pg.locator(".diagcol svg").first();
const iso = pg.locator(".diagcol svg").nth(1);

// A quarter of a drawing, blown up — which quarter by name.
const quarter = async (loc, where, path) => {
  const r = await loc.boundingBox();
  const w = r.width * 0.58, h = r.height * 0.58;
  const x = /left/.test(where) ? r.x : r.x + r.width - w;
  const y = /top|back/.test(where) ? r.y : r.y + r.height - h;
  await pg.screenshot({ path, clip: { x, y, width: w, height: h } });
};

const shots = async (tag) => {
  await plan.screenshot({ path: `${OUT}/D-${tag}-plan.png` });
  await iso.screenshot({ path: `${OUT}/D-${tag}-iso.png` });
  await quarter(plan, "left-front", `${OUT}/D-${tag}-plan-front-left.png`);
  await quarter(iso, "left-front", `${OUT}/D-${tag}-iso-front-left.png`);
};

await shots("1-curbed-3walls");

await pg.locator(".rseg button", { hasText: "Curbless" }).click();
await pg.waitForTimeout(900);
await shots("2-curbless");

await pg.locator(".rseg button", { hasText: "Curbed" }).click();
await pg.waitForTimeout(900);
await pg.locator(".wallrow .wname", { hasText: "Back" }).click();
await pg.waitForTimeout(900);
await shots("3-no-back-wall");

await pg.locator(".wallrow .wname", { hasText: "Back" }).click();
await pg.waitForTimeout(600);
await pg.locator(".rseg button", { hasText: "Max — curb inside" }).click();
await pg.waitForTimeout(900);
await shots("4-max-curb-inside");

await pg.close();
await b.close();

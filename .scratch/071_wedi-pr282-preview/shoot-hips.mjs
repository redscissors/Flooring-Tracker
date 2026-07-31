// Hip lines land on the 4×4 cover's corners — plan + iso, center & offset drains.
// Usage: node .scratch/071_wedi-pr282-preview/shoot-hips.mjs <suffix>
import { chromium } from "playwright";
const OUT = ".scratch/071_wedi-pr282-preview";
const TAG = process.argv[2] || "after";
const URL = "http://localhost:5199/wedi-preview.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForTimeout(1400);

const diagcol = pg.locator(".diagcol");
const field = (label) => pg.locator(".rf", { hasText: label }).locator("input");
const setNum = async (label, i, v) => {
  const el = field(label).nth(i);
  await el.fill(String(v)); await el.press("Enter"); await pg.waitForTimeout(350);
};

await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(400);

// J1 — a plain centered-drain pan with extensions (the E-shot room).
await setNum("Shower size", 0, 60);
await setNum("Shower size", 1, 66);
await pg.waitForTimeout(700);
await diagcol.screenshot({ path: `${OUT}/J1-hips-center-${TAG}.png` });

// J2 — an offset drain: hips reach an off-centre cover.
await pg.locator(".rf", { hasText: "Drain preference" }).locator("button", { hasText: "Offset" }).click();
await setNum("Shower size", 0, 36);
await setNum("Shower size", 1, 60);
await pg.waitForTimeout(700);
await diagcol.screenshot({ path: `${OUT}/J2-hips-offset-${TAG}.png` });

console.log("errors:", errs.slice(0, 8));
await b.close();

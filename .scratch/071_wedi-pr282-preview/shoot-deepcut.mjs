import { chromium } from "playwright";
const OUT = ".scratch/071_wedi-pr282-preview";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto("http://localhost:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1400);

const popup = pg.locator("[data-wedi-pop]");
const custom = pg.locator(".modetab", { hasText: "Custom shower" });
await custom.click();
await pg.waitForTimeout(400);
const field = (label) => pg.locator(".rf", { hasText: label }).locator("input");
const setNum = async (label, i, v) => {
  const el = field(label).nth(i);
  await el.fill(String(v)); await el.press("Enter"); await pg.waitForTimeout(350);
};
await setNum("Shower size", 0, 58);
await setNum("Shower size", 1, 33);
await pg.locator(".rf", { hasText: "Drain preference" }).locator("button", { hasText: "Offset" }).click();
await pg.waitForTimeout(300);
await setNum("Drain — from left", 0, 6);
await setNum("Drain — from left", 1, 16.5);
await pg.waitForTimeout(700);
await popup.screenshot({ path: `${OUT}/I1-58x33-deep-cut-options.png` });
console.log("errors:", errs.slice(0, 5));
await b.close();

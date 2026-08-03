// Proves the tile-thickness gate: the field only takes a number when the
// stated size is the overall footprint AND the shower has a curb.
//   node .scratch/078_wedi-tile-thickness-fit/shoot-gate.mjs
import { chromium } from "playwright";

const OUT = ".scratch/078_wedi-tile-thickness-fit/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1000);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(700);

const card = pg.locator(".rfgrp", { hasText: "Size & curb" });
const tile = card.locator(".rinp.tin");
const state = async (what) => {
  const s = await tile.evaluate((el) => ({ disabled: el.disabled, ph: el.placeholder, v: el.value }));
  console.log(what.padEnd(28), JSON.stringify(s));
  return s;
};

await state("pan size + curbed");
await card.locator(".rinp.tin").screenshot({ path: `${OUT}/gate-1-pansize.png` });

await card.locator("button", { hasText: "Max — curb inside" }).click();
await pg.waitForTimeout(800);
await state("max + curbed");
await tile.fill("3/8");
await tile.press("Enter");
await pg.waitForTimeout(800);
await state("max + curbed, typed 3/8");
await card.screenshot({ path: `${OUT}/gate-2-max-live.png` });

await card.locator("button", { hasText: "Curbless" }).click();
await pg.waitForTimeout(900);
await state("max + curbless");
await card.screenshot({ path: `${OUT}/gate-3-max-curbless.png` });

await card.locator("button", { hasText: "Curbed" }).click();
await pg.waitForTimeout(900);
await card.locator("button", { hasText: "Pan size" }).click();
await pg.waitForTimeout(900);
await state("back to pan size");
await card.screenshot({ path: `${OUT}/gate-4-back-to-pansize.png` });

await pg.close();
await b.close();

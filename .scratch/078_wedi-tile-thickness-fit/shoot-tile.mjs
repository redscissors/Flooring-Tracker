// Proves the tile thickness: a 60 x 36 "Max — curb inside" shower solved with
// no tile, then with 3/8" of tile on the curb face. The pan has to give the
// tile up along with the curb, so the second solve lands a shallower base and
// the drawing holds the curb 3/8" off the stated line.
//   node .scratch/078_wedi-tile-thickness-fit/shoot-tile.mjs
import { chromium } from "playwright";

const OUT = ".scratch/078_wedi-tile-thickness-fit/shots";
const URL = "http://127.0.0.1:5199/wedi-preview.html";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 1.5 });
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForTimeout(1000);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(700);

const form = pg.locator(".rfgrp", { hasText: "Size & curb" });
const size = form.locator(".rinp");
await size.nth(0).fill("60"); await size.nth(0).press("Enter"); await pg.waitForTimeout(350);
await size.nth(1).fill("36"); await size.nth(1).press("Enter"); await pg.waitForTimeout(600);
await form.locator("button", { hasText: "Max — curb inside" }).click();
await pg.waitForTimeout(800);
const pick = async () => {
  const o = pg.locator(".optcard").first();
  if (await o.count()) { await o.click(); await pg.waitForTimeout(1000); }
};
const readOut = async () => ({
  head: (await pg.locator(".buildcol .bh-sub, .buildcol").first().innerText()).split("\n").find((l) => /base/.test(l)) || "",
  card: await pg.locator(".optcard").first().innerText(),
});

await pick();
await pg.screenshot({ path: `${OUT}/tile-1-max-notile-full.png` });
await pg.locator(".diagcol").screenshot({ path: `${OUT}/tile-2-max-notile-rail.png` });
console.log("no tile   :", JSON.stringify(await readOut(), null, 0));

// 3/8" of tile on the curb's outer face.
await form.locator(".rinp").nth(2).fill("0.375");
await form.locator(".rinp").nth(2).press("Enter");
await pg.waitForTimeout(1000);
await pick();
await pg.screenshot({ path: `${OUT}/tile-3-max-tile-full.png` });
await pg.locator(".diagcol").screenshot({ path: `${OUT}/tile-4-max-tile-rail.png` });
await pg.locator(".roomform").screenshot({ path: `${OUT}/tile-5-form-live.png` });
console.log("3/8 tile  :", JSON.stringify(await readOut(), null, 0));

await pg.close();
await b.close();
console.log(errs.length ? "page errors:\n" + errs.join("\n") : "clean");

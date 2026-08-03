// Diagnostic for the owner's "added wall goes all the way to the end vs just
// against the side wall". Adds a partial entry wall to a 60 x 36 shower and
// shoots the plan + iso, with and without the left side wall it should meet.
//   node .scratch/078_wedi-tile-thickness-fit/shoot-wall.mjs
import { chromium } from "playwright";

const OUT = ".scratch/078_wedi-tile-thickness-fit/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1000);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(700);
const size = pg.locator(".rfgrp", { hasText: "Size & curb" }).locator(".rinp");
await size.nth(0).fill("60"); await size.nth(0).press("Enter"); await pg.waitForTimeout(350);
await size.nth(1).fill("36"); await size.nth(1).press("Enter"); await pg.waitForTimeout(700);
const opt = pg.locator(".optcard").first();
if (await opt.count()) { await opt.click(); await pg.waitForTimeout(1000); }

const addWall = pg.locator("button", { hasText: "Add wall" });
if (await addWall.count()) { await addWall.first().click(); await pg.waitForTimeout(500); }
// The click lands on the plan's entry edge.
const svg = pg.locator(".diagcol svg").first();
const box = await svg.boundingBox();
await pg.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.80);
await pg.waitForTimeout(1100);

const shot = async (tag) => {
  await pg.locator(".diagcol svg").first().screenshot({ path: `${OUT}/wall-${tag}-plan.png` });
  await pg.locator(".diagcol svg").nth(1).screenshot({ path: `${OUT}/wall-${tag}-iso.png` });
  const wl = await pg.locator(".buildcol").innerText();
  console.log(tag, "|", wl.split("\n").filter((l) => /^(Back|Left|Right|Entry)$/.test(l.trim())).join(","));
};
await shot("1-with-side-walls");

// Same wall, side walls off — nothing for it to butt into.
for (const s of ["Left", "Right"]) {
  const chip = pg.locator(".rchip", { hasText: s });
  if (await chip.count()) { await chip.first().click(); await pg.waitForTimeout(500); }
}
await pg.waitForTimeout(900);
await shot("2-no-side-walls");

await pg.close();
await b.close();

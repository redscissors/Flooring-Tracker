// The two drawings the owner asked to see after the wall-corner change:
// the standard three-wall shower, then the same with a small half wall added
// on the front (entry).
//   node .scratch/078_wedi-tile-thickness-fit/shoot-halfwall.mjs
import { chromium } from "playwright";

const OUT = ".scratch/078_wedi-tile-thickness-fit/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1000);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(700);

const size = pg.locator(".rfgrp", { hasText: "Size & curb" }).locator(".rinp");
await size.nth(0).fill("60"); await size.nth(0).press("Enter"); await pg.waitForTimeout(350);
await size.nth(1).fill("36"); await size.nth(1).press("Enter"); await pg.waitForTimeout(700);
const opt = pg.locator(".optcard").first();
if (await opt.count()) { await opt.click(); await pg.waitForTimeout(1000); }

const shot = async (tag) => {
  await pg.locator(".diagcol").screenshot({ path: `${OUT}/${tag}-rail.png` });
  await pg.locator(".diagcol svg").first().screenshot({ path: `${OUT}/${tag}-plan.png` });
  await pg.locator(".diagcol svg").nth(1).screenshot({ path: `${OUT}/${tag}-iso.png` });
  const rows = (await pg.locator(".buildcol").innerText()).split("\n");
  console.log(tag, "walls:", rows.filter((l) => /^(Back|Left|Right|Entry)$/.test(l.trim())).join(" "));
};

// A — the standard three-wall shower: back, left, right.
await shot("std3");

// B — the same plus a small half wall on the front. "+ Add wall" then a click
// on the plan's entry edge; it lands at the 24" default.
await pg.locator("button", { hasText: "Add wall" }).first().click();
await pg.waitForTimeout(500);
const box = await pg.locator(".diagcol svg").first().boundingBox();
await pg.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.80);
await pg.waitForTimeout(1200);
await shot("halfwall");

await pg.close();
await b.close();
console.log(errs.length ? "page errors:\n" + errs.join("\n") : "clean");

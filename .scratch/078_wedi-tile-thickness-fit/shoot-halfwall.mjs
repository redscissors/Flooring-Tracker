// The front half wall through its four states (owner ask 2026-08-03): none,
// returning from the left, from the right, and one on each end with the
// walk-in between them.
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
  const rows = (await pg.locator(".buildcol").innerText()).split("\n").map((l) => l.trim());
  console.log(tag.padEnd(16), "walls:", rows.filter((l) => /^(Back|Left|Right|Front|Entry)( |$)/.test(l)).join(" | "));
};

// A — the standard three walls.
await shot("std3");

// Click the FAR half of the entry edge → a wall returning from the right.
const addAt = async (frac) => {
  await pg.locator("button", { hasText: "Add wall" }).first().click();
  await pg.waitForTimeout(400);
  const box = await pg.locator(".diagcol svg").first().boundingBox();
  await pg.mouse.click(box.x + box.width * frac, box.y + box.height * 0.80);
  await pg.waitForTimeout(1200);
};

await addAt(0.72);
await shot("halfwall-right");

// Flip it to the left end from the build column's wall row.
await pg.locator(".wallrow .wname", { hasText: /Front|Entry/ }).first().click();
await pg.waitForTimeout(1100);
await shot("halfwall-left");

// And a second one on the other end — both sides, walk-in in the middle.
await addAt(0.72);
await shot("halfwall-both");

await pg.close();
await b.close();
console.log(errs.length ? "page errors:\n" + errs.join("\n") : "clean");

// Shoots the wedi Custom-shower tab: the room form (tile thickness + tightened
// cards) and the drawings rail (fit-to-height), before/after issue 078.
//   node .scratch/078_wedi-tile-thickness-fit/shoot.mjs <label> [wxh ...]
import { chromium } from "playwright";

const OUT = ".scratch/078_wedi-tile-thickness-fit/shots";
const LABEL = process.argv[2] || "before";
const SIZES = (process.argv.slice(3).length ? process.argv.slice(3) : ["1680x980", "1440x900", "1920x1080"])
  .map((s) => { const [w, h] = s.split("x").map(Number); return { width: w, height: h }; });
const URL = "http://127.0.0.1:5199/wedi-preview.html";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
for (const viewport of SIZES) {
  const tag = `${viewport.width}x${viewport.height}`;
  const pg = await b.newPage({ viewport, deviceScaleFactor: 1.25 });
  pg.on("console", (m) => { if (m.type() === "error") errs.push(tag + ": " + m.text()); });
  pg.on("pageerror", (e) => errs.push(tag + ": " + String(e)));
  await pg.goto(URL, { waitUntil: "load" });
  await pg.waitForTimeout(1000);

  // Custom shower, 60 x 36 curbed with a center drain — the owner's screenshot.
  await pg.locator(".modetab", { hasText: "Custom shower" }).click();
  await pg.waitForTimeout(700);
  const nums = pg.locator(".roomform .rinp");
  await nums.nth(0).fill("60");
  await nums.nth(0).press("Enter");
  await pg.waitForTimeout(400);
  await nums.nth(1).fill("36");
  await nums.nth(1).press("Enter");
  await pg.waitForTimeout(600);
  await pg.locator(".rfgrp", { hasText: "Drain" }).locator("button", { hasText: "Center" }).click();
  await pg.waitForTimeout(700);
  const opt = pg.locator(".optcard").first();
  if (await opt.count()) { await opt.click(); await pg.waitForTimeout(1100); }

  await pg.screenshot({ path: `${OUT}/${LABEL}-${tag}-1-full.png` });
  await pg.locator(".roomform").screenshot({ path: `${OUT}/${LABEL}-${tag}-2-form.png` });
  await pg.locator(".diagcol").screenshot({ path: `${OUT}/${LABEL}-${tag}-3-rail.png` });
  const scroll = await pg.locator(".diagcol").evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  console.log(`${tag} rail: scrollHeight ${scroll.sh} / clientHeight ${scroll.ch}` + (scroll.sh > scroll.ch + 2 ? "  ← SCROLLS" : "  ← fits"));
  await pg.close();
}
await b.close();
console.log(errs.length ? "console errors:\n" + errs.join("\n") : "clean");

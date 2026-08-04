// A FRAMED bench on the left wall and on the right (near) wall — the two faults
// the owner reported 2026-08-04: the wall band reads short beside it, and the
// curb paints over it on the near side.
// node .scratch/079_wedi-custom-pan-interactions/probe-framed.mjs
import { chromium } from "playwright";

const OUT = ".scratch/079_wedi-custom-pan-interactions/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 6 });
pg.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1400);
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(700);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(500);

const at = (fx, fy) => pg.evaluate(([px, py]) => {
  const s = document.querySelector(".diagcol svg");
  const p = [...s.querySelectorAll("rect")].find((e) => e.getAttribute("fill") === "#DCE5CD");
  const r = s.getBoundingClientRect(), k = r.width / s.viewBox.baseVal.width;
  return [r.left + (+p.getAttribute("x") + +p.getAttribute("width") * px) * k,
    r.top + (+p.getAttribute("y") + +p.getAttribute("height") * py) * k];
}, [fx, fy]);

async function addFramed(fx, label) {
  const [x, y] = await at(fx, 0.45);
  await pg.mouse.move(x, y); await pg.waitForTimeout(300);
  await pg.mouse.click(x, y); await pg.waitForTimeout(700);
  const opts = pg.locator(".wedi-benchmenu .bm-opt");
  console.log(label, "menu:", (await opts.allTextContents()).map((s) => s.slice(0, 40)));
  // "Installer-framed" is the second offer on the add menu
  const framed = pg.locator(".wedi-benchmenu .bm-opt", { hasText: /framed/i });
  if (await framed.count()) await framed.first().click();
  else await opts.first().click();
  await pg.waitForTimeout(1000);
  await pg.mouse.move(4, 4); await pg.waitForTimeout(400);
}

async function shoot(tag) {
  await pg.keyboard.press("Escape"); await pg.mouse.click(8, 8); await pg.waitForTimeout(600);
  await pg.locator(".diagcol svg").first().screenshot({ path: `${OUT}/framed-${tag}-plan.png` });
  await pg.locator(".diagcol svg").nth(1).screenshot({ path: `${OUT}/framed-${tag}-iso.png` });
}

await addFramed(0.10, "LEFT");
// if it landed as a 2" build-up, flip the build to Framed in the bench card
const framedBtn = pg.locator(".wedi-benchcard button", { hasText: /^Framed$/ });
if (await framedBtn.count()) { await framedBtn.first().click(); await pg.waitForTimeout(900); }
await shoot("left");

// remove it, then put one on the near (right) wall
const del = pg.locator(".bline", { hasText: /BENCH/i }).first().locator(".xb, .del, button[title*='emove']");
if (await del.count()) { await del.first().click(); await pg.waitForTimeout(800); }
await addFramed(0.90, "RIGHT");
const fb2 = pg.locator(".wedi-benchcard button", { hasText: /^Framed$/ });
if (await fb2.count()) { await fb2.first().click(); await pg.waitForTimeout(900); }
await shoot("right");

await pg.close();
await b.close();

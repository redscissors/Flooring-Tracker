// Preview proof for issue 079 — four asks on the wedi Custom shower tab.
//   node .scratch/079_wedi-custom-pan-interactions/shoot.mjs
import { chromium } from "playwright";

const OUT = ".scratch/079_wedi-custom-pan-interactions/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);

const pop = pg.locator("[data-wedi-pop]");
const rail = pg.locator(".diagcol");
const main = pg.locator(".main");

// --- 1 · a kit, then straight to Custom: the toggle moves the drawing --------
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(600);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(500);
await pop.screenshot({ path: `${OUT}/1-kit-on-custom.png` });
await rail.screenshot({ path: `${OUT}/1a-drawing-pan-size.png` });

await pg.locator(".rseg button", { hasText: "Max — curb inside" }).click();
await pg.waitForTimeout(900);
await pop.screenshot({ path: `${OUT}/2-max-curb-inside.png` });
await rail.screenshot({ path: `${OUT}/2a-drawing-max.png` });
console.log("after Max:", await pg.locator(".optcard.on .t").textContent().catch(() => "(no card selected)"));

await pg.locator(".rseg button", { hasText: "Pan size" }).click();
await pg.waitForTimeout(900);
await rail.screenshot({ path: `${OUT}/3a-drawing-back-to-pan-size.png` });
console.log("back to Pan size:", await pg.locator(".optcard.on .t").textContent().catch(() => "(no card selected)"));

// --- 2 · the option cards flow and scroll ----------------------------------
await main.screenshot({ path: `${OUT}/4-optcards-flow.png` });
console.log("cards:", await pg.locator(".optcard").count(),
  "· rows:", await pg.evaluate(() => {
    const tops = [...document.querySelectorAll(".optcard")].map((e) => Math.round(e.getBoundingClientRect().top));
    return new Set(tops).size;
  }));

// --- 3 · the wall editor now lives in the Walls group ----------------------
await pg.locator(".rfgrp", { hasText: "Walls" }).screenshot({ path: `${OUT}/5-wall-editor-in-form.png` });
console.log("wall rows in the form:", await pg.locator(".rfgrp .wallrow").count(),
  "· in the build column:", await pg.locator(".buildcol .wallrow").count());
await pg.locator(".buildcol").screenshot({ path: `${OUT}/6-build-column.png` });

// --- 4 · the wall bands meet the curb --------------------------------------
const box = await pg.locator(".diagcol svg").first().boundingBox();
await pg.screenshot({ path: `${OUT}/7-corner-front-left.png`, clip: { x: box.x + 10, y: box.y + box.height - 120, width: 190, height: 110 } });
// back wall off — the back curb turns the corner into the side walls
await pg.locator(".wallrow .wname", { hasText: "Back" }).click();
await pg.waitForTimeout(800);
await rail.screenshot({ path: `${OUT}/8-no-back-wall.png` });

// --- narrow window: everything still flows ---------------------------------
await pg.setViewportSize({ width: 1180, height: 900 });
await pg.waitForTimeout(700);
await pop.screenshot({ path: `${OUT}/9-narrow-1180.png` });

await pg.close();
await b.close();

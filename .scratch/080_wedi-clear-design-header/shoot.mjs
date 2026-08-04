// Preview proof — "Clear design" moved into the popup head, left of the tier bar.
import { chromium } from "playwright";

const OUT = ".scratch/080_wedi-clear-design-header/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1400);

const head = pg.locator(".pop-head");
const pop = pg.locator("[data-wedi-pop]");

const geo = async (label) => {
  const c = await pg.locator("[data-wedi-clear]").boundingBox();
  const t = await pg.locator(".tierbar").boundingBox();
  console.log(label, "clear:", c && Math.round(c.x) + "→" + Math.round(c.x + c.width),
    "| tierbar:", t && Math.round(t.x) + "→" + Math.round(t.x + t.width),
    "| clear left of tiers:", !!(c && t) && c.x + c.width <= t.x);
};

// Kits tab — the head button is there before any design exists
await head.screenshot({ path: `${OUT}/1-head-kits.png` });
await geo("kits tab   ");
console.log("clear buttons in the walls group:", await pg.locator(".rfgrp [data-wedi-clear]").count());

// build a kit, go to Custom shower, confirm the walls group lost its copy
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(600);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(700);
await pop.screenshot({ path: `${OUT}/2-custom-tab.png` });
await head.screenshot({ path: `${OUT}/3-head-custom.png` });
await geo("custom tab ");
console.log("clear buttons in the walls group:", await pg.locator(".rfgrp [data-wedi-clear]").count(),
  "· in the head:", await pg.locator(".pop-head [data-wedi-clear]").count());
await pg.locator(".rfgrp", { hasText: "Walls" }).first().screenshot({ path: `${OUT}/4-walls-group.png` });

// it still clears
console.log("lines before clear:", await pg.locator(".buildcol .bline").count());
await pg.locator("[data-wedi-clear]").click();
await pg.waitForTimeout(800);
console.log("lines after clear:", await pg.locator(".buildcol .bline").count(),
  "· toast:", await pg.locator(".wedi-toast").textContent().catch(() => "(none)"));
await pop.screenshot({ path: `${OUT}/5-after-clear.png` });

// narrow window
await pg.setViewportSize({ width: 1180, height: 900 });
await pg.waitForTimeout(600);
await head.screenshot({ path: `${OUT}/6-head-narrow.png` });
await geo("narrow 1180");

await b.close();

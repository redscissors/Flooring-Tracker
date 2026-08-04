// Issue 079 · the surrounding flows still work with the wall editor moved:
// the Kits tab, the drawing's own wall/corner clicks, and the kit → custom
// hand-off that a geometry change triggers.
//   node .scratch/079_wedi-custom-pan-interactions/shoot-flow.mjs
import { chromium } from "playwright";

const OUT = ".scratch/079_wedi-custom-pan-interactions/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);

const tab = () => pg.locator(".modetab.on").first().textContent();
const pop = pg.locator("[data-wedi-pop]");

// Kits tab: a kit builds, and the build column carries no wall editor.
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(600);
console.log("kits · tab:", await tab(),
  "· editor rows in build column:", await pg.locator(".buildcol .wallrow").count(),
  "· Fit/One size still there:", await pg.locator(".buildcol .pfseg").count());
await pop.screenshot({ path: `${OUT}/10-kits-tab.png` });

// A corner click on the drawing is a geometry change — the kit hands off to
// the Custom tab, which is where the wall editor now lives.
// viewBox point -> client point, off the pan rect the plan draws
const at = (fx, fy) => pg.evaluate(([px, py]) => {
  const svg = document.querySelector(".diagcol svg");
  const pan = [...svg.querySelectorAll("rect")].find((e) => e.getAttribute("fill") === "#DCE5CD");
  const r = svg.getBoundingClientRect(), k = r.width / svg.viewBox.baseVal.width;
  const x = +pan.getAttribute("x") + +pan.getAttribute("width") * px;
  const y = +pan.getAttribute("y") + +pan.getAttribute("height") * py;
  return [r.left + x * k, r.top + y * k];
}, [fx, fy]);

const [cx, cy] = await at(0.01, 0.99);      // front-left corner
await pg.mouse.click(cx, cy);
await pg.waitForTimeout(900);
console.log("after a corner click · tab:", await tab(),
  "· corner cuts:", await pg.locator(".rfgrp .addchips .wu").textContent().catch(() => "none"));
await pop.screenshot({ path: `${OUT}/11-handoff-to-custom.png` });

// Add a wall from the form, place it on the drawing.
await pg.locator(".addchip", { hasText: "Add wall" }).click();
await pg.waitForTimeout(300);
const [ex, ey] = await at(0.75, 1);   // the entry edge, right half
await pg.mouse.click(ex, ey);
await pg.waitForTimeout(900);
console.log("added walls:", await pg.locator(".rfgrp .wallrow").count());
await pg.locator(".rfgrp", { hasText: "Walls" }).screenshot({ path: `${OUT}/12-added-wall-row.png` });

await pg.locator(".modetab", { hasText: "Browse" }).click();
await pg.waitForTimeout(500);
await pop.screenshot({ path: `${OUT}/13-browse-tab.png` });

await pg.close();
await b.close();

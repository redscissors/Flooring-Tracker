// Round-6 preview shots (custom-shower flow + drawing overhaul): drives the
// REAL WediConfigurator through wedi-preview.html. Serve with
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vite --port 5199
// then `node .scratch/066_wedi-configurator/shoot-round6.mjs`.
import { chromium } from "playwright";
const OUT = ".scratch/066_wedi-configurator";
const URL = "http://localhost:5199/wedi-preview.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForTimeout(1200);

const popup = pg.locator("[data-wedi-pop]");
const diagcol = pg.locator(".diagcol");
const topSvg = () => pg.locator(".diagcol svg").first();

// X1 — 36×60 house kit untouched: square drain, 4"-thick walls in both views,
// the right + entry side of the isometric clear.
await pg.click('[data-wedi-pan="US9100004"]');
await pg.waitForTimeout(500);
await popup.screenshot({ path: `${OUT}/X1-kit-drawings.png` });
await diagcol.screenshot({ path: `${OUT}/X1b-drawings-closeup.png` });

// X2 — modify the kit (shorten the right wall): the build moves itself to the
// Custom shower tab, form seeded from the kit, build column keeping the
// modified kit.
const rightLen = pg.locator(".wallrow").nth(2).locator("input").first();
await rightLen.fill("28");
await rightLen.press("Enter");
await pg.waitForTimeout(600);
const activeTab = await pg.locator(".modetab.on").textContent();
console.log("after modify, active tab:", activeTab);
await popup.screenshot({ path: `${OUT}/X2-modified-moves-to-custom.png` });

// X3 — right-click the shortened right wall in the TOP-DOWN view: the wall
// menu (size + wedi faces). Bands carry .wband in dWalls order (back, left,
// right).
const svg1 = await topSvg().boundingBox();
await topSvg().locator(".wband").nth(2).click({ button: "right" });
await pg.waitForTimeout(400);
await popup.screenshot({ path: `${OUT}/X3-wall-menu-topdown.png` });

// X4 — set that wall to "Both sides": moss edge on the outside face, the
// wall's sf doubles in the build column.
await pg.locator("[data-wedi-wallmenu] .pfseg button", { hasText: "Both sides" }).click();
await pg.waitForTimeout(400);
await popup.screenshot({ path: `${OUT}/X4-wall-both-sides.png` });
await pg.mouse.click(svg1.x + svg1.width * 0.5, svg1.y + 8); // dismiss
await pg.waitForTimeout(300);

// X5 — right-click a wall in the ISOMETRIC view; set In + end on the back
// wall (solid slabs draw first, so nth(0) is the back wall group).
const isoSvg = pg.locator(".diagcol svg").nth(1);
const bb = await isoSvg.locator(".wband").nth(0).boundingBox();
await pg.mouse.click(bb.x + bb.width * 0.3, bb.y + bb.height * 0.45, { button: "right" });
await pg.waitForTimeout(400);
const menuUp = await pg.locator("[data-wedi-wallmenu]").count();
console.log("iso right-click opened menu:", menuUp === 1);
await diagcol.screenshot({ path: `${OUT}/X5-wall-menu-iso.png` });
if (menuUp) {
  await pg.locator("[data-wedi-wallmenu] .pfseg button", { hasText: "In + end" }).click();
  await pg.waitForTimeout(300);
  await pg.mouse.click(svg1.x + svg1.width * 0.5, svg1.y + 8);
  await pg.waitForTimeout(300);
}

// X6 — cut the open entry-right corner: full-size pan kept, triangle ghosted,
// rust cut line, curb riding the cut — in both views.
await pg.getByText("Cut open corners").click();
await pg.waitForTimeout(500);
await diagcol.screenshot({ path: `${OUT}/X6-corner-cut-ghost.png` });

// X7 — back on Kits, clicking a kit card asks before overwriting the custom
// shower.
await pg.locator(".modetab").nth(0).click();
await pg.waitForTimeout(300);
await pg.click('[data-wedi-pan="US9100006"]');
await pg.waitForTimeout(400);
await pg.screenshot({ path: `${OUT}/X7-overwrite-confirm.png` });

// X8 — Overwrite: everything resets to the stock 36×72 kit.
await pg.locator("[data-wedi-overwrite-yes]").click();
await pg.waitForTimeout(500);
const wallsAfter = await pg.locator(".wallrow").count();
const tabAfter = await pg.locator(".modetab.on").textContent();
console.log("after overwrite: tab", JSON.stringify(tabAfter), "wall rows", wallsAfter);
await popup.screenshot({ path: `${OUT}/X8-after-overwrite-reset.png` });

// X9 — "Keep the custom shower" leaves the modified build alone.
const rl2 = pg.locator(".wallrow").nth(2).locator("input").first();
await rl2.fill("20");
await rl2.press("Enter");
await pg.waitForTimeout(500);
await pg.locator(".modetab").nth(0).click();
await pg.waitForTimeout(300);
await pg.click('[data-wedi-pan="US9100004"]');
await pg.waitForTimeout(300);
await pg.getByText("Keep the custom shower").click();
await pg.waitForTimeout(300);
const kept = await pg.locator(".wallrow").nth(2).locator("input").first().inputValue();
console.log("kept custom shower — right wall still:", kept);

// X10 — print sheet carries the new drawings.
await pg.locator(".modetab").nth(1).click();
await pg.waitForTimeout(300);
await pg.evaluate(() => { window.print = () => {}; });
await pg.locator("button:has-text('Print layout')").click();
await pg.emulateMedia({ media: "print" });
await pg.waitForTimeout(250);
await pg.screenshot({ path: `${OUT}/X10-print-new-drawings.png`, fullPage: true });
await pg.emulateMedia({ media: "screen" });

console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();

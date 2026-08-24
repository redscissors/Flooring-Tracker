// Preview-proof rig for Schluter parity round 6 (owner verdicts on the issue
// 105 inventory, 2026-08-24): full-kit prices under a Kits-tab wall-system
// seg, the ramp as an opt-in chip, wedi blur-commit inputs, per-wall faces in
// the wall menu, "Turn into a curb" running the curb along the opened edge,
// the figurer's Add to build, toasts, and KERDI-FIX off the standing recipe.
//
//   npx vite --port 5199
//   node .scratch/106_schluter-parity-round6/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { mkdirSync } from "node:fs";

const OUT = ".scratch/106_schluter-parity-round6";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5199/schluter-preview.html";

let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
pg.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200)); });

const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };

await pg.goto(URL);
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await wait(600);

// p1 — Kits tab: every row prices the FULL kit under the wall-system seg
// (KERDI over backer selected), exception-only tags.
await shot("p1-kits-fullkit-membrane");

// p2 — flip the seg to KERDI-BOARD: every row reprices in place.
await pg.locator("[data-schluter-kits-board]").click();
await wait(600);
await shot("p2-kits-fullkit-board");

// build the 60×38 kit (keeps the Board wall system through the reset)
await pg.locator('[data-schluter-tray="KST965/1525"]').click();
await wait(700);

// p3 — right-click the LEFT wall band: the menu carries the faces seg; "Both
// sides" doubles the wall's sf in the header line.
const svg = pg.locator(".diagcol svg").first();
const box = await svg.boundingBox();
const geo = await pg.evaluate(() => {
  const el = document.querySelector(".diagcol svg");
  const [, , vw, vh] = el.getAttribute("viewBox").split(" ").map(Number);
  const r = el.querySelector("rect");
  return { vw, vh, x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width"), h: +r.getAttribute("height") };
});
const planPt = (rx, ry) => ({
  x: box.x + ((geo.x + geo.w * rx) / geo.vw) * box.width,
  y: box.y + ((geo.y + geo.h * ry) / geo.vh) * box.height,
});
const lw = planPt(-0.03, 0.5);   // just left of the room rect — the left wall band
await pg.mouse.click(lw.x, lw.y, { button: "right" });
await pg.waitForSelector("[data-schluter-faces-both]", { timeout: 5000 });
await pg.locator("[data-schluter-faces-both]").click();
await wait(400);
await shot("p3-wall-menu-faces-both");

// p4 — "Turn into a curb": the left edge's run joins the curb band in both
// views, the bill's curb line re-figures, the popup moved to Custom (toast).
await pg.locator("[data-schluter-faces-in]").click();
await wait(200);
await pg.locator("[data-schluter-wall-off]").click();
await wait(700);
await shot("p4-turn-into-curb-left-edge");

// p5 — curbless TT kit: the ramp is a chip now, not an auto line — first shot
// unbilled, then toggled on.
await pg.locator("[data-schluter-clear]").click();
await wait(400);
await pg.locator('.modetab:has-text("Kits")').click();
await wait(300);
await pg.locator('[data-schluter-tray="KST965BF"]').click();
await wait(600);
await pg.locator("[data-schluter-rampchip]").click();
await wait(500);
await shot("p5-curbless-ramp-chip-on");

// p6 — Browse figurer: Add to build lands the KERDI + ALL-SET shortfall as
// Extras (toast says for how many sf). KERDI-FIX is a chip, not a recipe line.
await pg.locator('.modetab:has-text("Browse")').click();
await wait(400);
await pg.locator('.gchip:has-text("Figure thin-set")').click();
await wait(300);
await pg.locator("[data-schluter-figadd]").click();
await wait(500);
await shot("p6-figurer-add-to-build");

await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }
console.log("done");

// Preview-proof rig for issue 100 — the Schluter⇄wedi parity round (owner
// feedback 2026-08-21): kits grouped by type + click stays on the tab,
// add-on/bench chips on the build column, add-a-wall off the drawing, and
// the pinned drain location.
//
//   npx vite --port 5199
//   node .scratch/100_schluter-wedi-parity/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { mkdirSync } from "node:fs";

const OUT = ".scratch/100_schluter-wedi-parity";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5199/schluter-preview.html";

let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
pg.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200)); });

const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const tab = async (label) => { await pg.locator(".modetab", { hasText: label }).click(); await wait(400); };

await pg.goto(URL);
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await wait(600);

// p1 — Kits tab grouped by type; a click builds the kit AND STAYS HERE:
// the clicked row highlights, the build column fills, add-on chips render.
await pg.locator('[data-schluter-tray="KST965/1525"]').click();
await wait(600);
const stillKits = await pg.$eval(".modetab.on", (e) => e.textContent);
if (!/Kits/.test(stillKits)) throw new Error("kit click left the Kits tab: " + stillKits);
await pg.waitForSelector(".kitrow.on", { timeout: 5000 });
await pg.waitForSelector(".bgroup .addchips .addchip", { timeout: 5000 });
await shot("p1-kits-grouped-stay");

// p2 — add-ons off the build column, straight from the Kits tab: a niche +
// the 2" build-up bench chips toggled on, both landing as build lines.
await pg.locator(".bgroup .addchips .addchip", { hasText: "Niche" }).first().click();
await wait(400);
await pg.locator(".bgroup .addchips .addchip", { hasText: "build-up bench" }).click();
await wait(600);
const extras = await pg.$$eval(".bline .bn .n", (es) => es.map((e) => e.textContent));
if (!extras.some((t) => /niche/i.test(t))) throw new Error("niche line missing");
if (!extras.some((t) => /2"/.test(t))) throw new Error("bench build-up line missing");
await shot("p2-buildcol-addons-bench");

// reset to a clean kit, then the custom-tab stories
await pg.locator('[data-schluter-tray="KST965/1525"]').click();
await wait(500);

// p3 — the pinned drain: 50×38 room on the 60×38 tray, waste line 20" from
// the left → the cut splits (10" off the left), the drawing lands the drain
// at 20, the cut list says which sides the saw takes.
await tab("Custom shower");
await pg.locator("[data-schluter-w]").fill("50");
await wait(500);
await pg.locator("[data-schluter-dx]").fill("20");
await wait(700);
const drainTxt = await pg.$$eval(".optcard .sub", (es) => es.map((e) => e.textContent).join(" | "));
if (!/on the pin/.test(drainTxt)) throw new Error("pin text missing on option cards: " + drainTxt);
await shot("p3-drain-pin");

// p4 — add a wall by clicking the drawing: placing mode on, click the entry
// edge's left half → an entry wall lands in the Walls group and the curb
// pulls back to the opening.
await pg.locator(".addchip", { hasText: "Add wall" }).click();
await wait(300);
await pg.waitForSelector(".dc-hint", { timeout: 3000 });
const svg = pg.locator(".diagcol svg").first();
const box = await svg.boundingBox();
// the plan is drawn centred; the entry edge is the room's bottom line —
// click just inside it, left of centre, to return from the left end
await pg.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.78);
await wait(700);
const xrow = await pg.$$eval(".wallrow .wname.x", (es) => es.map((e) => e.textContent));
if (!xrow.length) throw new Error("no added wall row after the edge click");
await shot("p4-add-wall-click");

// p5 — the entry wall shortens the curb in the bill too (the 3' opening on a
// 24" entry wall) — zoom the build column's curb group into the frame.
const curbNote = await pg.$$eval(".bline .bn .m", (es) => es.map((e) => e.textContent).join(" | "));
console.log("curb note:", curbNote.match(/[^|]*entry[^|]*/)?.[0] || "(none)");

console.log("added wall rows:", xrow);
await b.close();
if (hadPageError) { console.error("FAILED: page errors"); process.exit(1); }
console.log("done");

// Proof: the four-way Compare grid (ticket 158 Phase 3) — wedi and Schluter on
// Board and Membrane, the host's live cell outlined, three house kits beside
// it; a cell click drives the detail; a chip jumps to its line; the S-DRY
// no-fit answer moves only the wedi Membrane cell; a mirror drop is per cell;
// checked cells land as options A–D in reading order.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p3/shoot-grid.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const { wediBuildFor } = await import(process.cwd() + "/src/comparekit.js");
const OUT = ".scratch/158_shower-config-roadmap/p3";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1500, height: 1250 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const sent = []; pg.on("console", async (m) => { if (m.text().startsWith("onQuoteOptions")) sent.push(await m.args()[1].jsonValue()); });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const toCompare = async () => { await pg.locator(".modetab", { hasText: "Compare" }).dispatchEvent("click"); await pg.waitForSelector("[data-cmp-quad] [data-cmp-total]", { timeout: 20000 }); await pg.waitForTimeout(800); };
const toTab = async (t) => { await pg.locator(".modetab", { hasText: t }).dispatchEvent("click"); await pg.waitForTimeout(500); };
const tile = (k) => pg.locator(`[data-cmp-tile="${k}"]`);
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
const heads = async () => pg.locator(".cmp-grid [data-cmp-sys]").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
const KEYS = ["wedi:board", "schluter:board", "wedi:membrane", "schluter:membrane"];

// --- 1. Schluter host, 38x60 KERDI membrane: four live totals ---
await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
await toCompare();
for (const k of KEYS) if (!/\$[\d,]+\.\d\d/.test(await txt(tile(k)))) fail(k + " has no total");
if (!/Current/.test(await txt(tile("schluter:membrane")))) fail("the live cell does not read Current");
if (!(await tile("schluter:membrane").getAttribute("class")).includes("live")) fail("the live cell is not outlined");
if (!/vs current/.test(await txt(tile("wedi:board")))) fail("a house-kit cell has no difference from current");
if (!(await tile("wedi:membrane").getAttribute("class")).includes("sel")) fail("the detail does not open on today's pair");
let h = await heads(); console.log("default detail:", h);
if (!/S-DRY membrane/.test(h[0]) || !/KERDI membrane/.test(h[1])) fail("the default detail is not wedi S-DRY vs KERDI membrane");
const checkedKeys = async () => pg.locator("[data-cmp-check]").evaluateAll((els) => els.filter((e) => e.checked).map((e) => e.getAttribute("data-cmp-check")));
if ((await checkedKeys()).sort().join() !== "schluter:membrane,wedi:membrane") fail("the default checks are not the live cell and today's opposite");
if (!/Add 2 as quote options/.test(await txt(pg.locator("[data-cmp-send]")))) fail("the send button does not count two");
await shot("g1-schluter-host-grid");

// --- 2. a cell click drives the detail; the live cell doesn't move it ---
await tile("wedi:board").click(); await pg.waitForTimeout(600);
h = await heads(); console.log("after wedi Board click:", h);
if (!/Building Panel/.test(h[0]) || !/KERDI membrane/.test(h[1])) fail("the detail did not follow the wedi Board click");
await tile("schluter:board").click(); await pg.waitForTimeout(600);
h = await heads(); console.log("after KERDI-BOARD click:", h);
if (!/KERDI-BOARD/.test(h[0]) || !/KERDI membrane.*this build/.test(h[1])) fail("same-brand detail is not KERDI-BOARD vs the live KERDI membrane");
await tile("schluter:membrane").click(); await pg.waitForTimeout(400);
if (!(await tile("schluter:board").getAttribute("class")).includes("sel")) fail("clicking the live cell moved the selection");
await shot("g2-same-brand-detail");
// Space on a focused checkbox toggles it — the tile's key handler leaves it be.
const cb = pg.locator('[data-cmp-check="schluter:board"]');
await cb.focus(); await pg.keyboard.press("Space"); await pg.waitForTimeout(200);
if (!(await cb.isChecked())) fail("Space on a tile's checkbox did not toggle it");
await pg.keyboard.press("Space"); await pg.waitForTimeout(200);
if (await cb.isChecked()) fail("a second Space did not untoggle the checkbox");

// --- 3. three checked → options A–C in reading order ---
await pg.locator('[data-cmp-check="wedi:board"]').check(); await pg.waitForTimeout(300);
if (!/Add 3 as quote options/.test(await txt(pg.locator("[data-cmp-send]")))) fail("the send button does not count three");
await pg.locator("[data-cmp-send]").click(); await pg.waitForTimeout(500);
const rows = await pg.locator("[data-cmp-option]").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
console.log("modal:", rows);
if (rows.length !== 3 || !/^A wedi · Building Panel/.test(rows[0]) || !/^B wedi · S-DRY membrane/.test(rows[1]) || !/^C Schluter · KERDI membrane/.test(rows[2])) fail("the modal does not letter A–C in reading order");
await shot("g3-three-options-modal");
await pg.locator("[data-compare-confirm]").click(); await pg.waitForTimeout(500);
const p = sent.at(-1);
if (!p || p.options.map((o) => o.name).join(" | ") !== "wedi · Building Panel | wedi · S-DRY membrane | Schluter · KERDI membrane"
  || !p.options.every((o) => o.lines.length > 0)) fail("onQuoteOptions did not carry the three options in order");

// --- 4. a linear room: the S-DRY no-fit chip, its jump, and the answer ---
await toTab("Kits");
const lin = pg.locator("[data-schluter-tray^='KSLT']");
if (await lin.count()) {
  await lin.first().click(); await pg.waitForTimeout(800);
  await toCompare();
  const chip = tile("wedi:membrane").locator('[data-cmp-flag="sdry"]');
  if (!(await chip.count())) fail("the no-fit wedi Membrane cell has no S-DRY chip");
  await tile("schluter:board").click(); await pg.waitForTimeout(400);
  await chip.click(); await pg.waitForTimeout(400);
  if (!(await tile("wedi:membrane").getAttribute("class")).includes("sel")) fail("the chip did not select its cell");
  if (!(await pg.locator('[data-cmp-cell="wedi:membrane"] .ln.hl').count())) fail("the chip did not light its line");
  if (!(await pg.locator("[data-cmp-sdryask]").count())) fail("no S-DRY answer under a no-fit cell");
  await shot("g4-sdry-chip-jump");
  const before = await txt(tile("wedi:membrane"));
  const boardBefore = await txt(tile("wedi:board"));
  await pg.locator('[data-cmp-sdry-answer="nearest"]').click(); await pg.waitForTimeout(700);
  const after = await txt(tile("wedi:membrane"));
  console.log("wedi Membrane:", before, "→", after);
  if (!/on a wedi pan/.test(before) || /on a wedi pan/.test(after)) fail("'nearest' did not move the cell onto an S-DRY base");
  if (!/No S-DRY base fits/.test(after)) fail("the nearest base lost its no-fit chip");
  if (await txt(tile("wedi:board")) !== boardBefore) fail("the S-DRY answer moved another cell");
  await shot("g5-sdry-nearest");

  // The grid state rides the popup's Compare session: it outlives a tab switch.
  const ck = (await checkedKeys()).sort().join();
  if (ck !== "schluter:membrane,wedi:board,wedi:membrane") fail("the three checks did not carry into the linear room: " + ck);
  await toTab("Browse");
  if (await pg.locator("[data-cmp-quad]").count()) fail("the Browse tab still draws the grid");
  await toCompare();
  const ck2 = (await checkedKeys()).sort().join();
  console.log("after tab round trip — checks:", ck2);
  if (ck2 !== ck) fail("the checks did not survive a tab switch");
  if (!(await tile("wedi:membrane").getAttribute("class")).includes("sel")) fail("the selection did not survive a tab switch");
  if (!(await pg.locator('[data-cmp-sdry-answer="nearest"]').getAttribute("class")).includes("on")) fail("the S-DRY answer did not survive a tab switch");
  if (/on a wedi pan/.test(await txt(tile("wedi:membrane")))) fail("the wedi Membrane cell fell back to the pan after a tab switch");
} else fail("no linear tray in the preview book");

// --- 5. wedi host with a hand-added niche: the mirror is per cell ---
const seedB = wediBuildFor({ w: 60, d: 38, curbed: true, drain: "point",
  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? 60 : 38, h: 84 })) },
{ manual: [{ key: "US3000005", qty: 1, group: "addon" }] });
await pg.goto("http://localhost:5199/wedi-preview.html?seed=" + encodeURIComponent(JSON.stringify({ mode: "custom", cfg: seedB.cfg })));
await pg.waitForSelector(".modetab", { timeout: 20000 }); await pg.waitForTimeout(800);
await toCompare();
if (!(await tile("wedi:board").getAttribute("class")).includes("live")) fail("the wedi host's live cell is not wedi Board");
const sb = await txt(tile("schluter:board"));
await tile("schluter:membrane").click(); await pg.waitForTimeout(500);
const drop = pg.locator('[data-cmp-cell="schluter:membrane"] [data-mirror-drop]');
if (!(await drop.count())) fail("the Schluter Membrane cell has no mirrored niche to drop");
else {
  await drop.first().click(); await pg.waitForTimeout(700);
  if (!(await tile("schluter:membrane").locator('[data-cmp-flag="unmatched"]').count())) fail("the drop did not flag its cell");
  if (await tile("schluter:board").locator('[data-cmp-flag="unmatched"]').count()) fail("the drop leaked into the Board cell");
  if (await txt(tile("schluter:board")) !== sb) fail("the drop moved the Board cell's total");
  if (!(await tile("wedi:membrane").locator('[data-cmp-flag]').count() === 0)) fail("the same-brand cell grew a chip");
  if (!/added/.test(await txt(pg.locator("body")))) fail("no added tag anywhere");
}
await pg.locator(".cmp-tab").evaluate((e) => { e.scrollTop = 0; });
await shot("g6-wedi-host-per-cell-mirror");
await tile("wedi:membrane").click(); await pg.waitForTimeout(600);
const addedSame = await pg.locator('[data-cmp-cell="wedi:membrane"] [data-added-tag]').count();
if (addedSame < 1) fail("the same-brand Membrane cell does not carry the host's added niche");
await pg.locator('[data-cmp-cell="wedi:membrane"] [data-added-tag]').first().scrollIntoViewIfNeeded();
await shot("g7-same-brand-added-line");

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");

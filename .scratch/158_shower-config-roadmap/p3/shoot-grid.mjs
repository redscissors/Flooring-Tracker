// Proof: the four-way Compare grid (ticket 158 Phase 3) — wedi and Schluter on
// Board and Membrane, the host's live cell outlined, three house kits beside
// it; a cell click drives the detail; a chip jumps to its line; the S-DRY
// no-fit answer moves only the wedi Membrane cell; a mirror drop and a ⇄ pick
// are per cell; checked cells land as options A–D in reading order, with the
// money the modal showed.
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
// The tile's name is its keyboard target — a real button, not a role="button" wrapper.
if (await pg.locator('[data-cmp-tile][role="button"]').count()) fail("a tile still nests controls inside role=button");
await pg.locator('[data-cmp-pick="wedi:board"]').focus(); await pg.keyboard.press("Enter"); await pg.waitForTimeout(400);
if (!(await tile("wedi:board").getAttribute("class")).includes("sel")) fail("Enter on a tile's name did not select it");
await pg.locator('[data-cmp-pick="schluter:board"]').focus(); await pg.keyboard.press("Enter"); await pg.waitForTimeout(400);

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
// The money that lands is the money the modal showed, and every option keeps its reconfigure anchor.
const cents = (t) => Math.round(Number(t.replace(/[$,]/g, "")) * 100);
if (p) p.options.forEach((o, i) => {
  const shown = cents(rows[i].match(/\$[\d,]+\.\d\d(?!.*\$)/)[0]);
  const landed = Math.round(o.lines.reduce((s, l) => s + Number(l.priceSqft) * Number(l.qty), 0) * 100);
  if (shown !== landed) fail(`${o.name}: the modal showed ${shown / 100}, the lines land ${landed / 100}`);
  if (!o.lines.some((l) => (l.wedi || l.schluter) && (l.wedi || l.schluter).cfg)) fail(o.name + " has no anchor line with its configurator marker");
});

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

  // Flip the live cell off-tab (KERDI membrane → KERDI-BOARD): the stored grid
  // was made for the old host, so the checks and selection reset to the new
  // live cell and its opposite.
  await toTab("Kits");
  await pg.locator("[data-schluter-kits-board]").click(); await pg.waitForTimeout(600);
  await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
  await toCompare();
  const ck3 = (await checkedKeys()).sort().join();
  console.log("after the host flipped to KERDI-BOARD — checks:", ck3);
  if (!(await tile("schluter:board").getAttribute("class")).includes("live")) fail("KERDI-BOARD is not the live cell after the flip");
  if (!(await pg.locator('[data-cmp-check="schluter:board"]').isChecked())) fail("the new live cell is not checked");
  if (ck3 !== "schluter:board,wedi:board") fail("the checks are not the new host's defaults: " + ck3);
  if (!(await tile("wedi:board").getAttribute("class")).includes("sel")) fail("the selection is not the new host's opposite");
  // The first write after the flip starts from those defaults, not the stale grid.
  await pg.locator('[data-cmp-check="schluter:membrane"]').check(); await pg.waitForTimeout(300);
  const ck4 = (await checkedKeys()).sort().join();
  if (ck4 !== "schluter:board,schluter:membrane,wedi:board") fail("a check after the flip merged over the stale grid: " + ck4);
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
}
await pg.locator(".cmp-tab").evaluate((e) => { e.scrollTop = 0; });
await shot("g6-wedi-host-per-cell-mirror");
await tile("wedi:membrane").click(); await pg.waitForTimeout(600);
const addedSame = await pg.locator('[data-cmp-cell="wedi:membrane"] [data-added-tag]').count();
if (addedSame < 1) fail("the same-brand Membrane cell does not carry the host's added niche");
await pg.locator('[data-cmp-cell="wedi:membrane"] [data-added-tag]').first().scrollIntoViewIfNeeded();
await shot("g7-same-brand-added-line");

// A ⇄ pick lands in its own cell only: the Membrane cell keeps its mirror as it was.
await tile("schluter:board").click(); await pg.waitForTimeout(500);
const swap = pg.locator('[data-cmp-cell="schluter:board"] [data-mirror-swap]');
if (!(await swap.count())) fail("the Schluter Board cell has no mirrored line to swap");
else {
  const line = pg.locator('[data-cmp-cell="schluter:board"] [data-mirror-line]').first();
  const lineBefore = await txt(line);
  const memBefore = await txt(tile("schluter:membrane"));
  await swap.first().click(); await pg.waitForTimeout(400);
  const other = pg.locator(".cmp-pick [data-mirror-row]:not(.on)");
  if (!(await other.count())) fail("the ⇄ list offers no other part");
  else {
    await other.first().click(); await pg.waitForTimeout(200);
    await pg.locator(".cmp-pick [data-drain-use]").click(); await pg.waitForTimeout(700);
    const lineAfter = await txt(line);
    console.log("Schluter Board mirrored line:", lineBefore, "→", lineAfter);
    if (lineAfter === lineBefore) fail("the ⇄ pick did not change its cell's line");
    if (await txt(tile("schluter:membrane")) !== memBefore) fail("the ⇄ pick leaked into the Membrane cell");
  }
}

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");

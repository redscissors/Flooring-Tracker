// Proof: ⇄ on every Schluter line (ticket 158 Phase 1b) — the membrane and
// band stepped popovers with a draft and Δ, stocked-first chips under Stock
// only, the fastener list swap, a bench wrap swap (and its pick cleared by a
// build change), and a one-part line (the 2″ build-up board) with no ⇄.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1b";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const flat = (t) => t.replace(/\n+/g, " | ");
const popText = async () => flat(await pg.locator("[data-drain-swap]").innerText());
const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name) }) });
const grpText = async (name) => flat(await grp(name).innerText());
const openIn = async (name, nth = 0) => { await grp(name).locator("[data-schluter-swapb]").nth(nth).click(); await pg.waitForTimeout(300); };

await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
const widthOrder = () => pg.locator('[data-drain-chip^="Width:"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-drain-chip").slice(6)));

// Stock only: the band's Width row lists its stocked chips first — the
// stocked 10" ahead of the special-order 7¼" it follows by width; Esc discards
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
const seamsStock = await grpText("Seams");
await openIn("Seams");
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
const stockWidths = await widthOrder();
console.log("stock-only band widths:", stockWidths.join(", "), "|", await popText());
if (stockWidths.join() !== "125,250,185") fail("Stock only does not list the stocked widths first");
if (!(await pg.locator('[data-drain-chip="Width:185"] [data-so-dot]').count())) fail("the special-order band width has no SO dot");
await shot("s7-stock-first-band");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
if (await pg.locator("[data-drain-swap]").count()) fail("Esc did not close the band popover");
if ((await grpText("Seams")) !== seamsStock) fail("Esc moved the band line");

await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600); // Full catalog
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);

// membrane: Width → Roll, a draft with its Δ; the bill holds until Use this
const wallsBefore = await grpText("Walls");
await openIn("Walls");
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
console.log("membrane:", await popText());
await shot("s1-membrane-popover");
await pg.locator('[data-drain-chip="Width:wide"]').click(); await pg.waitForTimeout(300);
const wideText = await popText();
console.log("wide draft:", wideText);
if (!/wide 15 m roll/.test(wideText) || /±0/.test(wideText)) fail("wide draft lacks its roll or Δ");
if ((await grpText("Walls")) !== wallsBefore) fail("the bill moved under a membrane draft");
await shot("s2-membrane-wide-draft");
await pg.locator('[data-drain-chip="Width:standard"]').click();
await pg.locator('[data-drain-chip="Roll:5M"]').click(); await pg.waitForTimeout(300);
console.log("5 m draft:", await popText());
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
const wallsAfter = await grpText("Walls");
console.log("walls after Use this:", wallsAfter);
if (!/KERDI200\/5M/.test(wallsAfter)) fail("Use this did not land the 5 m roll");

// band: the 7-1/4" width is special order — its chip carries the SO dot
await openIn("Seams");
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
const fullWidths = await widthOrder();
console.log("full-catalog band widths:", fullWidths.join(", "));
if (fullWidths.join() !== "125,185,250") fail("Full catalog reorders the width chips");
if (!(await pg.locator('[data-drain-chip="Width:185"] [data-so-dot]').count())) fail("the special-order band width has no SO dot");
await pg.locator('[data-drain-chip="Width:185"]').click(); await pg.waitForTimeout(300);
const bandText = await popText();
console.log("band 7¼ draft:", bandText);
if (!/7¼″ band/.test(bandText)) fail("band draft does not name the 7¼″ width");
await shot("s3-band-185-draft");
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
const seams = await grpText("Seams");
console.log("seams after Use this:", seams);
if (!/KEBA100\/185/.test(seams)) fail("Use this did not land the 7¼″ band");

// fasteners: a list swap on KERDI-BOARD walls (one click, applies at once)
await pg.locator("[data-schluter-kits-board]").click(); await pg.waitForTimeout(400);
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(600);
if (await pg.locator("[data-kit-confirm]").count()) { await pg.locator("[data-kit-overwrite]").click(); await pg.waitForTimeout(600); }
const fast = grp("Walls").locator(".bline", { hasText: /screws/i });
await fast.locator("[data-schluter-swapb]").click(); await pg.waitForTimeout(300);
await shot("s4-fastener-list");
await pg.locator(".sch-swappanel [data-schluter-swaprow]", { hasText: "40 ct" }).click(); await pg.waitForTimeout(500);
const fastText = flat(await fast.innerText());
console.log("fastener after pick:", fastText);
if (!/KBZS35GT32Z ·/.test(fastText)) fail("the 40-ct box did not land");

// benches: the framed wrap swaps (two ½″ boards); the 2″ build-up has one part — no ⇄
await pg.locator("[data-schluter-benchchip]").click(); await pg.waitForTimeout(300);
await pg.locator("[data-schluter-benchpick-framed]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-schluter-benchchip]").click(); await pg.waitForTimeout(300);
await pg.locator("[data-schluter-benchpick-site]").click(); await pg.waitForTimeout(600);
const wrap = grp("Bench").locator(".bline", { hasText: /1\/2/ }).first();
const buildup = grp("Bench").locator(".bline", { hasText: /2"|2″/ }).last();
console.log("extras:", await grpText("Bench"));
if (!(await wrap.locator("[data-schluter-swapb]").count())) fail("the framed wrap board has no ⇄");
if (await buildup.locator("[data-schluter-swapb]").count()) fail("the one-part 2″ build-up board shows a ⇄");
await grp("Bench").evaluate((el) => el.scrollIntoView({ block: "center" }));
await shot("s5-bench-lines");

// the wrap swap opens its own bench list (not the Walls board line that
// shares the sku) and the pick rides that bench's row
const wrapSku = await wrap.locator("[data-schluter-swapb]").getAttribute("data-schluter-swapb");
await wrap.locator("[data-schluter-swapb]").click(); await pg.waitForTimeout(300);
const rows = pg.locator(".sch-swappanel [data-schluter-swaprow]");
const rowSkus = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-schluter-swaprow")));
console.log("wrap list:", rowSkus.join(", "));
if (rowSkus.length < 2 || rowSkus.some((k) => /KB506/.test(k))) fail("the wrap list is not the ½″ board pool");
await shot("s6-bench-wrap-list");
const other = rowSkus.find((k) => k !== wrapSku);
await pg.locator(`.sch-swappanel [data-schluter-swaprow="${other}"]`).click();
await pg.waitForTimeout(500);
const wrapAfter = await grp("Bench").locator(".bline").first().innerText();
console.log("wrap after pick:", flat(wrapAfter));
if (!wrapAfter.includes(other)) fail("the wrap pick did not land on the bench line");
if (!(await grpText("Walls")).includes(wrapSku)) fail("the wrap pick moved the Walls board");

// a build change clears the bench's board pick (framed → 2″ build-up → framed)
const tag = pg.locator("svg text", { hasText: /framed · ½/ }).first();
const bb = await tag.boundingBox();
await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.waitForTimeout(400);
const menu = pg.locator("[data-schluter-benchmenu]");
await menu.locator("button", { hasText: "2″ build-up" }).click(); await pg.waitForTimeout(400);
await menu.locator("button", { hasText: /^Framed$/ }).click(); await pg.waitForTimeout(500);
const wrapReset = await grp("Bench").locator(".bline").first().innerText();
console.log("wrap after build change:", flat(wrapReset));
if (!wrapReset.includes(wrapSku) || wrapReset.includes(other)) fail("the board pick survived a build change");

await b.close();
if (err) process.exit(1);

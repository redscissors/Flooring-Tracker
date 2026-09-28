// Proof: Compare lines both brands up by shared group and slot (ticket 158
// Phase 1d), and mirrors the host's hand-added lines onto the other brand —
// the nearest part tagged "added · matched", a "+" where nothing compares, a
// picker on the brand's own "+" parts, × to drop, and quote option B carrying
// the mirrored lines. Schluter host first, then wedi host.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1d";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name, full = true) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log("shot", name); };
const flat = (t) => t.replace(/\n+/g, " | ");
const plus = async (g) => { await pg.locator(`[data-add-group="${g}"]`).click(); await pg.waitForSelector("[data-add-pop]", { timeout: 5000 }); await pg.waitForTimeout(200); };
const toCompare = async () => { await pg.locator(".modetab", { hasText: "Compare" }).dispatchEvent("click"); await pg.waitForSelector(".cmp-grid [data-cmp-group]", { timeout: 20000 }); await pg.waitForTimeout(800); };
const slotRow = (slot) => pg.locator(`.cmp-grid [data-cmp-slot="${slot}"]`);
const bands = async () => pg.locator(".cmp-grid [data-cmp-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cmp-group")));
const ORDER = ["base", "drain", "curb", "walls", "seams", "niches", "bench", "setting", "extras"];
const inOrder = (xs) => xs.every((x, i) => i === 0 || ORDER.indexOf(xs[i - 1]) < ORDER.indexOf(x));

// --- Schluter host: an added niche and an added grate ---
await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
await plus("Niches"); await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400);
await plus("Drain"); await pg.locator('[data-drain-chip="Part:grate"]').click(); await pg.waitForTimeout(300);
await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400);
await toCompare();
const b1 = await bands();
console.log("bands:", b1.join(" · "));
if (!inOrder(b1)) fail("group bands are out of order");
const slots = await pg.locator(".cmp-grid [data-cmp-slot]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cmp-slot")));
if (!["tray", "grate", "flange", "curb", "wallBoard", "wallMembrane", "seam", "corners", "niche", "setting"].every((s) => slots.includes(s))) fail("a slot row is missing: " + slots.join(","));
const matched = pg.locator("[data-mirror-line]");
if ((await matched.count()) !== 1) fail("the added niche did not mirror onto wedi");
const mText = flat(await matched.first().innerText());
console.log("mirrored:", mText);
if (!/added · matched/.test(mText) || !/for .*niche 12"×20"/.test(mText)) fail("the mirrored niche lacks its tag or its 'for'");
const plusRow = pg.locator("[data-mirror-plus]");
if ((await plusRow.count()) !== 1 || !/Nothing comparable in the wedi book/.test(await plusRow.innerText())) fail("the added grate did not get a '+'");
if ((await pg.locator("[data-cmp-slot]", { hasText: "Flange" }).count()) !== 1) fail("the flange row is gone");
await shot("c1-schluter-host");

// the "+": the wedi Drain parts, a Part row, a list, qty, Use this
await pg.locator("[data-mirror-add]").click(); await pg.waitForSelector("[data-add-pop]"); await pg.waitForTimeout(300);
const pick = flat(await pg.locator("[data-add-pop]").innerText());
console.log("picker:", pick.slice(0, 160));
// Phase 3: the picker names its grid cell — two wedi cells can each mirror
if (!/Add to wedi · [^·]+ · Drain/.test(pick) || !/PART \| Cover/.test(pick)) fail("the picker isn't the wedi Drain parts");
await shot("c2-picker", false);
await pg.locator("[data-mirror-row]").nth(1).click(); await pg.waitForTimeout(200);
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(700);
if ((await pg.locator("[data-mirror-line]").count()) !== 2) fail("the pick did not land as a mirrored line");
const totBefore = flat(await pg.locator(".cmp-tot").innerText());

// × drops the niche's mirror: the "+" comes back and wedi's total falls
await pg.locator("[data-mirror-line]", { hasText: /Niche/ }).locator("[data-mirror-drop]").click(); await pg.waitForTimeout(700);
if (!/Not mirrored/.test(await pg.locator("[data-mirror-plus]").innerText())) fail("× did not put the '+' back");
const totAfter = flat(await pg.locator(".cmp-tot").innerText());
console.log("totals:", totBefore, "→", totAfter);
if (totAfter === totBefore) fail("dropping a mirrored line did not move the wedi total");
await shot("c3-dropped");

// a tab switch keeps the drop (popup session state)
await pg.locator(".modetab", { hasText: "Kits" }).dispatchEvent("click"); await pg.waitForTimeout(400);
await toCompare();
if (!/Not mirrored/.test(await pg.locator("[data-mirror-plus]").innerText())) fail("the drop did not survive a tab switch");

// --- wedi host: an added niche and an added panel ---
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
await pg.locator('[data-wedi-chip="niche"]').click(); await pg.waitForTimeout(300);
await pg.locator(".wedi-chipmenu .srow").nth(1).click(); await pg.waitForTimeout(300);
await plus("Walls"); await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
await toCompare();
const lines = await pg.locator("[data-mirror-line]").allInnerTexts();
console.log("wedi host mirrored:", lines.map(flat).join(" || "));
if (lines.length !== 2) fail("wedi host: expected the niche and the panel to mirror");
if (!lines.some((t) => /KERDI-BOARD .*panel/i.test(t) && /Building Panel/.test(t))) fail("the panel did not mirror to KERDI-BOARD");
if (!lines.some((t) => /KERDI-BOARD-SN niche/i.test(t))) fail("the niche did not mirror to a KERDI-BOARD-SN niche");
await shot("c4-wedi-host");

// quote options: option B carries the mirrored lines
await pg.locator(".qfoot .cbtn.primary").click(); await pg.waitForTimeout(400);
const modal = flat(await pg.locator(".cmodal").innerText());
console.log("modal:", modal.slice(0, 120));
const sTot = (await pg.locator(".cmp-tot > div").nth(2).locator(".tv").innerText()).match(/\$[\d,]+\.\d\d/)[0];
console.log("Schluter column total:", sTot);
// Phase 3: an option row names its system, and any chips ride before the total
if (!new RegExp("B \\| Schluter · [^|]+ — \\d+ lines \\| (?:[^|$]+ \\| )*\\" + sTot).test(modal)) fail("option B's total isn't the column's total");
await shot("c5-quote-options", false);

// --- Stock only (the popups' default): the mirror pools like the popups — a
// part with nothing stocked still offers all of it, so no group wedi has parts
// for reads "No wedi … in the book". wedi's fixture book has no Extras parts,
// so Extras is the one group that row may name.
await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
if ((await pg.locator("[data-source-toggle]").getAttribute("aria-pressed")) !== "true") fail("the Schluter popup didn't open on Stock only");
const tray = pg.locator("[data-schluter-tray='KST965/1525']");
await ((await tray.count()) ? tray.first() : pg.locator("[data-schluter-tray]").first()).click(); await pg.waitForTimeout(800);
await plus("Niches"); await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400);
const hasExtras = (await pg.locator('[data-add-group="Extras"]').count()) > 0;
if (hasExtras) { await plus("Extras"); await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400); }
await toCompare();
const soLines = (await pg.locator("[data-mirror-line]").allInnerTexts()).map(flat);
const soPlus = (await pg.locator("[data-mirror-plus]").allInnerTexts()).map(flat);
console.log("stock only — mirrored:", soLines.join(" || "), "| '+' rows:", soPlus.join(" || "), "| Extras added:", hasExtras);
if (!soLines.some((t) => /for .*niche/i.test(t))) fail("Stock only: the added niche did not mirror onto wedi");
if (soPlus.some((t) => /No wedi (?!extras?\b)\S+ in the book/.test(t))) fail("Stock only: a group wedi has parts for reads 'No wedi … in the book'");
if (soLines.length + soPlus.length !== (hasExtras ? 2 : 1)) fail("Stock only: a host added line has no mirror row");
await shot("c6-stock-only");

// the picker's rows read size · part number · stock (spec §4)
await pg.locator("[data-mirror-line]").first().locator("[data-mirror-swap]").click(); await pg.waitForSelector("[data-add-pop]"); await pg.waitForTimeout(300);
const rowSmall = await pg.locator("[data-mirror-row] small").allInnerTexts();
console.log("picker rows:", rowSmall.slice(0, 4).join(" || "));
if (!rowSmall.some((t) => /^interior .+ · US\d+ · (stock|special order)$/.test(t))) fail("the picker rows don't show the size");
await shot("c7-picker-sizes", false);

await b.close();
if (err) { console.error("— checks FAILED"); process.exit(1); }
console.log("— all checks passed");

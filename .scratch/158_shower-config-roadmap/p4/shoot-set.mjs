// Proof: the Compare set (ticket 158 Phase 4, ADR 0052) — four fixed columns
// in the same order from either popup, the Current ring, a kept build (Your
// build) with its room chip, Sync keeping the pick, Open across brands and
// back with the build you left kept, Subtotals, the resume prompt, quote
// options lettered in column order, Clear set.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p4/shoot-set.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p4";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1500, height: 1100 } });
let err = false;
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
pg.on("dialog", (d) => d.accept());
const sent = []; pg.on("console", async (m) => { if (m.text().startsWith("onQuoteOptions")) sent.push(await m.args()[1].jsonValue()); });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const ORDER = ["wedi:board", "wedi:membrane", "schluter:board", "schluter:membrane"];
const col = (k) => pg.locator(`[data-cmp-col="${k}"]`);
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
const toCompare = async () => {
  await pg.locator(".modetab", { hasText: "Compare" }).dispatchEvent("click");
  await pg.waitForSelector("[data-cmp-col] [data-cmp-total]", { timeout: 20000 }); await pg.waitForTimeout(1200);
};
const onCompare = async () => { await pg.waitForSelector("[data-cmp-col] [data-cmp-total]", { timeout: 20000 }); await pg.waitForTimeout(1200); };
const order = async () => pg.locator("[data-cmp-col]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cmp-col")));
const current = async () => pg.locator("[data-cmp-current]").getAttribute("data-cmp-col");
const status = async (k) => col(k).locator("[data-cmp-status]").getAttribute("data-cmp-status");
const total = async (k) => txt(col(k).locator("[data-cmp-total]"));
const cellHas = async (k, re) => re.test(await txt(pg.locator(`[data-cmp-cell="${k}"]`).first().locator("xpath=ancestor::div[contains(@class,'cmp-grid')]")))
  && (await pg.locator(`[data-cmp-cell="${k}"]`).evaluateAll((els, src) => els.some((e) => new RegExp(src).test(e.innerText)), re.source));

// --- 1. wedi host, a kept KERDI-BOARD build for a smaller room ---
await pg.goto("http://localhost:5199/compare-set-preview.html?host=wedi&kept=1");
await pg.waitForSelector(".modetab", { timeout: 20000 }); await pg.waitForTimeout(1500);
await toCompare();
if ((await order()).join() !== ORDER.join()) fail("columns out of order from the wedi host: " + (await order()));
if ((await current()) !== "wedi:board") fail("the ring is not on wedi Building Panel");
if (!/Current/i.test(await txt(pg.locator("[data-cmp-current] .curtab")))) fail("no CURRENT tab");
const st1 = await Promise.all(ORDER.map(status));
if (st1.join() !== "current,house,yours,house") fail("statuses: " + st1);
if (!/Built for 60×36 — room changed/.test(await txt(col("schluter:board")))) fail("no room-changed chip on the kept build");
if (!(await pg.locator('[data-cmp-sync="schluter:board"]').count())) fail("no Sync on the kept build");
if (await pg.locator('[data-cmp-sync="schluter:membrane"]').count()) fail("Sync on a house kit");
if (!(await cellHas("schluter:board", /KD4GRKECS/))) fail("the kept grate pick is not on the kept build");
if (!(await cellHas("schluter:board", /cut down/))) fail("the kept tray is not the 60×36 cut");
const wediTotal = await total("wedi:board");
await shot("c1-wedi-host-kept-build");

// --- 2. Subtotals ---
await pg.locator("[data-cmp-view-sum]").click(); await pg.waitForTimeout(500);
if ((await pg.locator("[data-cmp-sub]").count()) < 16) fail("Subtotals did not fold the groups");
await shot("c2-subtotals");
await pg.locator("[data-cmp-sub]").first().click(); await pg.waitForTimeout(400);
if (!(await pg.locator('[data-cmp-slot="tray"]').count())) fail("clicking a subtotal did not open its lines");
await pg.locator("[data-cmp-view-lines]").click(); await pg.waitForTimeout(400);

// --- 3. Sync: the room comes over, the grate pick stays ---
await pg.locator('[data-cmp-sync="schluter:board"]').click(); await pg.waitForTimeout(1200);
if (/room changed/.test(await txt(col("schluter:board")))) fail("the room chip survived Sync");
if (!(await cellHas("schluter:board", /KD4GRKECS/))) fail("Sync dropped the kept grate pick");
if (!(await cellHas("schluter:board", /exact fit/))) fail("Sync did not re-fit the tray to 60×38");
if ((await status("schluter:board")) !== "yours") fail("Sync lost Your build");
if (!/synced/.test(await txt(pg.locator("[data-cmp-msg]")))) fail("no Sync message");
await shot("c3-after-sync");

// --- 4. Open Schluter KERDI membrane: the wedi build is kept ---
await pg.locator('[data-cmp-open="schluter:membrane"]').click();
await onCompare();
if (!(await pg.locator("[data-schluter-pop]").count())) fail("Open did not hand off to the Schluter popup");
if ((await order()).join() !== ORDER.join()) fail("columns out of order from the Schluter host");
if ((await current()) !== "schluter:membrane") fail("the ring did not move to KERDI membrane");
if ((await status("wedi:board")) !== "yours") fail("the wedi build you left is not kept");
if ((await total("wedi:board")) !== wediTotal) fail(`the kept wedi build moved: ${await total("wedi:board")} vs ${wediTotal}`);
if (!/wedi:board/.test(await txt(pg.locator("[data-h-set]")))) fail("the set does not hold the wedi build");
await shot("c4-open-schluter-wedi-kept");

// --- 5. Open the kept wedi build: back in wedi, same money ---
await pg.locator('[data-cmp-open="wedi:board"]').click();
await onCompare();
if (!(await pg.locator("[data-wedi-pop]").count())) fail("Open did not hand back to the wedi popup");
if ((await current()) !== "wedi:board") fail("the ring is not back on wedi Building Panel");
if ((await total("wedi:board")) !== wediTotal) fail("the reopened wedi build is not the one kept");
if ((await status("schluter:membrane")) !== "yours") fail("the Schluter build you left is not kept");
await shot("c5-back-to-wedi");

// --- 6. a fresh wedi start offers the kept build ---
await pg.locator("[data-h-close]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-h-fresh-wedi]").click();
await pg.waitForSelector("[data-resume]", { timeout: 20000 }); await pg.waitForTimeout(600);
if (!/Pick up where you left off\?/.test(await txt(pg.locator("[data-resume]")))) fail("no resume title");
if (!(await pg.locator('[data-resume-pick="wedi:board"]').count())) fail("the kept wedi build is not offered");
if (!/Dana/.test(await txt(pg.locator('[data-resume-pick="wedi:board"]')))) fail("the resume row does not say who saved it");
await shot("c6-resume-prompt");
await pg.locator('[data-resume-pick="wedi:board"]').click(); await pg.waitForTimeout(1500);
if (await pg.locator("[data-resume]").count()) fail("the prompt stayed after a pick");
await toCompare();
if ((await total("wedi:board")) !== wediTotal) fail("resume did not reopen the kept build");

// --- 6b. a sized fresh start builds a default kit; picking the kept build must
// not write that default over it (final-review fix) ---
const keptRoom = async () => JSON.parse(await pg.locator("[data-h-set-json]").textContent())["wedi:board"].room;
await pg.locator("[data-h-close]").click(); await pg.waitForTimeout(800);
const before = await keptRoom();
await pg.locator("[data-h-fresh-wedi-sized]").click();
await pg.waitForSelector("[data-resume]", { timeout: 20000 }); await pg.waitForTimeout(1500);
if (!/room changed since/.test(await txt(pg.locator('[data-resume-pick="wedi:board"]')))) fail("the resume row does not note the size change");
await pg.locator('[data-resume-pick="wedi:board"]').click(); await pg.waitForTimeout(1500);
const after = await keptRoom();
if (after.w !== before.w || after.d !== before.d) fail(`the resume pick overwrote the kept build: ${after.w}×${after.d}`);
await toCompare();

// --- 7. three options land A–C in column order ---
const box = (k) => pg.locator(`[data-cmp-check="${k}"]`);
if (!(await box("wedi:membrane").isChecked())) await box("wedi:membrane").check();
await pg.waitForTimeout(300);
const checked = await pg.locator("[data-cmp-check]").evaluateAll((els) => els.filter((e) => e.checked).map((e) => e.getAttribute("data-cmp-check")));
console.log("checked:", checked);
await pg.locator("[data-cmp-send]").click(); await pg.waitForTimeout(500);
const letters = await pg.locator("[data-cmp-option]").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
console.log("options:", letters);
const expect = ORDER.filter((k) => checked.includes(k));
if (letters.length !== expect.length) fail("option count");
if (!/^A wedi · Building Panel/.test(letters[0]) || !/^B wedi · S-DRY/.test(letters[1])) fail("options are not lettered in column order");
await shot("c7-options-column-order");
await pg.locator("[data-compare-confirm]").click(); await pg.waitForTimeout(400);
if (!sent.length || sent[0].options.length !== letters.length) fail("the send did not carry the options");

// --- 8. Clear set ---
await pg.locator("[data-cmp-clear]").click(); await pg.waitForTimeout(800);
const st8 = await Promise.all(ORDER.map(status));
if (st8.join() !== "current,house,house,house") fail("Clear set left kept builds: " + st8);
if (await pg.locator("[data-cmp-clear]").count()) fail("Clear set still offered on an empty set");
await shot("c8-clear-set");

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");

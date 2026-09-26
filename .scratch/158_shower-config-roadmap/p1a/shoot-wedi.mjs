// Proof: the wedi cover ⇄ opens the stepped drain popover (ticket 158 Phase 1a, Task 8).
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1a/shoot-wedi.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1a";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error(m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const flat = (t) => t.replace(/\n+/g, " | ");
const popText = async () => flat(await pg.locator("[data-drain-swap]").innerText());
const coverLine = () => pg.locator(".bline", { hasText: /Drain Cover/i }).first();
const coverText = async () => flat(await coverLine().innerText());
const open = async () => { await coverLine().locator(".swapb").click(); await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 }); };

await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);

// a 60×36 linear pan: 43" channel, stainless cover by default
await pg.locator("[data-wedi-pan='US9310001']").click(); await pg.waitForTimeout(800);
const before = await coverText();
console.log("bill cover:", before);
await open();
console.log("popover:", await popText());
await shot("w1-linear-cover-popover");

await pg.locator('[data-drain-chip="Style:perforated"]').click(); await pg.waitForTimeout(300);
const draftText = await popText();
console.log("perforated draft:", draftText);
if (/±\$?0/.test(draftText)) fail("Δ still reads ±0 on a perforated draft");
if ((await coverText()) !== before) fail("the bill moved under a draft");
await shot("w2-perforated-draft");

// Esc discards a draft
await pg.locator('[data-drain-chip="Style:tileable"]').click();
await pg.keyboard.press("Escape"); await pg.waitForTimeout(400);
if (await pg.locator("[data-drain-swap]").count()) fail("Esc left the popover open");
if ((await coverText()) !== before) fail("Esc did not discard the draft");

await open();
await pg.locator('[data-drain-chip="Style:perforated"]').click();
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(700);
if (await pg.locator("[data-drain-swap]").count()) fail("popover still open after Use this");
const used = await coverText();
console.log("after Use this:", used);
if (!/43" Linear Drain Cover.*perforated/i.test(used)) fail("Use this did not land the perforated cover");
await shot("w3-used-perforated");

// the room changes: 48" wide re-solves to a 31" channel — the cover stays perforated
await pg.locator(".modetab", { hasText: "Custom shower" }).click(); await pg.waitForTimeout(500);
const wIn = pg.locator(".roomform .rinp").first();
await wIn.fill("48"); await wIn.press("Enter"); await pg.waitForTimeout(800);
const refit = await coverText();
console.log("after 48\" room:", refit);
if (!/31" Linear Drain Cover.*perforated/i.test(refit)) fail("the cover choice did not follow the new channel");
await shot("w4-room-48-still-perforated");

// finding 3 (final review): a 27" linear pan's two same-finish stainless
// twins (676797048 stock, US1000084 SO) must dedupe to one Finish chip
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500); // Full catalog
await pg.locator("[data-wedi-pan='US9310002']").click(); await pg.waitForTimeout(800);
await open();
const stainlessChips = pg.locator('[data-drain-chip^="Finish:"]', { hasText: "Stainless, brushed natural" });
const stainlessCount = await stainlessChips.count();
console.log("27\" pan stainless finish chips:", stainlessCount);
if (stainlessCount !== 1) fail(`27" pan shows ${stainlessCount} stainless chips, expected 1`);
await shot("w6-27-dedupe");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// a point-drain pan: Finish row only
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
console.log("point bill cover:", await coverText());
await open();
if (await pg.locator('[data-drain-chip^="Style:"]').count()) fail("point popover shows a Style row");
await pg.locator('[data-drain-chip^="Finish:"]').nth(1).click();
console.log("point popover:", await popText());
await shot("w5-point-cover-popover");
const pickedName = await pg.locator("[data-drain-swap] b").first().innerText();
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
const pointUsed = await coverText();
console.log("point after Use this:", pointUsed);
if (!pointUsed.startsWith(pickedName.replace(/ · special order$/, ""))) fail("point Use this did not land " + pickedName);

await b.close();
if (err) process.exit(1);

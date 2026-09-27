// Proof: both bills draw the nine shared groups (ticket 158 Phase 1d) — Base ·
// Drain · Curb · Walls · Seams · Niches · Bench · Setting · Extras — each with
// its "+"; wedi's fasteners sit with the panels under Walls; a niche lands
// under Niches and a bench under Bench on both brands; both print sheets list
// the lines in group order.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1d/shoot-bills.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1d";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
// The print sheet is portalled to <body> but styled display:none except
// under @media print (SchluterConfigurator.jsx / WediConfigurator.jsx PRINT_CSS)
// — emulate print media to actually render it, screenshot, then revert before
// any further interaction (everything else is display:none !important while
// print media is emulated). Stays inside the 2500ms afterprint fallback window.
const printShot = async (name) => {
  await pg.emulateMedia({ media: "print" });
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await pg.emulateMedia({ media: null });
  console.log("shot", name);
};
const inOrder = (idx) => { idx.forEach(([label, i]) => { if (i < 0) fail(`print: missing ${label} row`); }); for (let i = 1; i < idx.length; i++) if (idx[i][1] <= idx[i - 1][1]) fail(`print order: ${idx[i - 1][0]} not before ${idx[i][0]}`); };
const flat = (t) => t.replace(/\n+/g, " | ");
const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name, "i") }) });
const grpText = async (name) => flat(await grp(name).innerText());
const plus = async (g) => { await pg.locator(`[data-add-group="${g}"]`).click(); await pg.waitForSelector("[data-add-pop]", { timeout: 5000 }); await pg.waitForTimeout(200); };
const heads = async () => (await pg.locator(".buildcol .bg-h, .bc-scroll .bg-h").allInnerTexts()).map((t) => t.split("\n")[0].trim().toUpperCase());
const NINE = ["BASE", "DRAIN", "CURB", "WALLS", "SEAMS", "NICHES", "BENCH", "SETTING", "EXTRAS"];

// --- Schluter ---
await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600); // Full catalog
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
const sPlus = await pg.locator("[data-add-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-add-group")));
console.log("Schluter +:", sPlus.join(", "));
if (sPlus.join() !== "Base,Drain,Curb,Walls,Seams,Niches,Bench,Setting,Extras") fail("Schluter lacks a + on every shared group, in order");
await plus("Niches");
await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400);
if (!/KB12SN/.test(await grpText("Niches"))) fail("the niche did not land under Niches");
await plus("Bench");
await pg.locator("[data-add-row]", { hasText: /bench/i }).first().click(); await pg.waitForTimeout(400);
if ((await grp("Bench").locator("[data-added-tag]").count()) !== 1) fail("the bench did not land under Bench");
const sHeads = await heads();
console.log("Schluter groups:", sHeads.join(" · "));
if (sHeads.slice(0, 9).join() !== NINE.join()) fail("Schluter groups are not the nine in order");
await shot("s1-schluter-groups");
await pg.locator("[data-schluter-print]").click(); await pg.waitForTimeout(400);
const sPrint = await pg.locator(".ps-table tbody tr").allInnerTexts();
const sAt = (re) => sPrint.findIndex((t) => re.test(t));
console.log("Schluter print:", sPrint.map((t) => t.replace(/\s+/g, " ").slice(0, 36)).join(" · "));
inOrder([["Tray", sAt(/Tray/)], ["Drain", sAt(/flange kit|grate/i)], ["Curb", sAt(/curb/i)], ["Wall membrane", sAt(/membrane roll/)], ["Niche", sAt(/niche/i)], ["Bench", sAt(/bench/i)], ["Setting", sAt(/ALL-SET/)]]);
await printShot("s2-schluter-print");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// --- wedi ---
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800); // 36×60
await pg.locator('[data-wedi-chip="niche"]').click(); await pg.waitForTimeout(300);
await pg.locator(".wedi-chipmenu .srow").first().click(); await pg.waitForTimeout(300);
await pg.locator('[data-wedi-chip="seat"]').click(); await pg.waitForTimeout(300);
if (await pg.locator(".wedi-chipmenu .srow").count()) { await pg.locator(".wedi-chipmenu .srow").first().click(); await pg.waitForTimeout(300); }
const wHeads = await heads();
console.log("wedi groups:", wHeads.join(" · "));
if (!["BASE", "DRAIN", "CURB", "WALLS", "SEAMS", "NICHES", "BENCH", "SETTING"].every((h, i, a) => wHeads.indexOf(h) >= 0 && (i === 0 || wHeads.indexOf(a[i - 1]) < wHeads.indexOf(h)))) fail("wedi groups are not in the shared order");
if (wHeads.some((h) => /FLOOR|INSTALL|DRAIN & FINISH/.test(h))) fail("an old wedi bucket survived");
if (!/Fastener Kit/.test(await grpText("Walls"))) fail("wedi fasteners are not under Walls");
if (!/Niche/.test(await grpText("Niches"))) fail("the wedi niche is not under Niches");
if (!/Seat/.test(await grpText("Bench"))) fail("the wedi seat is not under Bench");
if (!/Valve Seal/.test(await grpText("Seams"))) fail("the valve seal is not under Seams");
if (!/Curb/.test(await grpText("Curb"))) fail("the curb is not under Curb");
await shot("w1-wedi-groups");
await pg.locator("[data-wedi-print], button:has-text('Print layout')").first().click(); await pg.waitForTimeout(400);
const wPrint = await pg.locator(".ps-table tbody tr").allInnerTexts();
const wAt = (re) => wPrint.findIndex((t) => re.test(t));
console.log("wedi print:", wPrint.map((t) => t.replace(/\s+/g, " ").slice(0, 36)).join(" · "));
inOrder([["Shower Base", wAt(/Shower Base/)], ["Drain Cover", wAt(/Drain Cover/)], ["Curb", wAt(/Curb/)], ["Fastener Kit", wAt(/Fastener Kit/)], ["Building Panel", wAt(/Building Panel/)], ["Niche", wAt(/Niche/)], ["PRO-SET", wAt(/PRO-SET/)]]);
await printShot("w2-wedi-print");

await b.close();
if (err) { console.error("— checks FAILED"); process.exit(1); }
console.log("— all checks passed");

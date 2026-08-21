// Preview-proof rig for the phase-5 Compare tab (issue 097, prototype P3).
// Shoots the five change-control shots c1..c5 off the two dev harnesses:
//
//   c1  Schluter popup · Compare · 60×38 curbed point drain · Retail
//   c2  the same at the Builder lens (both builder knobs on screen)
//   c3  wedi popup · Compare (host column = the live wedi build)
//   c4  Schluter popup · Compare under Stock only (the SO re-rank story)
//   c5  the quote-options confirm modal (wedi harness)
//
//   npx vite --port 5199        # in the repo, with a .env present
//   node .scratch/097_schluter-configurator/phase5-proof/shoot-compare.mjs
//
// Every shot waits on a settle guard (the compare grid mounted AND both
// totals resolved to a dollar figure, except where a dash is the point) so a
// half-rendered frame fails loudly instead of shipping as proof. Any
// pageerror fails the whole run.
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { mkdirSync } from "node:fs";

const OUT = ".scratch/097_schluter-configurator/phase5-proof";
mkdirSync(OUT, { recursive: true });
const S_URL = "http://localhost:5199/schluter-preview.html";
const W_URL = "http://localhost:5199/wedi-preview.html";

let hadPageError = false;
const quotePayloads = [];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
pg.on("console", (m) => {
  if (m.type() === "error") console.log("console.error:", m.text().slice(0, 160));
  if (m.text().startsWith("onQuoteOptions")) quotePayloads.push(m.text());
});

const wait = (ms) => pg.waitForTimeout(ms);
const tab = async (label) => { await pg.locator(".modetab", { hasText: label }).click(); await wait(400); };
const setNum = async (sel, v) => {
  const el = pg.locator(sel);
  await el.fill(String(v));
  await el.press("Enter");
  await wait(450);
};
// Settle guard: the compare grid is mounted, every category row has rendered,
// and both total cells carry a figure (or a dash where that IS the shot).
const settle = async (bothPriced = true) => {
  await pg.waitForSelector(".cmp-tab .cmp-grid .cat", { timeout: 15000 });
  await pg.waitForFunction((both) => {
    const tv = [...document.querySelectorAll(".cmp-tab .cmp-tot .tv")];
    if (tv.length !== 2) return false;
    return both ? tv.every((e) => e.textContent.startsWith("$")) : true;
  }, bothPriced, { timeout: 20000 });
  await wait(500);
};
const shot = async (name) => {
  await pg.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name);
};
const totals = () => pg.$$eval(".cmp-tab .cmp-tot .tv", (es) => es.map((e) => e.textContent.trim()));
const delta = () => pg.$eval(".cmp-tab .delta", (e) => e.textContent.replace(/\s+/g, " ").slice(0, 90)).catch(() => "(none)");

// ---------------------------------------------------------------- Schluter
const schluterRoom = async ({ w = 60, d = 38, drain = "Point · centre", source = "all" } = {}) => {
  await pg.goto(S_URL, { waitUntil: "load" });
  await pg.waitForSelector("[data-schluter-pop]", { timeout: 20000 });
  await wait(1400);
  await tab("Custom shower");
  await setNum("[data-schluter-w]", w);
  await setNum("[data-schluter-d]", d);
  await pg.locator(".rseg button", { hasText: "Curbed" }).first().click();
  await wait(300);
  await pg.locator(".rseg button", { hasText: drain }).first().click();
  await wait(300);
  if (source === "stock") { await pg.click("[data-source-stock]"); await wait(600); }
  await pg.locator(".optcard[data-schluter-opt]").first().click();
  await wait(600);
  await tab("Compare");
  await settle();
};

await schluterRoom();
console.log("c1 totals", await totals(), "|", await delta());
await shot("c1-schluter-host-retail");

await pg.locator(".cmp-tab .lensseg button", { hasText: "Builder" }).click();
await wait(500);
console.log("c2 totals", await totals(), "|", await delta());
await shot("c2-schluter-host-builder");

// c4's room is 48×48 linear, not c1's: it is the one in the fixture where the
// source switch actually re-ranks — Full catalog picks the special-order KSLT
// tray, Stock only takes the dearer stocked tray instead. The full-catalog
// frame is measured (not shot) so the README can quote both sides.
const soRows = () => pg.$$eval(".cmp-tab .cmp-grid .ln.so", (es) => es.map((e) => e.textContent.replace(/\s+/g, " ")));
await schluterRoom({ w: 48, d: 48, drain: "Linear at wall" });
console.log("c4 reference (Full catalog)", await totals(), "SO:", await soRows());
await schluterRoom({ w: 48, d: 48, drain: "Linear at wall", source: "stock" });
console.log("c4 totals", await totals(), "SO:", await soRows(), "|", await delta());
await shot("c4-schluter-stock-only");

// -------------------------------------------------------------------- wedi
await pg.goto(W_URL, { waitUntil: "load" });
await pg.waitForSelector("[data-wedi-pop]", { timeout: 20000 });
await wait(1400);
await tab("Custom shower");
const size = pg.locator(".rf", { hasText: /^Shower size/ }).locator("input");
await size.nth(0).fill("60"); await size.nth(0).press("Enter"); await wait(400);
await size.nth(1).fill("38"); await size.nth(1).press("Enter"); await wait(700);
await pg.locator('[data-wedi-opt="0"]').click();
await wait(700);
await tab("Compare");
await settle();
console.log("c3 totals", await totals(), "|", await delta());
await shot("c3-wedi-host-retail");

await pg.locator(".cmp-tab .qfoot .cbtn.primary").click();
await pg.waitForSelector(".cmp-tab .cmodal .box", { timeout: 10000 });
await wait(600);
console.log("c5 modal rows", await pg.$$eval(".cmp-tab .cmodal .orow", (es) => es.map((e) => e.textContent.replace(/\s+/g, " "))));
await shot("c5-quote-options-modal");

await pg.click("[data-compare-confirm]");
await wait(600);
console.log("onQuoteOptions fired:", quotePayloads.length);

await b.close();
if (hadPageError) { console.error("FAILED — page errors above"); process.exit(1); }
if (!quotePayloads.length) { console.error("FAILED — Confirm never called onQuoteOptions"); process.exit(1); }
console.log("OK");

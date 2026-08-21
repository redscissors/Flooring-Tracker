// Final-review render check (phase 5): Esc containment in the compare confirm
// modal, plus the Kits-tab room chip (roomFromWedi read off the pan).
//
//   npx vite --port 5199        # in the repo, with a .env present
//   node .scratch/097_schluter-configurator/phase5-proof/final-review/shoot-final-review.mjs
//
// Fails on any pageerror, on the modal surviving the first Escape, on the
// popup NOT surviving it, or on the popup not closing on the second.
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/097_schluter-configurator/phase5-proof/final-review";
const W_URL = "http://localhost:5199/wedi-preview.html";

let hadPageError = false;
const closes = [];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 1 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
pg.on("console", (m) => {
  if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200));
  if (m.text().startsWith("onClose")) closes.push(m.text());
});
const wait = (ms) => pg.waitForTimeout(ms);
const tab = async (label) => { await pg.locator(".modetab", { hasText: label }).click(); await wait(400); };
const settle = async () => {
  await pg.waitForSelector(".cmp-tab .cmp-grid .cat", { timeout: 15000 });
  await pg.waitForFunction(() => {
    const tv = [...document.querySelectorAll(".cmp-tab .cmp-tot .tv")];
    return tv.length === 2 && tv.every((e) => e.textContent.startsWith("$"));
  }, null, { timeout: 20000 });
  await wait(500);
};
const chip = () => pg.$eval(".cmp-tab .cmp-head .room", (e) => e.textContent.trim());
const mounted = (sel) => pg.$$eval(sel, (es) => es.length);

await pg.goto(W_URL, { waitUntil: "load" });
await pg.waitForSelector("[data-wedi-pop]", { timeout: 20000 });
await wait(1400);

// --- A. Kits-tab pick: a LINEAR pan must read as a linear drain -------------
await tab("Kits");
await pg.click('[data-wedi-pan="US9310001"]');   // 3'x5' Linear Shower Base
await wait(700);
await tab("Compare");
await settle();
console.log("A linear kit room chip:", await chip());
await pg.screenshot({ path: `${OUT}/esc-a-kits-linear.png` });

// curbless pan
await tab("Kits");
await pg.click('[data-wedi-pan="US9200001"]');   // 3'x4' Curbless Shower Base
await wait(400);
const ov = await mounted("[data-wedi-overwrite-yes]");
if (ov) { await pg.click("[data-wedi-overwrite-yes]"); await wait(700); }
await tab("Compare");
await settle();
console.log("A curbless kit room chip:", await chip());

// --- B. Esc containment ----------------------------------------------------
await pg.locator(".cmp-tab .qfoot .cbtn.primary").click();
await pg.waitForSelector(".cmp-tab .cmodal .box", { timeout: 10000 });
await wait(400);
console.log("B modal open:", await mounted(".cmp-tab .cmodal .box"), "popup:", await mounted("[data-wedi-pop]"), "onClose calls:", closes.length);
await pg.screenshot({ path: `${OUT}/esc-b1-modal-open.png` });

await pg.keyboard.press("Escape");
await wait(500);
const afterOne = { modal: await mounted(".cmp-tab .cmodal .box"), popup: await mounted("[data-wedi-pop]"), grid: await mounted(".cmp-tab .cmp-grid"), closes: closes.length };
console.log("B after Esc #1:", JSON.stringify(afterOne));
await pg.screenshot({ path: `${OUT}/esc-b2-after-first-esc.png` });

await pg.keyboard.press("Escape");
await wait(500);
console.log("B after Esc #2: onClose calls:", closes.length);

await b.close();
const ok = afterOne.modal === 0 && afterOne.popup === 1 && afterOne.grid === 1 && afterOne.closes === 0 && closes.length === 1 && !hadPageError;
console.log(ok ? "OK" : "FAILED");
process.exit(ok ? 0 : 1);

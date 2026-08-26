// Preview-proof rig for issue 112 — the special-order entry-line copy button.
//
//   npx vite --port 5199
//   node .scratch/112_special-order-entry-macro/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const OUT = ".scratch/112_special-order-entry-macro";
const URL = "http://localhost:5199/order-entry-preview.html";

let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 1120 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
const pg = await ctx.newPage();
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
pg.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200)); });

await pg.goto(URL);
await pg.waitForSelector('button[title^="Copy the whole entry line"]', { timeout: 20000 });
await pg.waitForTimeout(500);

// Click the entry-line button on two rows — a SKU'd book line and a Sheoga
// by-description line — so the shot shows the latched green check, then echo
// the clipboard after each so the record carries the real tab-joined text.
const btns = pg.locator('button[title^="Copy the whole entry line"]');
console.log("entry-line buttons:", await btns.count());
await btns.nth(0).click();
await pg.waitForTimeout(200);
console.log("LINE 1 >>> " + JSON.stringify(await pg.evaluate(() => navigator.clipboard.readText())));
await btns.nth(2).click();
await pg.waitForTimeout(200);
console.log("LINE 3 >>> " + JSON.stringify(await pg.evaluate(() => navigator.clipboard.readText())));

await pg.screenshot({ path: `${OUT}/preview-order-entry.png`, fullPage: true });
console.log("shot preview-order-entry.png");

await b.close();
process.exit(hadPageError ? 1 : 0);

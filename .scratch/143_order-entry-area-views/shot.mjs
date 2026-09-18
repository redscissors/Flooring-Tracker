// Preview proof (issue 143): the REAL OrderEntryPanel over the three-area
// fixture in orderentrypreview.jsx. Vite on :5199 (npx vite --port 5199), then
//   node .scratch/143_order-entry-area-views/shot.mjs
// area.png — opens on Area + vendor (the default), the first pill opened;
// compact.png — the switch flipped to Compact; sheet.png — Sheet order.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
await page.goto("http://localhost:5199/order-entry-preview.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => document.fonts.ready);
const bandsOf = () => page.$$eval(".ft-eyebrow.tracking-\\[\\.12em\\]", (es) => es.filter((e) => e.tagName === "DIV").map((e) => e.textContent.trim()));
const pressed = () => page.$$eval("button[aria-pressed=true]", (bs) => bs.map((b) => b.textContent.trim()));
console.log("default view:", (await pressed()).join(","));
console.log("area bands:", (await bandsOf()).join(" | "));
const pills = await page.$$("button[aria-expanded]");
console.log("merged pills:", pills.length);
if (pills[0]) await pills[0].click();
await page.screenshot({ path: join(dir, "area.png"), fullPage: false });
console.log("shot area.png");
await page.click("button:has-text('Compact')");
await page.waitForTimeout(300);
console.log("compact bands:", (await bandsOf()).join(" | "));
const compactStock = await page.$$eval("section:last-of-type label", (ls) => ls.map((l) => l.textContent.trim().replace(/\s+/g, " ").slice(0, 70)));
console.log("compact stock lines:\n  " + compactStock.join("\n  "));
await page.screenshot({ path: join(dir, "compact.png"), fullPage: false });
console.log("shot compact.png");
await page.click("button:has-text('Sheet order')");
await page.waitForTimeout(300);
console.log("sheet bands:", (await bandsOf()).join(" | "));
await page.screenshot({ path: join(dir, "sheet.png"), fullPage: false });
console.log("shot sheet.png");
await browser.close();

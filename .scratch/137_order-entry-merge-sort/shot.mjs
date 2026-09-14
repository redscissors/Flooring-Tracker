// Preview proof (issue 137): the REAL OrderEntryPanel over the three-area
// fixture in orderentrypreview.jsx. Vite on :5199 (npx vite --port 5199), then
//   node .scratch/137_order-entry-merge-sort/shot.mjs
// merged.png — opens on Merged & sorted, the first two pills opened;
// sheet.png — the switch flipped to Sheet order.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 1500 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
await page.goto("http://localhost:5199/order-entry-preview.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => document.fonts.ready);
const bands = await page.$$eval("[role=group] ~ * , section", () => 0).catch(() => 0);
const pills = await page.$$("button[aria-expanded]");
console.log("merged pills:", pills.length);
for (const p of pills.slice(0, 2)) await p.click();
const labels = await page.$$eval("h4", (hs) => hs.map((h) => h.textContent.trim()));
console.log("sections:", labels.join(" | "));
const stockText = await page.$$eval("label", (ls) => ls.map((l) => l.textContent.trim().slice(0, 60)));
console.log("stock lines:", stockText.length);
await page.screenshot({ path: join(dir, "merged.png"), fullPage: false });
console.log("shot merged.png");
await page.click("button:has-text('Sheet order')");
await page.waitForTimeout(300);
const labels2 = await page.$$eval("h4", (hs) => hs.map((h) => h.textContent.trim()));
console.log("sections (sheet):", labels2.join(" | "));
await page.screenshot({ path: join(dir, "sheet.png"), fullPage: false });
console.log("shot sheet.png");
await browser.close();
void bands;

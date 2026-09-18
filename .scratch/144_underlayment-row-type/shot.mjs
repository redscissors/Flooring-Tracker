// Preview proof (issue 144). Build: npx vite build --config .scratch/144_underlayment-row-type/proof-vite.config.mjs
// Serve proof-dist on :8392 (python3 -m http.server 8392 -d .scratch/144_underlayment-row-type/proof-dist), then
//   node .scratch/144_underlayment-row-type/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const dir = new URL(".", import.meta.url).pathname;
const base = "http://localhost:8392/.scratch/144_underlayment-row-type/proof.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));
await page.goto(base); await page.waitForTimeout(600); await page.evaluate(() => document.fonts.ready);
console.log("grid order:", await page.locator('[data-testid="grid"] [data-c="order"]').textContent());
console.log("old  order:", await page.locator('[data-testid="old"] [data-c="order"]').textContent());
console.log("switch chip:", await page.locator('[data-testid="old"] .text-amber-600').textContent());
await page.screenshot({ path: `${dir}01-grid.png`, fullPage: true });
await page.locator('[data-testid="old"] [data-c="switch"]').click(); await page.waitForTimeout(200);
console.log("old after:", await page.locator('[data-testid="old"] [data-c="order"]').textContent());
const stored = await page.$$eval(".stored", (els) => els.map((e) => e.textContent.trim())); stored.forEach((s) => console.log("  ", s));
await page.screenshot({ path: `${dir}02-switch-after.png`, fullPage: true });
await page.locator('[data-testid="drawer"]').screenshot({ path: `${dir}03-drawer.png` });
await page.goto(base + "?print"); await page.waitForTimeout(800); await page.evaluate(() => document.fonts.ready);
console.log("print membrane line:", await page.evaluate(() => {
  const el = [...document.querySelectorAll('[data-testid="print"] .flex.justify-between')].find((e) => /Ditra Heat/.test(e.textContent));
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "(not found)";
}));
console.log("job totals:", (await page.locator('[data-testid="jobtotals"] .stored').textContent()).replace(/\s+/g, " ").trim());
await page.screenshot({ path: `${dir}04-print.png`, fullPage: true });
await browser.close();

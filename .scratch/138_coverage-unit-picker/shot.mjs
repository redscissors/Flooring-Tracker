// Preview proof (issue 138). Build: npx vite build --config .scratch/138_coverage-unit-picker/proof-vite.config.mjs
// Serve proof-dist on :8392 (python3 -m http.server 8392 -d .scratch/138_coverage-unit-picker/proof-dist), then
//   node .scratch/138_coverage-unit-picker/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const dir = new URL(".", import.meta.url).pathname;
const base = "http://localhost:8392/.scratch/138_coverage-unit-picker/proof.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));
await page.goto(base); await page.waitForTimeout(600); await page.evaluate(() => document.fonts.ready);
const sel = (id) => page.locator(`[data-testid="${id}"] select[data-c="unit"]`).first();
const order = (id) => page.locator(`[data-testid="${id}"] [data-c="order"]`).textContent();
console.log("before:", await order("mosaic"), "|", await order("trim"), "|", await order("roll"));
await page.screenshot({ path: `${dir}01-before.png`, fullPage: true });
await sel("mosaic").selectOption("SH"); await sel("trim").selectOption("PK"); await sel("roll").selectOption("RL");
await page.waitForTimeout(200);
console.log("after: ", await order("mosaic"), "|", await order("trim"), "|", await order("roll"));
const stored = await page.$$eval(".stored", (els) => els.map((e) => e.textContent.trim()));
stored.forEach((s) => console.log("  ", s));
await page.screenshot({ path: `${dir}02-after.png`, fullPage: true });
await page.setViewportSize({ width: 430, height: 900 });
await page.goto(base + "?phone"); await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}03-phone-before.png`, fullPage: true });
await page.locator('select[data-c="unit"]').first().selectOption("SH"); await page.waitForTimeout(200);
console.log("phone sheet SF tag:", await page.locator('select[data-c="unit"]').first().inputValue());
await page.screenshot({ path: `${dir}04-phone-after.png`, fullPage: true });
await browser.close();

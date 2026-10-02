// Grid proof (issue 165).
//   npx vite --config .scratch/165_shower-line-descriptions/grid/vite.config.mjs
//   node .scratch/165_shower-line-descriptions/grid/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && !/ERR_CERT|404/.test(m.text()) && console.log("[console]", m.text().slice(0, 300)));
await page.goto("http://localhost:5199/.scratch/165_shower-line-descriptions/grid/preview.html", { waitUntil: "networkidle" });
try { await page.waitForSelector("[data-prod-card], input[data-c='size']", { timeout: 30000 }); }
catch (e) { await page.screenshot({ path: join(dir, "grid-fail.png"), fullPage: true }); console.log("FAIL: grid never rendered —", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300)); await browser.close(); process.exit(1); }
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);
await page.screenshot({ path: join(dir, "grid-wedi-schluter.png"), fullPage: true });
const sizes = await page.locator("input[data-c='size']").evaluateAll((els) => els.map((e) => e.value));
const names = await page.locator("input[placeholder='Description…'], input[placeholder='Product / color…']").evaluateAll((els) => els.map((e) => e.value));
console.log("sizes:", JSON.stringify(sizes));
console.log("names:", JSON.stringify(names));
await browser.close();

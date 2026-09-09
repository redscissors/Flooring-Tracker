// Preview proof: the REAL App (fake client) — Marcus's flagged Sheoga line as
// the configurator now writes it, then the reopened configurator's own
// description. Vite on :5199: `npx vite --config .scratch/132_sheoga-custom-stain-wording/vite.config.mjs`
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
await page.goto("http://localhost:5199/.scratch/132_sheoga-custom-stain-wording/preview.html", { waitUntil: "networkidle" });
await page.waitForSelector("[data-prod-card]", { timeout: 15000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
const shot = async (name, loc = page) => { await page.waitForTimeout(250); await loc.screenshot({ path: join(dir, name) }); console.log("shot", name); };
const cards = page.locator("[data-prod-card]");
console.log("rows", await cards.count());
for (let i = 0; i < await cards.count(); i++) console.log("row", i, (await cards.nth(i).innerText()).split("\n").slice(0, 3).join(" | "));
await shot("1-job-line.png");
await page.locator("[data-sheoga-reconfig]").first().click();
await page.waitForSelector("[data-sheoga-desc]", { timeout: 10000 });
await page.waitForTimeout(400);
console.log("popup desc:", await page.locator("[data-sheoga-desc]").first().innerText());
await shot("2-configurator-desc.png", page.locator("[data-sheoga-pop]").first());
await browser.close();

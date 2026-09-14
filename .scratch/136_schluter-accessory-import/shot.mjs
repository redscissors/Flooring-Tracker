// Preview proof (issue 136): the REAL SchluterConfigurator over the fixture
// catalog whose rows now lead with "Schluter" (ADR 0041) — the popup shows
// every name without the lead. Vite on :5199 (npx vite --port 5199), then
//   node .scratch/136_schluter-accessory-import/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
await page.goto("http://localhost:5199/schluter-preview.html", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.evaluate(() => document.fonts.ready);
const names = await page.evaluate(() => [...document.querySelectorAll(".n")].map((n) => n.childNodes[0]?.textContent?.trim()).filter(Boolean));
console.log("popup names:", names.length, "leading with Schluter:", names.filter((n) => /^schluter/i.test(n)).length);
console.log(names.slice(0, 12).join(" | "));
await page.screenshot({ path: join(dir, "popup-no-lead.png"), fullPage: false });
console.log("shot popup-no-lead.png");
await browser.close();

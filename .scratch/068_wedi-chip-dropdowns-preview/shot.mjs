// Screenshot run for the change-control preview. `npx vite --port 5199` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const URL = "http://localhost:5199/.scratch/068_wedi-chip-dropdowns-preview/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/068_wedi-chip-dropdowns-preview";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.click("text=wedi configurator");
await page.waitForSelector(".pancard", { timeout: 15000 });

// 1. fundo kit build: no boxed-kit compare, fastener line reads its contents only
await page.locator(".pancard").first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/preview-1-build-no-boxcompare.png` });

// 2. Niche chip opens a picker (8 choices)
await page.click(".addchip >> text=Niche");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-2-niche-picker.png` });
await page.locator(".wedi-chipmenu .srow").first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-3-niche-added.png` });

// 3. curbless build: Recess kit chip (off by default), picker offers kit/ramp
await page.locator('.pancard:has-text("Curbless")').first().click();
await page.waitForTimeout(400);
// the niche add made the build custom — confirm the reset to the stock kit
const ow = page.locator("[data-wedi-overwrite-yes]");
if (await ow.count()) { await ow.click(); await page.waitForTimeout(400); }
await page.screenshot({ path: `${OUT}/preview-4-curbless-recess-chip.png` });
await page.click(".addchip >> text=Recess kit");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-5-recess-picker.png` });
await page.locator(".wedi-chipmenu .srow").first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-6-recess-added.png` });

await browser.close();
console.log("done");

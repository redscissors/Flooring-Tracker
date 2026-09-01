// Screenshot run for the address Maps/paste preview. `npx vite --port 5199` first.
// Shoots the three real AddressFields at rest, after a paste of the two-line
// Maps copy, and the fallback when the browser refuses the clipboard read.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_LIB || "playwright-core");

const URL = "http://localhost:5199/.scratch/119_address-maps-paste/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/119_address-maps-paste";

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 820, height: 720 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/fields.png` });

await page.getByTitle("Paste the address you copied").first().click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/pasted.png` });

await page.locator('[data-mode="blocked"]').click();
await page.getByTitle("Paste the address you copied").nth(2).click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/blocked.png` });

await browser.close();
console.log("done");

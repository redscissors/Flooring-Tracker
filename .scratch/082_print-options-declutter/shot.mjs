// Screenshot run for the change-control preview. `npx vite --port 5199` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_LIB || "playwright-core");

const URL = "http://localhost:5199/.scratch/082_print-options-declutter/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/082_print-options-declutter";

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.locator('[data-shot="no-shared"]').screenshot({ path: `${OUT}/print-1-options-no-shared.png` });
await page.locator('[data-shot="with-shared"]').screenshot({ path: `${OUT}/print-2-options-with-shared.png` });

await browser.close();
console.log("done");

// Screenshot run for the 8b preview proof. `npx vite --port 5199` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_LIB || "playwright-core");

const OUT = "/home/user/Flooring-Tracker/.scratch/120_wedi-pricelist-book";
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

// The popup's Browse caption in its five states.
for (const mode of ["none", "stock", "so", "both", "floor"]) {
  await page.goto(`http://localhost:5199/wedi-preview.html?mode=${mode}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Browse/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/popup-${mode}.png` });
}
// The two renamed frames and an S-Dry twin, in Browse with both books on.
await page.goto("http://localhost:5199/wedi-preview.html?mode=both", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Browse/ }).click();
await page.getByPlaceholder(/search/i).fill("SS27");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/browse-frame-ss27.png` });
await page.getByPlaceholder(/search/i).fill("S-DRY SEAL");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/browse-sdry-seal.png` });

// The wizard recognising the workbook: warnings + the diff preview.
await page.goto("http://localhost:5199/.scratch/120_wedi-pricelist-book/wizard-preview.html", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/wizard-recognised.png`, fullPage: true });

await browser.close();
console.log("done");

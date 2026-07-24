import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] }).catch(async (e) => {
  console.error("launch failed", e.message); process.exit(1);
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto("http://localhost:5199/preview.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.screenshot({ path: "wizard-zero-row.png", fullPage: false });
// prove the Apply button is disabled
const btn = await page.locator("button:has-text('Apply')").last();
console.log("apply label:", await btn.textContent());
console.log("apply disabled:", await btn.isDisabled());
await browser.close();

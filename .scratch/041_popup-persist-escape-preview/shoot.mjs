import { chromium } from "playwright-core";

const URL = "http://localhost:5199/.scratch/041_popup-persist-escape-preview/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/041_popup-persist-escape-preview";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (m) => console.log("[console]", m.type(), m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.removeItem("ft-open-layer"));
await page.reload({ waitUntil: "networkidle" });

// 1. one-press Escape out of a popup while focused in its text box
await page.click('[data-t="open-modal"]');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/preview-1-popup-open-focus-in-input.png` });
const focused = await page.evaluate(() => document.activeElement?.tagName);
console.log("focused before Escape:", focused);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/preview-2-one-escape-closed-it.png` });
console.log("log after escape:", await page.locator('[data-t="log"]').innerText());

// 2. Sheoga configurator: open, change config, verify ft-open-layer follows
await page.click('[data-t="open-sheoga"]');
await page.waitForTimeout(500);
// change something visible: pick the Character grade if present, else click a width chip
const chips = page.locator("button", { hasText: "Character" });
if (await chips.count()) await chips.first().click();
const width = page.locator("button", { hasText: '5 1/4"' });
if (await width.count()) await width.first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-3-sheoga-configured.png` });
console.log("stored layer:", await page.evaluate(() => localStorage.getItem("ft-open-layer")));

// 3. reload — the configurator must come back mid-configuration
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/preview-4-reload-restored.png` });
console.log("after reload, stored:", await page.evaluate(() => localStorage.getItem("ft-open-layer")));

// 4. Escape ladder inside the configurator from a text field: number input focus
const sfBox = page.locator("input").first();
if (await sfBox.count()) await sfBox.click();
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/preview-5-escape-closed-configurator.png` });
console.log("final stored:", await page.evaluate(() => localStorage.getItem("ft-open-layer")));
console.log("final log:", await page.locator('[data-t="log"]').innerText());

await browser.close();

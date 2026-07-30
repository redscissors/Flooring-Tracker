// Screenshot run for the change-control preview. `npx vite --port 5199` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const URL = "http://localhost:5199/.scratch/067_wedi-apps-hub-preview/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/067_wedi-apps-hub-preview";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("console", (m) => console.log("[console]", m.type(), m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-1-hub-nav.png` });

// open the wedi tab (lazy chunk)
await page.click("text=wedi configurator");
await page.waitForSelector(".pancard", { timeout: 15000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-2-wedi-embedded-kits.png` });

// build a kit — the build column shows the install lines' contents meta
await page.locator(".pancard").first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/preview-3-kit-build.png` });

// Add → payload preview → confirm → destination prompt (project "open")
await page.click("[data-wedi-add]");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-4-payload.png` });
await page.click("[data-wedi-confirm]");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-5-destination-prompt.png` });
await page.click("text=Current project");
await page.waitForTimeout(300);

// Browse → Misc/Fasteners: rows now lead with their contents
await page.click(".modetab >> text=Browse");
await page.waitForTimeout(400);
await page.click("text=Fasteners");
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/preview-6-browse-fasteners.png` });

await browser.close();
console.log("done");

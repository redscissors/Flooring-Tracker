import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const dir = "/tmp/claude-0/-home-user-Flooring-Tracker/c2b869e6-babf-582a-b185-5646cbbdc670/scratchpad/preview";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });

page.on("console", (m) => console.log("[console]", m.type(), m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

// Browser overlay: strip open (both sections)
await page.goto(`file://${dir}/browser.html`);
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/preview-browser.png` });

// Same page with the salesperson filter set — strip narrows with the grid
await page.fill('input[placeholder="Salesperson"]', "Marcus");
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/preview-browser-sales.png` });

await page.goto(`file://${dir}/sidebar.html`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/preview-sidebar.png`, fullPage: true });

await browser.close();
console.log("done");

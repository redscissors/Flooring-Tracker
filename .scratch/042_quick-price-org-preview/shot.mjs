import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const dir = "/tmp/claude-0/-home-user-Flooring-Tracker/b835faec-48c3-52ae-b039-fca409e73cd0/scratchpad/preview";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });

page.on("console", (m) => console.log("[console]", m.type(), m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(`file://${dir}/browser.html`);
await page.waitForTimeout(600);
await page.screenshot({ path: `${dir}/preview-browser.png` });

await page.goto(`file://${dir}/sidebar.html`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}/preview-sidebar.png`, fullPage: true });

await browser.close();
console.log("done");

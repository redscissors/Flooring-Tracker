import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const dir = "/tmp/claude-0/-home-user-Flooring-Tracker/cdfe7553-2fe4-5e48-8b39-f5e8482033d8/scratchpad/preview";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(`file://${dir}/page.html#sidebar`);
await page.waitForTimeout(700);
await page.screenshot({ path: `${dir}/preview-sidebar.png`, clip: { x: 0, y: 0, width: 300, height: 900 } });

for (const app of ["wedi", "sheoga"]) {
  await page.goto(`file://${dir}/page.html#${app}`);
  await page.reload();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/preview-hub-${app}.png` });
}
await browser.close();
console.log("done");

// Round 4: A4 with each tagline, print media, masthead crop + full page 1.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
const OUT = "/home/user/Flooring-Tracker/.scratch/126_print-selection-sheet-protos";
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 726, height: 950 }, deviceScaleFactor: 2 });
for (const tag of ["b", "c"]) {
  await page.goto(`http://localhost:5199/.scratch/126_print-selection-sheet-protos/proto.html?v=A4&wm=fill&tag=${tag}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/A4-tag${tag}-print-p1.png` });
  await page.screenshot({ path: `${OUT}/A4-tag${tag}-masthead.png`, clip: { x: 0, y: 0, width: 726, height: 150 } });
}
await browser.close();

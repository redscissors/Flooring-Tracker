// Proof for the Extras relabel: the 082 options-print harness (real
// EstimatePaper over option fixtures) shot in print media, clipped to the
// shared-areas materials box. `npx vite --port 5199` from the repo root first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
const OUT = "/home/user/Flooring-Tracker/.scratch/128_print-selection-sheet";
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:5199/.scratch/127_print-extras-label/preview.html", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
for (const media of ["screen", "print"]) {
  await page.emulateMedia({ media });
  await page.waitForTimeout(150);
  await page.locator('[data-shot="with-shared"]').screenshot({ path: `${OUT}/options-with-shared-${media}.png` });
}
const labels = await page.evaluate(() => [...document.querySelectorAll('[data-shot="with-shared"] .uppercase')].map((e) => e.textContent).filter((t) => /extras|sundries/i.test(t)));
console.log(labels);
await browser.close();

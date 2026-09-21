// Preview proof (issue 149). Vite on :5199 (npx vite --port 5199), then
//   node .scratch/149_search-pending-note/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const shot = async (state, file, { typed = "hanoi", settle = 350, width = 760, height = 420 } = {}) => {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", state, e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("[console]", state, m.text()); });
  await page.goto(`http://localhost:5199/.scratch/149_search-pending-note/preview.html?state=${state}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (typed) { await page.click('[data-c="product"]'); await page.keyboard.type(typed, { delay: 20 }); }
  await page.waitForTimeout(settle);
  const note = await page.locator("text=No exact match").count();
  const bar = await page.locator(".ft-progress-indeterminate").count();
  console.log(`${file}: amber note=${note} bar=${bar}`);
  await page.screenshot({ path: join(dir, file), fullPage: false });
  await page.close();
};
await shot("pending", "pending.png");
await shot("pending-stock", "pending-stock.png", { typed: "haystack" });
await shot("settled", "settled.png", { settle: 900 });
await shot("near", "near.png", { settle: 900 });
await shot("cell", "cell.png");
await shot("mobile", "mobile.png", { typed: "", width: 390, height: 640 });
await browser.close();

// Preview proof (issue 150): the order-entry header bar at a half-screen
// window (960px, half of a 1920 monitor) must stay one row; the phone fold
// (420px) must stay. Vite on :5199 (npx vite --port 5199), then
//   node .scratch/150_order-header-half-screen-fold/shot.mjs [suffix]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const suffix = process.argv[2] ? `-${process.argv[2]}` : "";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const shot = async (state, file, width) => {
  const page = await browser.newPage({ viewport: { width, height: 700 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", state, e.message));
  await page.goto(`http://localhost:5199/order-entry-preview.html?state=${state}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  const rows = await page.evaluate(() => {
    const bar = document.querySelector("input[aria-label='ERP 1 order number']").closest(".rounded-lg.border");
    const tops = new Set([...bar.children].map((c) => Math.round(c.getBoundingClientRect().top)));
    return tops.size;
  });
  console.log(`${file}: header rows = ${rows}`);
  await page.screenshot({ path: join(dir, file), fullPage: false });
  await page.close();
};
await shot("one", `half-960${suffix}.png`, 960);
await shot("one", `half-800${suffix}.png`, 800);
await shot("one", `fold-420${suffix}.png`, 420);
await browser.close();

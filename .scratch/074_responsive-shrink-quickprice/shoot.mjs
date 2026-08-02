// Screenshots the real app (booted against the fake Supabase) at a set of
// viewport widths. Usage: node shoot.mjs <label>
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const label = process.argv[2] || "shot";
const PAGE = "http://localhost:5199/.scratch/074_responsive-shrink-quickprice/app-preview.html";
const WIDTHS = [1440, 1150, 960, 820];
const dir = new URL("./shots/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const w of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${dir}${label}-${w}.png` });
  if (errs.length) console.log(`  [${w}] page errors:`, errs.slice(0, 3));
  console.log(`  ${label}-${w}.png`);
  await page.close();
}
await browser.close();

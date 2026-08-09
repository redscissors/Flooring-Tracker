// Screenshots the Settings workspace harness at a set of viewport sizes.
// Usage: node shoot.mjs <label> [section]
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const label = process.argv[2] || "shot";
const section = process.argv[3] || "materials";
const PAGE = `http://localhost:5199/.scratch/084_settings-mobile-shrink/preview.html?section=${section}`;
const SIZES = [[390, 844], [768, 1024], [1024, 768], [1440, 900]];
const dir = new URL("./shots/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dir}${label}-${section}-${w}.png` });
  if (errs.length) console.log(`  [${w}] page errors:`, errs.slice(0, 3));
  console.log(`  ${label}-${section}-${w}.png`);
  await page.close();
}
await browser.close();

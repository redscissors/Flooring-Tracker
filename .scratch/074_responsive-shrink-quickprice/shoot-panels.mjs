// Portals (search panels, popovers) render to document.body, OUTSIDE the scaled
// shell — this proves their anchoring math still lands on the anchor when the
// shell is zoomed. Shoots the row search panel and the salesperson popover at a
// scaled width and at full width.
import { chromium } from "playwright";

const PAGE = "http://localhost:5199/.scratch/074_responsive-shrink-quickprice/app-preview.html";
const dir = new URL("./shots/", import.meta.url).pathname;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const w of [1440, 960]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);

  await page.getByPlaceholder(/Search SKU or product/).first().click();
  await page.keyboard.type("she");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}panel-search-${w}.png` });
  await page.keyboard.press("Escape");

  await page.getByTitle(/Salesperson — locked in/).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}panel-salesperson-${w}.png` });
  console.log(`  panels @${w}`);
  await page.close();
}
await browser.close();

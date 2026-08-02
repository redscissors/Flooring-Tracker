// What the header ACTUALLY gets in the shipped layout. The prototype was drawn
// at 940px; the solver column is nothing like that once the build column and
// the drawings rail have taken their share, so measure it in the real popup.
import { chromium } from "playwright";

const URL = "http://127.0.0.1:5199/.scratch/075_wedi-header-and-shrink/hub.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const rows = [];

for (const w of [1920, 1680, 1440, 1280, 1024, 860, 720]) {
  const pg = await b.newPage({ viewport: { width: w, height: 940 } });
  await pg.goto(URL, { waitUntil: "load" });
  await pg.waitForTimeout(700);
  const back = pg.locator("button[title='Back to the app list']");
  if (await back.count()) { await back.click(); await pg.waitForTimeout(300); }
  await pg.locator("nav button", { hasText: "wedi configurator" }).click();
  await pg.waitForTimeout(900);
  await pg.locator(".modetab", { hasText: "Custom shower" }).click();
  await pg.waitForTimeout(900);
  // clientWidth is the popup's OWN (zoomed) pixel — the unit the CSS grid
  // resolves against; the bounding box is what the eye actually gets.
  const m = await pg.locator(".roomform").evaluate((el) => ({
    cssW: el.clientWidth, onScreenH: el.getBoundingClientRect().height,
  }));
  const main = await pg.locator(".main").evaluate((el) => el.clientWidth);
  rows.push({ viewport: w, solverColCss: main, headerCssW: m.cssW, headerOnScreenH: Math.round(m.onScreenH) });
  await pg.close();
}

await b.close();
console.table(rows);

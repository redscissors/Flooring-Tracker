// Preview proof (issue 147): the REAL OrderEntryPanel over the harness's ERP
// fixtures. Vite on :5199 (npx vite --port 5199), then
//   node .scratch/147_erp-order-numbers/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const shot = async (state, file, { width = 1280, act } = {}) => {
  const page = await browser.newPage({ viewport: { width, height: 1400 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", state, e.message));
  await page.goto(`http://localhost:5199/order-entry-preview.html?state=${state}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  if (act) await act(page);
  await page.screenshot({ path: join(dir, file), fullPage: false });
  console.log("shot", file);
  await page.close();
};
await shot("none", "locked.png");
await shot("one", "one.png");
await shot("two", "two.png", { act: async (p) => { await p.click("button[title^='Keyed on ERP 48213']"); await p.waitForTimeout(200); } });
await shot("quick", "quick.png");
await shot("two", "fold.png", { width: 420 });

// browser.png — the ERP order column + search, samples-preview harness
// (?browser=1); type 48213 into the search box to prove the column search.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", "browser", e.message));
  await page.goto("http://localhost:5199/samples-preview.html?browser=1", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  const search = await page.$("input[placeholder^='Name, phone']");
  if (search) await search.fill("48213");
  else console.log("[warn] browser.png: no search input found — screenshot taken unfiltered");
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(dir, "browser.png"), fullPage: false });
  console.log("shot browser.png");
  await page.close();
}

// header.png — header-preview.html at 1280 wide, the top of the page down
// through the classic header, so both the one-bar and classic project
// headers show their ERP chip (Task 9, widened scope).
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", "header", e.message));
  await page.goto("http://localhost:5199/header-preview.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  const box = await page.$eval("#proj-header-classic", (el) => {
    const r = el.getBoundingClientRect();
    return { x: 0, y: 0, width: window.innerWidth, height: Math.ceil(r.bottom) + 16 };
  });
  await page.screenshot({ path: join(dir, "header.png"), clip: box });
  console.log("shot header.png");
  await page.close();
}

// mobile-band.png — the Fold 5 cover-width band alone, one ERP order.
{
  const page = await browser.newPage({ viewport: { width: 500, height: 700 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", "mobile-band", e.message));
  await page.goto("http://localhost:5199/header-preview.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$("#mobile-band");
  await el.screenshot({ path: join(dir, "mobile-band.png") });
  console.log("shot mobile-band.png");
  await page.close();
}

await browser.close();

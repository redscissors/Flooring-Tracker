// Does `zoom` on <html> keep position:fixed portal math correct?
// Anchored panels read getBoundingClientRect() and write those numbers straight
// into a fixed-position style. If the root is zoomed, either gBCR already
// accounts for it (math holds) or the written px get scaled again (panels drift).
import { chromium } from "playwright";

const PAGE = "http://localhost:5199/.scratch/074_responsive-shrink-quickprice/app-preview.html";
const dir = new URL("./shots/", import.meta.url).pathname;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);

// Turn OFF the app's own shell zoom for this probe, zoom the root instead.
await page.evaluate(() => {
  document.querySelectorAll("main, aside").forEach((el) => (el.style.zoom = ""));
  document.documentElement.style.zoom = "0.8";
});
await page.waitForTimeout(300);

await page.getByPlaceholder(/Search SKU or product/).first().click();
await page.keyboard.type("she");
await page.waitForTimeout(600);

const report = await page.evaluate(() => {
  const input = document.querySelector("input[placeholder*='Search SKU']");
  const panel = [...document.body.children].find((n) => n.textContent?.includes("Vendor configurators") || n.textContent?.includes("VENDOR"));
  const ir = input.getBoundingClientRect();
  const pr = panel?.getBoundingClientRect();
  return { anchorLeft: ir.left, anchorBottom: ir.bottom, panelLeft: pr?.left, panelTop: pr?.top, innerWidth: window.innerWidth };
});
console.log(JSON.stringify(report, null, 2));
await page.screenshot({ path: `${dir}probe-rootzoom.png` });
await browser.close();

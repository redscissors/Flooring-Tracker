// The Email button in the Clean header layouts (header-preview.html).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:5199/header-preview.html", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
for (const id of ["proj-header-clean", "proj-header-clean-compact", "proj-header-clean-done"]) {
  const el = page.locator("#" + id + " > div").first();
  await el.screenshot({ path: join(dir, `${id}.png`) });
  console.log("shot", id);
}
const btn = page.locator('#proj-header-clean [aria-label="Email selections"]');
await btn.hover();
await page.waitForTimeout(600);
const box = await btn.boundingBox();
await page.screenshot({ path: join(dir, "clean-hover.png"), clip: { x: box.x - 220, y: box.y - 20, width: 440, height: 130 } });
const widths = await page.evaluate(() => {
  const root = document.querySelector("#proj-header-clean");
  const mail = root.querySelector('[aria-label="Email selections"]').getBoundingClientRect().width;
  const print = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === "Print").getBoundingClientRect().width;
  return { mail, print };
});
console.log("widths", widths);
await browser.close();

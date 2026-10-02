// Shots for the two sheets.  npx vite --port 5199 ; node .scratch/165_shower-line-descriptions/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const base = "http://localhost:5199/.scratch/165_shower-line-descriptions/preview.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
// after.* = the sheet as the engines land it now (ADR 0054); the committed
// configurator.png / stock-book.png are the 2026-10-01 before shots
for (const [name, qs] of [["after", ""]]) {
  const page = await browser.newPage({ viewport: { width: 816, height: 1400 } });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));
  await page.goto(base + qs, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: join(dir, `${name}.pdf`), format: "Letter", printBackground: true, preferCSSPageSize: true });
  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
  // the no-split SKU: squeeze one brand row's product cell and shoot it
  await page.evaluate(() => {
    const span = [...document.querySelectorAll("span")].find((el) => /^SKU \d+$/.test(el.textContent) && el.style.whiteSpace === "nowrap" && /wedi Building Panel/.test(el.closest("div").textContent));
    let cell = span; while (cell && !(cell.style && cell.style.minWidth === "0px")) cell = cell.parentElement;
    if (cell) { cell.style.width = "118px"; cell.setAttribute("data-squeezed", "1"); }
  });
  await page.waitForTimeout(200);
  const row = page.locator("[data-squeezed]").first();
  if (await row.count()) { const box = await row.boundingBox(); await page.screenshot({ path: join(dir, "print-narrow.png"), clip: { x: Math.max(0, box.x - 20), y: box.y - 6, width: 360, height: box.height + 12 } }); console.log("shot print-narrow"); }
  console.log("shot", name, (await page.locator('[data-shot="paper"]').innerText()).replace(/\s+/g, " ").slice(0, 300));
  await page.close();
}
await browser.close();

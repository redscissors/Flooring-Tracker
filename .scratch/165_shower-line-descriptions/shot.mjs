// Shots for the two sheets.  npx vite --port 5199 ; node .scratch/165_shower-line-descriptions/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const base = "http://localhost:5199/.scratch/165_shower-line-descriptions/preview.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
for (const [name, qs] of [["configurator", ""], ["stock-book", "?names=stock"]]) {
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
  console.log("shot", name, (await page.locator('[data-shot="paper"]').innerText()).replace(/\s+/g, " ").slice(0, 300));
  await page.close();
}
await browser.close();

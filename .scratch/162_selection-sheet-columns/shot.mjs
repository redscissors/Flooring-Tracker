// Preview proof (issue 162): the REAL App over the fake client, Print preview
// tab. Vite on :5199:
//   npx vite --config .scratch/162_selection-sheet-columns/vite.config.mjs
//   node .scratch/162_selection-sheet-columns/shot.mjs [prefix]
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const pre = process.argv[2] || "";
const base = "http://localhost:5199/.scratch/162_selection-sheet-columns/preview.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
for (const [name, qs] of [["full", ""], ["unit", "?pricing=unit"], ["none", "?pricing=none"], ["options", "?opts=1"], ["freight", "?freight=1"], ["lvp-only", "?lvp=1"]]) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 3200 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts|ERR_CERT|net::/.test(m.text())) console.log("[console]", m.text().slice(0, 200)); });
  await page.goto(base + qs, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-prod-card]", { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.getByText("Print preview", { exact: true }).first().click();
  await page.waitForTimeout(1000);
  const target = page.locator("[data-estimate-paper]").first();
  await target.screenshot({ path: join(dir, `${pre}${name}.png`) });
  console.log("shot", `${pre}${name}.png`);
  if (name === "full") {
    const text = await target.innerText();
    console.log("has ◆:", text.includes("◆"), "| Estimated total line:", (text.match(/Estimated total[^\n]*\n?[^\n]*/i) || [""])[0].replace(/\n/g, " "));
  }
  // The app's own print path: print media shows the hidden print copy.
  await page.emulateMedia({ media: "print" });
  const pdf = join(dir, `${pre}${name}.pdf`);
  await page.pdf({ path: pdf, format: "Letter", printBackground: true, preferCSSPageSize: true });
  console.log("pdf", `${pre}${name}.pdf`);
  await page.close();
}
await browser.close();

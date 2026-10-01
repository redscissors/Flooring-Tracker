// Preview proof (issue 164): every print case through the app's own print path.
//   npx vite --config .scratch/164_selection-sheet-dynamic-columns/proof/vite.config.mjs
//   PW=/opt/node22/lib/node_modules/playwright node .scratch/164_selection-sheet-dynamic-columns/proof/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const base = "http://localhost:5196/.scratch/164_selection-sheet-dynamic-columns/proof/preview.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
for (const [name, qs] of [["full", ""], ["unit", "?pricing=unit"], ["none", "?pricing=none"], ["options", "?opts=1"], ["freight", "?freight=1"], ["lvp-only", "?lvp=1"], ["single", "?single=1"]]) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 3200 } });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.goto(base + qs, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-prod-card]", { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.getByText("Print preview", { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: join(dir, `${name}.pdf`), format: "Letter", printBackground: true, preferCSSPageSize: true });
  console.log("pdf", `${name}.pdf`);
  await page.close();
}
await browser.close();

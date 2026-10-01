// Mockup shots (issue 163): each option through the app's print path.
//   npx vite --config .scratch/163_selection-sheet-grid-options/vite.config.mjs
//   node .scratch/163_selection-sheet-grid-options/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const base = "http://localhost:5198/.scratch/163_selection-sheet-grid-options/preview.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const only = process.argv[2];
for (const [name, qs] of [["A", "?look=weight&list=beside"], ["B", "?look=gray&list=beside"], ["C", "?look=open&list=beside"], ["A-totals-below", "?look=weight&list=aligned"], ["A-rule", "?look=weight&list=beside&band=rule"], ["B-rule", "?look=gray&list=beside&band=rule"], ["C-rule", "?look=open&list=beside&band=rule"], ["final", "?look=weight&list=full"]]) {
  if (only && !name.includes(only)) continue;
  const page = await browser.newPage({ viewport: { width: 1366, height: 3200 } });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.goto(base + qs, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-prod-card]", { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.getByText("Print preview", { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: join(dir, `${name}.pdf`), format: "Letter", printBackground: true, preferCSSPageSize: true });
  console.log("pdf", `${name}.pdf`);
  await page.close();
}
await browser.close();

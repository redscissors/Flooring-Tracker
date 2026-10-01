// On-screen Print preview proof (issue 163 follow-up): the preview card in
// SCREEN media beside the print PDF — the two should now match.
//   node .scratch/163_selection-sheet-grid-options/proof/screen.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const base = "http://localhost:5197/.scratch/163_selection-sheet-grid-options/proof/preview.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
for (const [name, qs] of [["screen-full", ""], ["screen-options", "?opts=1"]]) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 3200 } });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.goto(base + qs, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-prod-card]", { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.getByText("Print preview", { exact: true }).first().click();
  await page.waitForTimeout(1000);
  await page.locator(".ft-ink:not(.hidden)").first().screenshot({ path: join(dir, `${name}.png`) });
  console.log("shot", `${name}.png`);
  await page.close();
}
await browser.close();

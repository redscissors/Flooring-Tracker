// Owner 2026-09-27: no band width chosen = the narrowest width carried (5″),
// even under Full catalog with 7¼″/10″ rows in the book.
import { createRequire } from "module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
const errs = []; pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto("http://localhost:5199/schluter-preview.html"); await pg.waitForTimeout(800);
await pg.click("[data-source-toggle]"); await pg.waitForTimeout(300);
for (const tray of ["KSLT1395S", "KST1830"]) {
  const t = pg.locator(`[data-schluter-tray='${tray}']`);
  if (await t.count()) { await t.first().click(); await pg.waitForTimeout(400); }
  const seams = await pg.locator(".bline", { hasText: /KERDI-BAND|Kerdi-Band/ }).first().innerText().catch(() => "");
  console.log(tray, "band:", seams.replace(/\s+/g, " ").slice(0, 120));
  if (!/KEBA100\/125/.test(seams)) { console.log("FAIL: default band is not 5″"); process.exitCode = 1; }
}
await pg.screenshot({ path: "/home/user/Flooring-Tracker/.scratch/158_shower-config-roadmap/p1b/c4-band-default-5in.png" });
await b.close();
if (errs.length) { console.log("PAGEERROR", errs); process.exit(1); }

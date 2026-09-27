import { createRequire } from "module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
const errs = []; pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto("http://localhost:5199/schluter-preview.html"); await pg.waitForTimeout(800);
await pg.click("[data-source-toggle]"); await pg.waitForTimeout(300);
await pg.click("[data-schluter-tray='KSLT1395S']"); await pg.waitForTimeout(400);
await pg.locator("[data-schluter-swapb]").first().click(); await pg.waitForTimeout(300);
await pg.click('[data-drain-chip="Family:fixed"]'); await pg.waitForTimeout(300);
const fin = await pg.locator('[data-drain-chip^="Finish:"]').allInnerTexts();
console.log("finish chips:", fin.join(" | "));
await pg.screenshot({ path: "/home/user/Flooring-Tracker/.scratch/158_shower-config-roadmap/p1b/c3-finish-names.png" });
await b.close();
if (errs.length) { console.log("PAGEERROR", errs); process.exit(1); }

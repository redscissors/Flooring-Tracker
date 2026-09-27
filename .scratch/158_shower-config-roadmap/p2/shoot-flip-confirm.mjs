// Proof: the Building Panel switch over a customized S-DRY kit names what it
// clears (owner ask 2026-09-27).
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p2/shoot-flip-confirm.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p2";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-wallsys-membrane]").first().click(); await pg.waitForTimeout(600);
await pg.locator("[data-wedi-pan='US9176003']").click(); await pg.waitForTimeout(800);
await pg.locator(".stepper button").last().click(); await pg.waitForTimeout(400);
await pg.locator("[data-wedi-wallsys-board]").first().click(); await pg.waitForTimeout(600);
const t = await pg.locator("[data-kit-confirm]").innerText().catch(() => "");
console.log(t.replace(/\n+/g, " | "));
if (!/Switch to Building Panel\?/.test(t) || !/Keep my walls and extras/.test(t) || !/Start over/.test(t)) { console.error("FAIL: copy"); err = true; }
await pg.screenshot({ path: `${OUT}/f4-board-flip-confirm.png` });
await pg.locator("[data-kit-keep]").click(); await pg.waitForTimeout(800);
const on = await pg.locator("[data-wedi-wallsys-board]").first().getAttribute("class");
console.log("after keep, board seg class:", on);
await b.close();
console.log(err ? "FAILED" : "all checks passed");
process.exit(err ? 1 : 0);

// Before shots for Phase 2 (ticket 158) — run on the pre-change code, before
// Task 1: the wedi Kits tab + a Building Panel bill, the Schluter Kits tab's
// "KERDI over backer" segment, and Compare from the wedi host.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p2/shoot-before.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p2";
const PORT = process.env.PORT || 5199;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const toCompare = async () => { await pg.locator(".modetab", { hasText: "Compare" }).dispatchEvent("click"); await pg.waitForSelector(".cmp-grid [data-cmp-group]", { timeout: 20000 }); await pg.waitForTimeout(800); };

await pg.goto(`http://localhost:${PORT}/wedi-preview.html`);
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
await shot("before-wedi-kits");
await toCompare();
await shot("before-wedi-compare");

await pg.goto(`http://localhost:${PORT}/schluter-preview.html`);
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
await shot("before-schluter-kits");

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");

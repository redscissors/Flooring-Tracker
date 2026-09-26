// Preview proof for P0-6 — the Keim wedi sheet as a price update.
//   npx vite --port 5199
//   node .scratch/158_shower-config-roadmap/p0-6/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p0-6";
let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1280, height: 1100 } });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log("shot", name); };
await pg.goto("http://localhost:5199/import-preview.html?keim");
await pg.waitForSelector("[data-price-update]", { timeout: 20000 }); await wait(500);
await shot("1-keim-review");
const changed = pg.locator("button", { hasText: /changed/i }).first();
if (await changed.count()) { await changed.click(); await wait(400); }
const added = pg.locator("button", { hasText: /new/i }).first();
if (await added.count()) { await added.click(); await wait(400); }
await shot("2-keim-changed-added");
const apply = pg.locator("button", { hasText: /^(Apply|Import)/ }).last();
await apply.click(); await wait(500);
console.log(await pg.locator("[data-applied]").textContent().catch(() => "no applied line"));
await shot("3-keim-applied");
await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }

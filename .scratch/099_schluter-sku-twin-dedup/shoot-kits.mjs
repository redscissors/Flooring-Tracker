// Preview-proof rig for issue 099 (SKU-twin dedup): shoots the Schluter
// popup's Kits tab off the schluter-preview.html harness, which carries the
// live EFT book's re-lettered twin (SLRKST965810BF) of the stocked
// KST965/810BF tray.
//
//   npx vite --port 5199
//   node .scratch/099_schluter-sku-twin-dedup/shoot-kits.mjs <name>
//
// Shoot <name>=before with the dedup fix stashed (two 38"×32" rows), then
// <name>=after with it applied (one row, stock). The run prints every
// 38"×32" kit row it sees so the README can quote the counts.
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const OUT = ".scratch/099_schluter-sku-twin-dedup";
const name = process.argv[2] || "shot";
let hadPageError = false;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });

await pg.goto("http://localhost:5199/schluter-preview.html", { waitUntil: "load" });
await pg.waitForSelector("[data-schluter-pop]", { timeout: 20000 });
await pg.waitForSelector(".kitrow", { timeout: 20000 });
await pg.waitForTimeout(1200);

const rows = await pg.$$eval(".kitrow", (es) => es.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
const hits = rows.filter((r) => r.includes('38"×32"'));
console.log(`kit rows: ${rows.length}; 38"×32" rows: ${hits.length}`);
hits.forEach((r) => console.log("  ", r));

await pg.screenshot({ path: `${OUT}/${name}.png` });
console.log("shot", name);
await b.close();
if (hadPageError) { console.error("FAILED — page errors above"); process.exit(1); }

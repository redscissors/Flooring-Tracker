// Preview proof for P0-1 — linear tray drain side follows the SKU.
//   npx vite --port 5199
//   node .scratch/158_shower-config-roadmap/p0-1/shoot.mjs [prefix]
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const OUT = ".scratch/158_shower-config-roadmap/p0-1";
const PRE = process.argv[2] || "after";
let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 1 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${PRE}-${name}.png` }); console.log("shot", name); };

await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await wait(600);
if ((await pg.locator("[data-source-toggle]").getAttribute("aria-pressed")) === "true") { await pg.locator("[data-source-toggle]").click(); await wait(500); }
const lin = pg.locator("[data-schluter-tray*='KSLT']");
console.log("linear rows:", await lin.evaluateAll((els) => els.map((e) => e.getAttribute("data-schluter-tray") + " = " + e.textContent.replace(/\s+/g, " ").slice(0, 70))));
await lin.first().scrollIntoViewIfNeeded();
await pg.locator("[data-schluter-tray='KSLT965/1930S']").click();
await wait(700);
await shot("1-kit-965-1930");
const twin = pg.locator("[data-schluter-tray='SLRKSLT1930965S']");
if (await twin.count()) { await twin.click(); await wait(700); await shot("2-kit-1930-965"); }
await pg.locator('.modetab:has-text("Custom shower")').click();
await wait(500);
await pg.locator("[data-schluter-flip]").click();
await wait(800);
await shot("3-custom-after-rotate");
await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }

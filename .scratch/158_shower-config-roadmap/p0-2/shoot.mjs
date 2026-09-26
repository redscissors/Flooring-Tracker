// Preview proof for P0-2 — the fixed KERDI-LINE range in Browse.
//   npx vite --port 5199
//   node .scratch/158_shower-config-roadmap/p0-2/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const OUT = ".scratch/158_shower-config-roadmap/p0-2";
let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 1 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };

await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await wait(600);
if ((await pg.locator("[data-source-toggle]").getAttribute("aria-pressed")) === "true") { await pg.locator("[data-source-toggle]").click(); await wait(500); }
await pg.locator('.modetab:has-text("Browse")').click();
await wait(500);
await pg.locator('.fbopt:has-text("Channel bodies")').click();
await wait(500);
await shot("1-browse-channel-bodies");
await pg.locator('.fbopt:has-text("Covers & parts")').click();
await wait(500);
await shot("2-browse-covers-parts");
await pg.locator('.fbhead:has-text("KERDI-LINE")').click();
await wait(500);
await shot("3-browse-kerdi-line-all");
// a linear kit still bills Vario with the fixed range in the catalog
await pg.locator('.modetab:has-text("Kits")').click();
await wait(300);
await pg.locator("[data-schluter-tray='KSLT1395S']").click();
await wait(700);
await shot("4-linear-kit-still-vario");
await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }

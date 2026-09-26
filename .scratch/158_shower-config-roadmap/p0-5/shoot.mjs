// Preview proof for P0-5 — one bag of PRO-SET on every wedi pan kit.
//   npx vite --port 5199
//   node .scratch/158_shower-config-roadmap/p0-5/shoot.mjs [prefix]
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const OUT = ".scratch/158_shower-config-roadmap/p0-5";
const PRE = process.argv[2] || "after";
let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 1 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${PRE}-${name}.png` }); console.log("shot", name); };

await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 });
await wait(800);
await pg.locator("[data-wedi-pan]").first().click();
await wait(900);
await shot("1-kit-build");
await pg.locator('.modetab:has-text("Compare")').click();
await wait(1500);
await shot("2-compare");
await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }

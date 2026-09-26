// Preview proof for P0-3 + P0-4 — tighter Browse rows, coverage + $/sf.
//   npx vite --port 5199
//   node .scratch/158_shower-config-roadmap/p0-34/shoot.mjs [before|after]
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const OUT = ".scratch/158_shower-config-roadmap/p0-34";
const PRE = process.argv[2] || "after";
let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
const wait = (ms) => pg.waitForTimeout(ms);
const LEFT = { x: 40, y: 90, width: 620, height: 860 };
const shot = async (name, clip = LEFT) => { await pg.screenshot({ path: `${OUT}/${PRE}-${name}.png`, clip }); console.log("shot", name); };
const allSource = async () => {
  if ((await pg.locator("[data-source-toggle]").getAttribute("aria-pressed")) === "true") { await pg.locator("[data-source-toggle]").click(); await wait(400); }
};

await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await wait(600);
await allSource();
await pg.locator('.modetab:has-text("Browse")').click(); await wait(400);
await pg.locator('.fbopt:has-text("KERDI rolls")').click(); await wait(300);
await shot("1-schluter-rolls");
await pg.locator('.fbopt:has-text("Linear (LTS)")').click(); await wait(300);
await shot("2-schluter-lts-import");
await pg.locator('.fbhead:has-text("KERDI-LINE")').click(); await wait(300);
await shot("3-schluter-kerdi-line");
await pg.locator('.modetab:has-text("Kits")').click(); await wait(300);
await pg.locator("[data-schluter-tray='KST965/1525']").click(); await wait(700);
await shot("4-schluter-build-lines", { x: 560, y: 90, width: 640, height: 560 });

await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await wait(600);
await pg.locator('.modetab:has-text("Browse")').click(); await wait(400);
await shot("5-wedi-browse");
await pg.locator('.ft-hopt:has-text("Tapes")').click(); await wait(300);
await shot("6-wedi-tapes");
await pg.locator('.ft-hopt:has-text("Building panels")').click(); await wait(300);
await shot("7-wedi-panels");
await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }

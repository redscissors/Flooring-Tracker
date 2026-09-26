// Proof: Vario channel sized to the pan (55x55 LTS: 8' cut to 55", full-width drawing).
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/vario/shoot.mjs [before|after]
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const PRE = process.argv[2] || "after";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-schluter-tray='KSLT1395S']").click(); await pg.waitForTimeout(800);
await pg.screenshot({ path: `.scratch/158_shower-config-roadmap/vario/${PRE}-55x55-lts.png`, clip: { x: 560, y: 90, width: 1160, height: 560 } });
console.log("shot", PRE);
await b.close();
if (err) process.exit(1);

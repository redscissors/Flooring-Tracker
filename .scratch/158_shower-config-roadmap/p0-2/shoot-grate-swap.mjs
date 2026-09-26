// Proof: the point-drain grate ⇄ lists only point grates, never KERDI-LINE.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p0-2/shoot-grate-swap.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
if ((await pg.locator("[data-source-toggle]").getAttribute("aria-pressed")) === "true") { await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(400); }
await pg.locator("[data-schluter-tray='KST965/1525']").click(); await pg.waitForTimeout(700);
await pg.locator('[data-schluter-swapb="KD4GRKE"]').click();
await pg.waitForSelector("[data-schluter-swaprow]", { timeout: 5000 });
const rows = await pg.locator("[data-schluter-swaprow]").evaluateAll((els) => els.map((e) => e.getAttribute("data-schluter-swaprow")));
console.log("swap rows:", rows.join(", "));
await pg.screenshot({ path: ".scratch/158_shower-config-roadmap/p0-2/5-grate-swap-point-only.png", clip: { x: 560, y: 90, width: 700, height: 560 } });
await b.close();
if (err || rows.some((r) => /KL/.test(r))) { console.error("FAILED"); process.exit(1); }

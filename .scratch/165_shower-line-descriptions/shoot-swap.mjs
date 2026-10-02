// Proof for the review fix: a wedi swap/add summary names the part WITH its size.
//   npx vite --port 5199 ; node .scratch/165_shower-line-descriptions/shoot-swap.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
pg.on("pageerror", (e) => console.log("[pageerror]", e.message));
await pg.goto("http://localhost:5199/wedi-preview.html", { waitUntil: "networkidle" });
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
await pg.locator('[data-add-group="Walls"]').click(); await pg.waitForSelector("[data-add-pop]", { timeout: 5000 }); await pg.waitForTimeout(300);
const txt = (await pg.locator("[data-add-pop]").innerText()).replace(/\n+/g, " | ");
console.log("panel + summary:", txt.slice(0, 400));
const box = await pg.locator("[data-add-pop]").boundingBox();
await pg.screenshot({ path: join(dir, "popup-swap-summary.png"), clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 } });
console.log("shot popup-swap-summary.png");
await b.close();

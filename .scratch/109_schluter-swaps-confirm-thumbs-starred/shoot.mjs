// Preview-proof rig for round 9 — the last four ledger items: ⇄ line swaps
// (grate/curb/board), the kit-overwrite confirm, option-card thumbnails, and
// the ★ starred browse filter.
//
//   npx vite --port 5199
//   node .scratch/109_schluter-swaps-confirm-thumbs-starred/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { mkdirSync } from "node:fs";

const OUT = ".scratch/109_schluter-swaps-confirm-thumbs-starred";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5199/schluter-preview.html";

let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
pg.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200)); });

const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };

await pg.goto(URL);
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await wait(600);

// p1 — option cards wear mini plan thumbnails (the wedi card idiom).
await pg.locator('.modetab:has-text("Custom shower")').click();
await wait(700);
await shot("p1-optcard-thumbnails");

// p2 — the grate line's ⇄ opens the finish picker; pick the floral grate.
const grateSwap = pg.locator('[data-schluter-swapb="KD4GRKE"]');
await grateSwap.click();
await pg.waitForSelector("[data-schluter-swaprow]", { timeout: 5000 });
await shot("p2-grate-swap-popover");
await pg.locator('[data-schluter-swaprow="KD4GRKEF"]').click().catch(async () => {
  // fixture's alternate grate sku may differ — pick the second row
  const rows = pg.locator("[data-schluter-swaprow]");
  await rows.nth(1).click();
});
await wait(600);
await shot("p3-grate-swapped");

// p4 — a kit row over the customized build asks before wiping it.
await pg.locator('.modetab:has-text("Kits")').click();
await wait(300);
await pg.locator('[data-schluter-tray="KST1525"]').click();
await pg.waitForSelector("[data-schluter-overwrite]", { timeout: 5000 });
await shot("p4-overwrite-confirm");
await pg.keyboard.press("Escape");
await wait(300);

// p5 — Browse: star two rows, the ★ filter shows just them.
await pg.locator('.modetab:has-text("Browse")').click();
await wait(400);
const stars = pg.locator("[data-schluter-star]");
await stars.nth(0).click();
await stars.nth(2).click();
await pg.locator("[data-schluter-starfilter]").click();
await wait(400);
await shot("p5-starred-filter");

await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }
console.log("done");

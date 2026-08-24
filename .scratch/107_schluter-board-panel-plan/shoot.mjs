// Preview-proof rig for round 7 — the KERDI-BOARD panel plan (the wedi Fit
// planner over the live board range): level courses, mixed sheet sizes,
// walls stood vertical where it kills the seams, per-sheet bill lines, the
// Fit | One size seg, and the plan's courses drawn in both views.
//
//   npx vite --port 5199
//   node .scratch/107_schluter-board-panel-plan/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { mkdirSync } from "node:fs";

const OUT = ".scratch/107_schluter-board-panel-plan";
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

// board walls + the 60×38 kit
await pg.locator("[data-schluter-kits-board]").click();
await wait(500);
await pg.locator('[data-schluter-tray="KST965/1525"]').click();
await wait(700);

// p1 — the Fit plan: per-sheet lines (48×64 courses on the back, 48×96 stood
// vertical on the sides), the seam note, the Fit | One size seg, the plan's
// courses drawn — a level course line on the back face, seamless sides.
await shot("p1-fit-plan-default");

// p2 — One size: back to the single by-area line (largest sheet × area÷sf).
await pg.locator("[data-schluter-onesize]").click();
await wait(600);
await shot("p2-one-size-by-area");
await pg.locator("[data-schluter-fit]").click();
await wait(400);

// p3 — a 130"-wide room mixes sheet lengths: each 48" course on the back is
// one 96 + one 64 cut to 34 (a butt joint at 96"), and the note counts the
// vertical seams.
await pg.locator('.modetab:has-text("Custom shower")').click();
await wait(400);
await pg.locator("[data-schluter-w]").fill("130");
await pg.keyboard.press("Enter");
await wait(800);
await shot("p3-mixed-sheets-130");

await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }
console.log("done");

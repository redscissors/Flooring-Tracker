// Preview-proof rig for the Schluter round-4 owner asks (2026-08-24): the
// benches join the build column's Add-ons behind ONE "+ Bench" dropdown chip
// (picker: 2" build-up wall/corner, framed, the premade SB list; a pick lands
// on the next open zone), and every build line takes a wedi-style qty stepper
// so quantities adjust up and down by hand.
//
//   npx vite --port 5199
//   node .scratch/102_schluter-bench-chip-build-steppers/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { mkdirSync } from "node:fs";

const OUT = ".scratch/102_schluter-bench-chip-build-steppers";
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

// build a kit so the build column fills
await pg.locator('[data-schluter-tray="KST965/1525"]').click();
await wait(600);

// p1 — the Add-ons group leads with ONE "+ Bench" chip; its picker holds
// every form (build-up wall/corner, framed) plus the premade SB list and the
// KERS-B seal kits as accessory toggles — the standalone corner-kit chip is
// gone.
await pg.locator("[data-schluter-benchchip]").click();
await pg.waitForSelector("[data-schluter-picker]", { timeout: 5000 });
await pg.locator("[data-schluter-picker]").evaluate((el) => el.scrollTo(0, el.scrollHeight));
await wait(200);
await shot("p1-bench-chip-picker");

// p2 — a premade pick lands on the next open wall zone: the chip reads ✓,
// the bill carries the bench line, the drawing draws it on the back wall.
const pre = pg.locator("[data-schluter-benchpick]").first();
await pre.click();
await wait(700);
await shot("p2-premade-added");

// p3 — a second pick (2" build-up) lands on the NEXT open zone (left wall);
// the picker lists both standing benches with click-to-remove.
await pg.locator("[data-schluter-benchpick-site]").click();
await wait(700);
await shot("p3-two-benches-picker-rows");
await pg.keyboard.press("Escape");
await wait(300);

// p4 — build-line steppers: step the KERDI band up twice and ALL-SET down
// once — hand-set quantities read rust with the recipe's figure in the title,
// and the totals/meter follow.
const stepOf = (rowText) => pg.locator(".bline", { hasText: rowText }).first().locator(".stepper");
await stepOf("KERDI-BAND").locator("button").last().click();
await wait(150);
await stepOf("KERDI-BAND").locator("button").last().click();
await wait(150);
await stepOf("ALL-SET").locator("button").first().click();
await wait(500);
await shot("p4-steppers-overrides");

// p5 — stepped to 0 the line leaves the bill (the wedi rule): drop the seal
// pack line entirely.
const seals = pg.locator(".bline", { hasText: "KERDI-SEAL" }).first();
if (await seals.count()) {
  await seals.locator(".stepper button").first().click();
  await wait(400);
}
await shot("p5-line-stepped-out");

await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }
console.log("done");

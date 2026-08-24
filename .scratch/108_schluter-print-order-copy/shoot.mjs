// Preview-proof rig for round 8 — the print layout (both drawings + cut list
// + materials table, the wedi sheet) and Copy for order entry.
//
//   npx vite --port 5199
//   node .scratch/108_schluter-print-order-copy/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { mkdirSync } from "node:fs";

const OUT = ".scratch/108_schluter-print-order-copy";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5199/schluter-preview.html";

let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2, permissions: ["clipboard-read", "clipboard-write"] });
const pg = await ctx.newPage();
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
pg.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200)); });

const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log("shot", name); };

await pg.goto(URL);
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await wait(600);

// a rich build: board walls, the 60×38 kit, one cut corner for cut-list rows
await pg.locator("[data-schluter-kits-board]").click();
await wait(400);
await pg.locator('[data-schluter-tray="KST965/1525"]').click();
await wait(700);
await pg.locator('.modetab:has-text("Custom shower")').click();
await wait(300);
await pg.locator("[data-schluter-cutcorners]").click();
await wait(600);

// p1 — Order entry: the copy toast, and the clipboard's actual contents
// echoed below for the record.
await pg.locator("[data-schluter-copy]").click();
await wait(500);
await shot("p1-order-entry-copied");
const clip = await pg.evaluate(() => navigator.clipboard.readText());
console.log("CLIPBOARD >>>\n" + clip + "\n<<<");

// p2 — the print layout sheet, exactly what the printer gets.
await pg.locator("[data-schluter-print]").click();
await wait(400);
await pg.emulateMedia({ media: "print" });
await wait(300);
await shot("p2-print-sheet");
await pg.emulateMedia({ media: "screen" });

await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }
console.log("done");

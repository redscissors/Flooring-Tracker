// Round-2 proof (the owner's follow-up screenshot): Any drain preference,
// Max — curb inside + tile thickness, editable wall lengths + default height,
// the room flip, and 45° corner cuts.
//   npx vite --port 5199
//   node .scratch/100_schluter-wedi-parity/shoot2.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const OUT = ".scratch/100_schluter-wedi-parity";
const URL = "http://localhost:5199/schluter-preview.html";
let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
pg.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200)); });
const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (n) => { await pg.screenshot({ path: `${OUT}/${n}.png` }); console.log("shot", n); };

await pg.goto(URL);
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await wait(500);

// p5 — the round-2 form: Any preference (a linear tray competes and the
// build bills off the pick), Max — curb inside with 3/8" tile (48x66 stated
// -> the tray gives up 4 7/8" of depth), a typed wall length, default height.
await pg.locator("[data-schluter-w]").fill("48");
await pg.locator("[data-schluter-d]").fill("66");
await wait(300);
await pg.locator("[data-schluter-any]").click();
await wait(300);
await pg.locator("[data-schluter-max]").click();
await wait(300);
await pg.locator("[data-schluter-tile]").fill("3/8");
await wait(700);
const sub = await pg.$eval(".bc-h .sub", (e) => e.textContent);
if (!/max inside/.test(sub)) throw new Error("max-inside missing from build facts: " + sub);
console.log("build facts:", sub);
await shot("p5-any-max-tile");

// p6 — corner cuts: cut the open front corners on a 60x38 curbed point room.
// The tray chamfers 12x12 at 45deg in both drawings, the curb turns the cut
// corners diagonally, and the bill's curb grows to cover the diagonals.
await pg.locator("[data-schluter-w]").fill("60");
await pg.locator("[data-schluter-d]").fill("66");
await pg.locator("[data-schluter-d]").fill("38");
await wait(300);
await pg.locator('.rseg button:has-text("Tray size")').click();
await pg.locator('.rseg button:has-text("Point · centre")').click();
await wait(500);
await pg.locator("[data-schluter-cutcorners]").click();
await wait(700);
const cuts = await pg.$$eval(".warnrow", (es) => es.map((e) => e.textContent));
if (!cuts.some((t) => /Corner cut at front left/.test(t))) throw new Error("front-left corner cut missing from cut list: " + cuts.join(" | "));
const curbNote = await pg.$$eval(".bline .bn .m", (es) => es.map((e) => e.textContent).find((t) => /diagonal/.test(t)));
if (!curbNote) throw new Error("curb diagonal note missing");
console.log("curb:", curbNote);
await shot("p6-corner-cuts");

// p7 — flip: 60x38 -> 38x60, drain pin follows; wall rows re-auto.
await pg.locator("[data-schluter-dx]").fill("20");
await wait(400);
await pg.locator("[data-schluter-flip]").click();
await wait(700);
const dy = await pg.$eval("[data-schluter-dy]", (e) => e.value);
if (dy !== "20") throw new Error("flip did not carry the pin: dy=" + dy);
await shot("p7-flip");

await b.close();
if (hadPageError) { console.error("FAILED: page errors"); process.exit(1); }
console.log("done");

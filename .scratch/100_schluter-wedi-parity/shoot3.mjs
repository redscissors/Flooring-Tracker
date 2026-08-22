// Round-3 proof: the drain pin's measurement DATUM (owner, 2026-08-22) —
// "if a builder gives me the measurements based off of the right side for
// the drain, I don't wanna have to figure the difference from the left."
//   npx vite --port 5199
//   node .scratch/100_schluter-wedi-parity/shoot3.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const OUT = ".scratch/100_schluter-wedi-parity";
const URL = "http://localhost:5199/schluter-preview.html";
let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
const wait = (ms) => pg.waitForTimeout(ms);

await pg.goto(URL);
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await wait(500);

// 50x38 room, builder says the drain is 20" off the RIGHT wall -> the
// engine must pin 30" from the left, no hand subtraction.
await pg.locator("[data-schluter-w]").fill("50");
await wait(300);
await pg.locator("[data-schluter-dref]").click();
await wait(200);
await pg.locator("[data-schluter-dx]").fill("20");
await wait(700);
const drain = await pg.$eval(".diagcol svg text >> nth=-1", () => null).catch(() => null);
const texts = await pg.$$eval(".diagcol svg text", (es) => es.map((e) => e.textContent));
const callout = texts.find((t) => /point drain @/.test(t));
if (!/@ 30"/.test(callout || "")) throw new Error("right-ref pin did not land 30 from left: " + callout);
const cuts = await pg.$$eval(".warnrow", (es) => es.map((e) => e.textContent));
const echo = cuts.find((t) => /off the RIGHT wall/.test(t));
if (!echo) throw new Error("right-ref echo line missing: " + cuts.join(" | "));
console.log("callout:", callout);
console.log("echo:", echo);
await pg.screenshot({ path: `${OUT}/p8-drain-from-right.png` });
console.log("shot p8-drain-from-right");

// flip converts back to from-left before rotating and resets the datum
await pg.locator("[data-schluter-flip]").click();
await wait(600);
const dy = await pg.$eval("[data-schluter-dy]", (e) => e.value);
if (dy !== "30") throw new Error("flip did not convert the right-ref pin: dy=" + dy);
console.log("flip dy:", dy);

await b.close();
if (hadPageError) { console.error("FAILED: page errors"); process.exit(1); }
console.log("done");

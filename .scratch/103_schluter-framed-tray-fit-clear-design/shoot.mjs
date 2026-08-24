// Preview-proof rig for the Schluter round-5 owner asks (2026-08-24): a
// framed bench keeps the tray as picked (the "Cut it down | Smaller tray"
// seg — the wedi panFit fork), "Smaller tray" re-ranks the clear space with
// the drain chasing its centre unless pinned, adding a bench bumps onto the
// Custom shower tab, and "Clear design" joins the pop-head.
//
//   npx vite --port 5199
//   node .scratch/103_schluter-framed-tray-fit-clear-design/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { mkdirSync } from "node:fs";

const OUT = ".scratch/103_schluter-framed-tray-fit-clear-design";
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

// build the 38"×5' kit, then add a FRAMED bench from the Bench chip
await pg.locator('[data-schluter-tray="KST965/1525"]').click();
await wait(600);
await pg.locator("[data-schluter-benchchip]").click();
await pg.waitForSelector("[data-schluter-picker]", { timeout: 5000 });
await pg.locator("[data-schluter-benchpick-framed]").click();
await wait(700);
await pg.keyboard.press("Escape");
await wait(300);

// p1 — the bench add BUMPED the popup onto the Custom shower tab, and the
// tray stayed the picked 60×38 (cut at the bench face) — the option cards
// still rank the full room; the header now carries "Clear design".
await shot("p1-framed-bench-custom-tab-tray-kept");

// p2 — the bench's zone menu: the new "Cut it down | Smaller tray" seg, with
// the kept-tray note.
const svg = pg.locator(".diagcol svg").first();
const box = await svg.boundingBox();
const geo = await pg.evaluate(() => {
  const el = document.querySelector(".diagcol svg");
  const [, , vw, vh] = el.getAttribute("viewBox").split(" ").map(Number);
  const r = el.querySelector("rect");
  return { vw, vh, x: +r.getAttribute("x"), y: +r.getAttribute("y"), w: +r.getAttribute("width"), h: +r.getAttribute("height") };
});
const planPt = async (rx, ry) => {
  const px = box.x + ((geo.x + geo.w * rx) / geo.vw) * box.width;
  const py = box.y + ((geo.y + geo.h * ry) / geo.vh) * box.height;
  await pg.mouse.move(px, py); await wait(150);
  await pg.mouse.click(px, py); await wait(400);
};
await planPt(0.5, 0.12);
await pg.waitForSelector("[data-schluter-trayfit-cut]", { timeout: 5000 });
await shot("p2-trayfit-seg-cut-default");

// p3 — flip to "Smaller tray": the options re-rank for the clear space and
// the card says the drain lands centred in it.
await pg.locator("[data-schluter-trayfit-smaller]").click();
await wait(700);
await shot("p3-smaller-tray-recentred");

// p4 — Clear design wipes the whole build back to the empty default.
await pg.keyboard.press("Escape");
await wait(300);
await pg.locator("[data-schluter-clear]").click();
await wait(600);
await shot("p4-clear-design");

await b.close();
if (hadPageError) { console.error("FAILED — page errors"); process.exit(1); }
console.log("done");

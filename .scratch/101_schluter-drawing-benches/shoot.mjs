// Preview-proof rig for the Schluter wedi-parity round 3 (owner feedback
// 2026-08-22): add-on chips open pickers instead of one chip per catalog
// variant, benches move onto the DRAWING (zone hover + bench menu — premade /
// 2" build-up / framed with the tray stopping at its face), and wall bands
// take a right-click size menu like wedi's.
//
//   npx vite --port 5199
//   node .scratch/101_schluter-drawing-benches/shoot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { mkdirSync } from "node:fs";

const OUT = ".scratch/101_schluter-drawing-benches";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:5199/schluter-preview.html";

let hadPageError = false;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); hadPageError = true; });
pg.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200)); });

const wait = (ms) => pg.waitForTimeout(ms);
const shot = async (name) => { await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const tab = async (label) => { await pg.locator(".modetab", { hasText: label }).click(); await wait(400); };

// click/right-click a point in ROOM coords on the plan drawing (topmost svg in
// the rail) — mirrors showerdraw's own viewBox → room math backwards
const planPt = async (rx, ry, opts) => {
  const svg = pg.locator(".diagcol svg").first();
  const box = await svg.boundingBox();
  const geo = await pg.evaluate(() => {
    const el = document.querySelector(".diagcol svg");
    const [, , vw, vh] = el.getAttribute("viewBox").split(" ").map(Number);
    return { vw, vh };
  });
  // topGeom: find the drawn room rect (the PAPER floor) to map room → viewBox
  const floor = await pg.evaluate(() => {
    const el = document.querySelector(".diagcol svg rect");
    return { x: +el.getAttribute("x"), y: +el.getAttribute("y"), w: +el.getAttribute("width"), h: +el.getAttribute("height") };
  });
  const px = box.x + ((floor.x + floor.w * rx) / geo.vw) * box.width;
  const py = box.y + ((floor.y + floor.h * ry) / geo.vh) * box.height;
  await pg.mouse.move(px, py);
  await wait(150);
  if (opts && opts.right) await pg.mouse.click(px, py, { button: "right" });
  else await pg.mouse.click(px, py);
  await wait(350);
};

await pg.goto(URL);
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await wait(600);

// build a kit so the drawings render
await pg.locator('[data-schluter-tray="KST965/1525"]').click();
await wait(600);

// p1 — the reworked Add-ons group: one Niche chip (not five), the bench hint,
// and the niche PICKER open with every SN/SNLT variant, stock-tinted.
await pg.locator("[data-schluter-nichechip]").click();
await pg.waitForSelector("[data-schluter-picker]", { timeout: 5000 });
await pg.locator('[data-schluter-pick="KB12SN305508A1"]').click();
await wait(300);
await shot("p1-niche-picker");
await pg.keyboard.press("Escape");
await wait(300);

// p2 — hover the tray along the back wall: the bench ZONE previews, a click
// opens the bench menu with 2" build-up / framed / the premade SB list.
await planPt(0.5, 0.15);
await pg.waitForSelector("[data-schluter-benchmenu]", { timeout: 5000 });
await shot("p2-bench-menu");

// p3 — framed bench: the tray piece stops at the bench face (offset piece,
// dashes at the cut), the build column carries the ½" wrap line, the cut
// list says the tray's landed size.
await pg.locator("[data-schluter-bench-framed]").click();
await wait(600);
await shot("p3-framed-bench-drawn");

// p4 — reopen the zone: the menu now edits the bench (size fields, build
// seg, Remove); flip it to 2" build-up to show the tray runs full again.
await planPt(0.5, 0.1);
await pg.waitForSelector("[data-schluter-benchmenu]", { timeout: 5000 });
await shot("p4-bench-edit-menu");
await pg.locator("[data-schluter-benchmenu] .pfseg button", { hasText: "2″ build-up" }).click();
await wait(500);
await pg.keyboard.press("Escape");
await wait(300);

// p5 — a corner zone takes the premade triangular SB bench (past the tight
// 10" corner-cut radius, inside the 15" corner box: 12",25" on a 60×38 room)
await planPt(0.2, 0.66);
await pg.waitForSelector("[data-schluter-benchmenu]", { timeout: 5000 });
await pg.locator('[data-schluter-bench-pre="KBSB410TA"]').click();
await wait(600);
await shot("p5-corner-premade");

// p6 — right-click the back wall band: the wall menu (size × height, turn
// off) — the wedi idiom on the Schluter drawing.
await planPt(0.5, -0.03, { right: true });
await pg.waitForSelector("[data-schluter-wallmenu]", { timeout: 5000 });
await shot("p6-wall-menu");
await pg.keyboard.press("Escape");
await wait(300);

if (hadPageError) { console.error("page errors — see above"); process.exit(1); }
await b.close();
console.log("done");

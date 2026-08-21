// Parity rig for the WediConfigurator drawing extraction (issue 098).
// Shoots the drawings rail (.diagcol) for six scenarios that exercise the
// plan + isometric renderer: a kit pan, a deep-cut custom pan, benches (a
// site-built wall bench + a corner bench), a corner cut, a linear module,
// and a curbless pan. Each scenario starts from a fresh page load so one
// scenario's state never leaks into the next (curb-vs-size ordering matters
// to the solver — see the task report).
//
//   node .scratch/098_shower-drawing-extraction/shoot-parity.mjs <label>
//
// writes .scratch/098_shower-drawing-extraction/<label>/*.png (six PNGs) and
// .scratch/098_shower-drawing-extraction/<label>.sha256 (their hashes).
//
// Every shot() waits on a settle guard (both rail SVGs present and non-empty)
// before capturing, so a still-settling frame or a blank/half-rendered rail
// fails loudly instead of producing a silent, spurious diff.
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const label = process.argv[2];
if (!label) { console.error("usage: node shoot-parity.mjs <label>"); process.exit(1); }
const OUT = `.scratch/098_shower-drawing-extraction/${label}`;
mkdirSync(OUT, { recursive: true });

const URL = "http://localhost:5199/wedi-preview.html";
let hadPageError = false;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("pageerror", e); hadPageError = true; });

const fresh = async () => {
  await pg.goto(URL, { waitUntil: "load" });
  await pg.waitForTimeout(1400);
};
const custom = async () => {
  await pg.locator(".modetab", { hasText: "Custom shower" }).click();
  await pg.waitForTimeout(400);
};
// .rf field blocks are matched by the start of their label text — hasText's
// default substring match is case-insensitive, and "Curb" would otherwise
// also match the "Sizes are ... Max — curb inside" field.
const rf = (labelStart) => pg.locator(".rf").filter({ hasText: new RegExp("^" + labelStart) });
const field = (labelStart) => rf(labelStart).locator("input");
const setNum = async (labelStart, i, v) => {
  const el = field(labelStart).nth(i);
  await el.fill(String(v));
  await el.press("Enter");
  await pg.waitForTimeout(350);
};
// A fractional point on the pan rect (fill #DCE5CD) in the plan SVG, mapped
// to a client (mouse) coordinate — the same recipe .scratch/079's
// repro-bench.mjs / shoot-flow.mjs use to drive clicks on the drawing itself.
const at = (fx, fy) => pg.evaluate(([px, py]) => {
  const svg = document.querySelector(".diagcol svg");
  const pan = [...svg.querySelectorAll("rect")].find((e) => e.getAttribute("fill") === "#DCE5CD");
  const r = svg.getBoundingClientRect(), k = r.width / svg.viewBox.baseVal.width;
  return [r.left + (+pan.getAttribute("x") + +pan.getAttribute("width") * px) * k,
    r.top + (+pan.getAttribute("y") + +pan.getAttribute("height") * py) * k];
}, [fx, fy]);
const addBenchAt = async (fx, fy) => {
  const [bx, by] = await at(fx, fy);
  await pg.mouse.move(bx, by);
  await pg.waitForTimeout(300);
  await pg.mouse.click(bx, by);
  await pg.waitForTimeout(400);
  await pg.locator(".wedi-benchmenu .bm-opt").first().click();
  await pg.waitForTimeout(600);
  // adding a bench leaves its edit card open over the drawing — close it
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(300);
};
// Settle guard: both rail SVGs (plan + isometric) present and non-empty,
// then one short paint-settle margin. Every scenario renders exactly two
// SVGs in .diagcol (TopDown + Iso) once a diagram exists, so the predicate
// is the same across all six — see WediConfigurator.jsx's diagRail.
const settle = () => pg.waitForFunction(
  () => document.querySelectorAll(".diagcol svg").length >= 2
    && Array.from(document.querySelectorAll(".diagcol svg")).every((s) => s.childElementCount > 0),
  null, { timeout: 8000 },
).then(() => pg.waitForTimeout(250));
const shot = async (name) => {
  await settle();
  await pg.locator(".diagcol").screenshot({ path: `${OUT}/${name}.png` });
};

// 1. kit-48x60 — Kits tab, the 4' × 5' pan row.
await fresh();
await pg.locator(".pancard", { hasText: "48 × 60" }).first().click();
await pg.waitForTimeout(600);
await shot("kit-48x60");

// 2. custom-58x33-cut — 58 × 33, offset drain forcing the deep-cut cards.
await fresh();
await custom();
await setNum("Shower size", 0, 58);
await setNum("Shower size", 1, 33);
await rf("Preference").locator("button", { hasText: "Offset" }).click();
await pg.waitForTimeout(300);
await setNum("Drain — from left", 0, 6);
await setNum("Drain — from left", 1, 16.5);
await pg.waitForTimeout(700);
await shot("custom-58x33-cut");

// 3. benches-mix — 48 × 60, a site-built bench on the left wall plus a
// corner bench at back-right.
await fresh();
await custom();
await setNum("Shower size", 0, 48);
await setNum("Shower size", 1, 60);
await pg.waitForTimeout(700);
await addBenchAt(0.05, 0.5);   // left wall, mid-run
await addBenchAt(0.85, 0.15);  // back-right corner
await shot("benches-mix");

// 4. corner-cut — 48 × 60, click the front-left corner on the plan to toggle
// a corner cut (open corner — not boxed in by walls on both sides).
await fresh();
await custom();
await setNum("Shower size", 0, 48);
await setNum("Shower size", 1, 60);
await pg.waitForTimeout(700);
const [cx, cy] = await at(0.01, 0.99);
await pg.mouse.click(cx, cy);
await pg.waitForTimeout(700);
await shot("corner-cut");

// 5. linear-module — 36 × 72, linear drain preference.
await fresh();
await custom();
await setNum("Shower size", 0, 36);
await setNum("Shower size", 1, 72);
await pg.waitForTimeout(500);
await rf("Preference").locator("button", { hasText: "Linear" }).click();
await pg.waitForTimeout(700);
await shot("linear-module");

// 6. curbless — 42 × 42. Curbless must be picked BEFORE the size — with it
// set only after, this solver run occasionally reused a now-invalid drain
// position and rendered nothing (0 SVGs in the rail); curb-then-size is the
// deterministic order.
await fresh();
await custom();
await rf("Curb").locator("button", { hasText: "Curbless" }).click();
await pg.waitForTimeout(400);
await setNum("Shower size", 0, 42);
await setNum("Shower size", 1, 42);
await pg.waitForTimeout(700);
await shot("curbless");

await b.close();

if (hadPageError) process.exitCode = 1;

const files = ["kit-48x60", "custom-58x33-cut", "benches-mix", "corner-cut", "linear-module", "curbless"];
writeFileSync(`.scratch/098_shower-drawing-extraction/${label}.sha256`,
  files.map((f) => createHash("sha256").update(readFileSync(`${OUT}/${f}.png`)).digest("hex") + "  " + f).join("\n") + "\n");

console.log("wrote", files.length, "PNGs to", OUT, "· pageerror:", hadPageError);

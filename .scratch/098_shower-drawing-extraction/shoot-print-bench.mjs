// Print-sheet + premade-bench parity rig (issue 098, fix 1).
//
// The .diagcol parity rig (shoot-parity.mjs) never exercises two things the
// drawing extraction also touches: the print-layout surface (WediConfigurator
// renders TopDown/Iso a SECOND time inside .ps-diags, ~line 2247) and a
// PREMADE bench (the itemFn(b.part) rewrite only fires when b.build ===
// "premade" — a site/framed bench never touches that path). This shoots
// both, together: a stocked kit + a premade wall bench, print layout open.
//
//   node .scratch/098_shower-drawing-extraction/shoot-print-bench.mjs <port> <label>
//
// writes .scratch/098_shower-drawing-extraction/print-bench-<label>.png and
// appends/updates that label's line in .../print-bench.sha256 (so running
// once per label — before, then after — builds up a two-line file).
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const port = process.argv[2];
const label = process.argv[3];
if (!port || !label) { console.error("usage: node shoot-print-bench.mjs <port> <label>"); process.exit(1); }

const OUT = ".scratch/098_shower-drawing-extraction";
const URL = `http://localhost:${port}/wedi-preview.html`;
let hadPageError = false;

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => { console.error("pageerror", e); hadPageError = true; });

// Same fractional-point-on-the-pan-rect recipe as shoot-parity.mjs, mapping a
// point in the plan SVG's viewBox space to a client (mouse) coordinate.
const at = (fx, fy) => pg.evaluate(([px, py]) => {
  const svg = document.querySelector(".diagcol svg");
  const pan = [...svg.querySelectorAll("rect")].find((e) => e.getAttribute("fill") === "#DCE5CD");
  const r = svg.getBoundingClientRect(), k = r.width / svg.viewBox.baseVal.width;
  return [r.left + (+pan.getAttribute("x") + +pan.getAttribute("width") * px) * k,
    r.top + (+pan.getAttribute("y") + +pan.getAttribute("height") * py) * k];
}, [fx, fy]);

// Rail settle guard, same predicate as shoot-parity.mjs.
const settleRail = () => pg.waitForFunction(
  () => document.querySelectorAll(".diagcol svg").length >= 2
    && Array.from(document.querySelectorAll(".diagcol svg")).every((s) => s.childElementCount > 0),
  null, { timeout: 8000 },
).then(() => pg.waitForTimeout(250));

// Print-sheet settle guard: same shape, targeting .ps-diags instead of
// .diagcol — the print sheet renders its own TopDown + Iso pair.
const settlePrint = () => pg.waitForFunction(
  () => document.querySelectorAll(".ps-diags svg").length >= 2
    && Array.from(document.querySelectorAll(".ps-diags svg")).every((s) => s.childElementCount > 0),
  null, { timeout: 8000 },
).then(() => pg.waitForTimeout(250));

await pg.goto(URL, { waitUntil: "load" });
await pg.waitForTimeout(1400);

// 1. Kits tab (default), 4' x 5' stocked pan.
await pg.locator(".pancard", { hasText: "48 × 60" }).first().click();
await pg.waitForTimeout(700);
await settleRail();

// 2. Open the bench menu on the left wall, mid-run, and pick a PREMADE
// bench (the first "Premade wedi benches" row — a named part like
// US3000001/US3000002, not the site "wedi 2\" build-up" bm-opt).
const [bx, by] = await at(0.05, 0.5);
await pg.mouse.move(bx, by);
await pg.waitForTimeout(300);
await pg.mouse.click(bx, by);
await pg.waitForTimeout(400);
await pg.locator(".wedi-benchmenu .srow").first().click();
await pg.waitForTimeout(600);
await pg.keyboard.press("Escape");
await pg.waitForTimeout(300);
await settleRail();

// 3. Open the print layout surface and shoot .ps-diags. PRINT_CSS keeps
// .wedi-printsheet display:none outside @media print, so emulate print
// media before it lays out (same recipe as .scratch/077's shoot.mjs).
const printBtn = pg.locator("button", { hasText: "Print layout" });
if (!(await printBtn.count()) || !(await printBtn.first().isEnabled())) {
  console.error("Print layout button missing or disabled — no diag/build to print");
  await b.close();
  process.exit(1);
}
await printBtn.first().click();
await pg.waitForTimeout(900);
await pg.emulateMedia({ media: "print" });
await settlePrint();

const pngPath = `${OUT}/print-bench-${label}.png`;
await pg.locator(".ps-diags").screenshot({ path: pngPath });

await pg.emulateMedia({ media: "screen" });
await b.close();

if (hadPageError) process.exitCode = 1;

const hash = createHash("sha256").update(readFileSync(pngPath)).digest("hex");
const shaPath = `${OUT}/print-bench.sha256`;
const fname = `print-bench-${label}.png`;
let lines = existsSync(shaPath)
  ? readFileSync(shaPath, "utf8").split("\n").filter(Boolean).filter((l) => l.split(/\s+/).pop() !== fname)
  : [];
lines.push(`${hash}  ${fname}`);
writeFileSync(shaPath, lines.join("\n") + "\n");

console.log("wrote", pngPath, "· sha256", hash, "· pageerror:", hadPageError);

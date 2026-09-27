// Proof: Compare follows the host's wall system (ticket 158 Phase 2, ADR
// 0051) — wedi Membrane (S-DRY) faces Schluter KERDI membrane, wedi Building
// Panel faces KERDI-BOARD, and the Schluter host (now "Membrane | KERDI-BOARD")
// the other way round; a linear room the S-DRY fit can't take puts the wedi
// column on a wedi pan with S-DRY walls, and the header says so.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p2/shoot-compare.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p2";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const toCompare = async () => { await pg.locator(".modetab", { hasText: "Compare" }).dispatchEvent("click"); await pg.waitForSelector(".cmp-grid [data-cmp-group]", { timeout: 20000 }); await pg.waitForTimeout(800); };
const toTab = async (t) => { await pg.locator(".modetab", { hasText: t }).dispatchEvent("click"); await pg.waitForTimeout(500); };
const sys = async () => ({
  wedi: (await pg.locator('[data-cmp-sys="wedi"]').innerText()).replace(/\s+/g, " "),
  sch: (await pg.locator('[data-cmp-sys="schluter"]').innerText()).replace(/\s+/g, " "),
});
const flatRow = (t) => t.replace(/\s+/g, " ");
const slots = async () => pg.locator(".cmp-grid [data-cmp-slot]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cmp-slot")));

// --- wedi host, Membrane ---
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-wallsys-membrane]").first().click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-pan='US9176001']").click(); await pg.waitForTimeout(800);
await toCompare();
let h = await sys(); console.log("wedi Membrane host:", h);
if (!/S-DRY membrane/.test(h.wedi) || !/KERDI membrane/.test(h.sch)) fail("wedi Membrane does not face KERDI membrane");
const wb = flatRow(await pg.locator('.cmp-grid [data-cmp-slot="wallBoard"] ~ *').first().innerText().catch(() => ""));
if (!/by others/.test(wb)) fail("the wedi column lacks the backer note row");
if (!(await slots()).includes("wallMembrane")) fail("no wall-membrane row");
await shot("cm1-wedi-membrane");

// --- wedi host, Building Panel ---
await toTab("Kits");
await pg.locator("[data-wedi-wallsys-board]").first().click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
await toCompare();
h = await sys(); console.log("wedi Building Panel host:", h);
if (!/Building Panel/.test(h.wedi) || !/KERDI-BOARD/.test(h.sch)) fail("wedi Building Panel does not face KERDI-BOARD");
if (!(await slots()).includes("wallBoard")) fail("no wall-board row");
await shot("cm2-wedi-board");

// --- Schluter host ---
await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600);
if ((await pg.locator("[data-schluter-kits-membrane]").innerText()).trim() !== "Membrane") fail("the Schluter segment does not read Membrane");
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
if (!/Membrane walls \(KERDI\)/.test(await pg.locator(".bc-h .sub, .sub").first().innerText())) fail("the Schluter subtitle does not read Membrane walls (KERDI)");
await toCompare();
h = await sys(); console.log("Schluter Membrane host:", h);
if (!/S-DRY membrane/.test(h.wedi)) fail("Schluter Membrane does not face wedi S-DRY");
await shot("cm3-schluter-membrane");
await toTab("Kits");
await pg.locator("[data-schluter-kits-board]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
await toCompare();
h = await sys(); console.log("Schluter KERDI-BOARD host:", h);
if (!/Building Panel/.test(h.wedi) || !/KERDI-BOARD/.test(h.sch)) fail("Schluter KERDI-BOARD does not face wedi Building Panel");
await shot("cm4-schluter-board");

// --- a linear Schluter room: S-DRY can't fit, wedi falls back to a wedi pan ---
await toTab("Kits");
await pg.locator("[data-schluter-kits-membrane]").click(); await pg.waitForTimeout(600);
const lin = pg.locator("[data-schluter-tray^='KSLT']");
if (await lin.count()) {
  await lin.first().click(); await pg.waitForTimeout(800);
  await toCompare();
  h = await sys(); console.log("Schluter linear host:", h);
  if (!/S-DRY membrane on a wedi pan/.test(h.wedi)) fail("the linear room's wedi column does not say S-DRY on a wedi pan");
  await shot("cm5-linear-fallback");
} else fail("no linear tray in the preview book");

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");

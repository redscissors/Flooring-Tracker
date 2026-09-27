// Proof: "+" on every Schluter bill group (ticket 158 Phase 1c) — a one-part
// group's list, Walls with its Part row, a stepped band add with the qty
// stepper, a linear build's whole-drain add with a Length row, an added line's
// "added" tag and "kit also bills N", and an added line's own ⇄.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1c";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const flat = (t) => t.replace(/\n+/g, " | ");
const pop = async () => flat(await pg.locator("[data-add-pop]").innerText());
const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name) }) });
const grpText = async (name) => flat(await grp(name).innerText());
const plus = async (g) => { await pg.locator(`[data-add-group="${g}"]`).click(); await pg.waitForSelector("[data-add-pop]", { timeout: 5000 }); await pg.waitForTimeout(200); };

await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600); // Full catalog
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);

const groups = await pg.locator("[data-add-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-add-group")));
console.log("+ on:", groups.join(", "));
if (groups.join() !== "Base,Drain,Curb,Walls,Seams,Niches,Bench,Setting,Extras") fail("not every group has a +");

// a one-part group: a list, no Part row; a click adds 1 and closes
await plus("Curb");
const curbPop = await pop();
console.log("curb +:", curbPop);
if (/PART/.test(curbPop)) fail("the one-part Curb + shows a Part row");
await shot("s1-curb-list");
await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400);
if (await pg.locator("[data-add-pop]").count()) fail("a list click did not close the popover");
if ((await grp("Curb").locator("[data-added-tag]").count()) !== 1) fail("the curb add did not land as an added line");

// Walls: the Part row names Board · Membrane · Fasteners
await plus("Walls");
const wallsPop = await pop();
console.log("walls +:", wallsPop);
if (!/PART \| Board \| Membrane \| Fasteners/.test(wallsPop)) fail("Walls + lacks its Part row");
await shot("s2-walls-part-row");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// a stepped band add: no Auto chip, the draft starts on the kit's band, qty 2
await plus("Seams");
if (await pg.locator('[data-drain-chip="Roll:auto"]').count()) fail("the band + shows an Auto chip");
await pg.locator('[data-drain-chip="Roll:5M"]').click();
await pg.locator("[data-add-qty] button").nth(1).click(); await pg.waitForTimeout(200);
const bandPop = await pop();
console.log("band + draft:", bandPop);
if (!/2 × KERDI-BAND/.test(bandPop) || !/KEBA100\/125\/5M/.test(bandPop)) fail("the band draft is not 2 × the 5 m roll");
await shot("s3-band-add-qty");
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
const seams = await grpText("Seams");
console.log("Seams:", seams);
if (!/KEBA100\/125\/10M/.test(seams) || !/added/.test(seams)) fail("the added band did not land beside the kit's");

// the same part as the kit's line: its own line, tagged, with "kit also bills"
await plus("Seams");
await pg.locator('[data-drain-chip="Roll:10M"]').click(); await pg.waitForTimeout(200);
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
const seams2 = await grpText("Seams");
console.log("Seams, same part:", seams2);
if (!/kit also bills 1/.test(seams2)) fail("the added 10 m band lacks 'kit also bills 1'");
if ((await grp("Seams").locator(".bline").count()) !== 3) fail("the same-part add merged into the kit line");
await shot("s4-added-tag-kit-also");

// an added line's own ⇄: replaces only that row, qty kept
await grp("Seams").locator("[data-added-swapb]").first().click(); await pg.waitForTimeout(300);
const swapPop = await pop();
console.log("added ⇄:", swapPop);
if (!/Swap the added band/.test(swapPop) || /PART/.test(swapPop)) fail("the added line's ⇄ is not its own panel");
await shot("s5-added-swap");
await pg.locator('[data-drain-chip="Roll:30M"]').click(); await pg.waitForTimeout(200);
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
const seams3 = await grpText("Seams");
console.log("Seams after ⇄:", seams3);
if (/KEBA100\/125\/5M/.test(seams3) || !/KEBA100\/125 ·/.test(seams3)) fail("the ⇄ did not replace the 5 m row with the 30 m roll");

// a linear build's Drain +: the whole drain with a Length row
await pg.getByRole("button", { name: "Clear design" }).click(); await pg.waitForTimeout(400);
await pg.locator("[data-schluter-tray='KSLT965/1930S']").first().click(); await pg.waitForTimeout(800);
await plus("Drain");
const drainPop = await pop();
console.log("drain +:", drainPop);
if (!/PART \| Drain/.test(drainPop) || !/LENGTH/.test(drainPop)) fail("the linear Drain + lacks its whole-drain Length row");
await shot("s6-drain-add");
await pg.keyboard.press("Escape");

// KERDI-BOARD walls: the Walls header's + sits beside Fit | One size, no overlap
await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600); // Full catalog
await pg.locator("[data-schluter-kits-board]").click(); await pg.waitForTimeout(300);
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
const wallsAdd = pg.locator('[data-add-group="Walls"]');
const wallsFit = pg.locator('[data-schluter-fit]');
if (!(await wallsAdd.isVisible())) fail("Walls + is not visible on a KERDI-BOARD build");
if (!(await wallsFit.isVisible())) fail("the Fit toggle is not visible on a KERDI-BOARD build");
const addBox = await wallsAdd.boundingBox();
const fitBox = await wallsFit.boundingBox();
const overlaps = addBox && fitBox &&
  addBox.x < fitBox.x + fitBox.width && addBox.x + addBox.width > fitBox.x &&
  addBox.y < fitBox.y + fitBox.height && addBox.y + addBox.height > fitBox.y;
if (overlaps) fail("the Walls + overlaps the Fit | One size toggle");
await shot("s7-walls-board-header");

await b.close();
if (err) { console.error("— FAILED"); process.exit(1); }
console.log("— all checks passed");

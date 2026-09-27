// Proof: wedi's Membrane (S-DRY) wall system (ticket 158 Phase 2, ADR 0051) —
// the Kits tab's S-DRY cards, an S-DRY build's bill (S-DRY floor, membrane,
// tape, corners, collars, SEAL, PRO-SET by area, the backer hint), the Custom
// tab's S-DRY options (extension, two extensions), the no-fit prompt and its
// "wedi pan + S-DRY walls" answer with the bill chip, and the print sheet.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p2/shoot-wedi.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p2";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const printShot = async (name) => {
  await pg.emulateMedia({ media: "print" });
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await pg.emulateMedia({ media: null });
  console.log("shot", name);
};
const flat = (t) => t.replace(/\n+/g, " | ");
const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name, "i") }) });
const grpText = async (name) => (await grp(name).count() ? flat(await grp(name).innerText()) : "");
const tab = (name) => pg.locator(".modetab", { hasText: name }).first().click();
const room = async (w, d) => {
  const dims = pg.locator(".rf", { hasText: "Shower size" }).locator("input");
  await dims.nth(0).fill(String(w)); await dims.nth(0).press("Enter"); await pg.waitForTimeout(300);
  await dims.nth(1).fill(String(d)); await dims.nth(1).press("Enter"); await pg.waitForTimeout(600);
};

await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500); // Full catalog

// --- Kits: the Membrane cards are the four S-DRY bases ---
await pg.locator("[data-wedi-wallsys-membrane]").first().click(); await pg.waitForTimeout(600);
const cards = await pg.locator("[data-wedi-pan]").evaluateAll((els) => els.map((e) => e.getAttribute("data-wedi-pan")));
console.log("Membrane cards:", cards.join(", "));
if (cards.join() !== "US9176001,US9176002,US9176003,US9176004") fail("the Membrane Kits tab is not the four S-DRY bases");
await pg.locator("[data-wedi-pan='US9176003']").click(); await pg.waitForTimeout(800);
const sub = await pg.locator(".bc-h .sub").innerText();
console.log("subtitle:", sub);
if (!/S-DRY membrane walls/.test(sub)) fail("the bill subtitle does not name the S-DRY walls");
// the preview's stock book names S-DRY parts its own way ("S-DRY™ BFD")
const need = [["Base", /S-Dry Shower Base/i], ["Drain", /BFD|Bonding/i], ["Drain", /DCSS|Drain Cover/i], ["Curb", /S-DRY.*Curb/i],
  ["Walls", /S-DRY/i], ["Seams", /S-DRY.*Tape/i], ["Seams", /Inside Corner/i], ["Seams", /Mixing Valve Collar/i],
  ["Setting", /S-DRY.*SEAL/i], ["Setting", /PRO-SET/]];
for (const [g, re] of need) if (!re.test(await grpText(g))) fail(`${re} is not under ${g}`);
if (/Building Panel|Fastener Kit|Joint/.test(await grpText("Walls") + await grpText("Seams"))) fail("a Building Panel line survived under Membrane");
if (!(await pg.locator("[data-wedi-backer]").count())) fail("no backer hint");
await shot("k1-sdry-kit");

// --- Custom: S-DRY options ---
await tab("Custom shower"); await pg.waitForTimeout(500);
await room(48, 90);
const t1 = await pg.locator(".optcard .t").allInnerTexts();
console.log("48×90 options:", t1.join(" / "));
if (!/extension/.test(t1[0] || "")) fail("48×90 does not lead with base + extension");
await shot("c1-sdry-extension");
await room(72, 90);
const t2 = await pg.locator(".optcard .t").allInnerTexts();
console.log("72×90 options:", t2.join(" / "));
if (!t2.some((t) => /2 extensions/.test(t))) fail("72×90 offers no two-extension option");

// --- the no-fit prompt ---
await room(100, 120);
const why = await pg.locator("[data-wedi-sdryask] .why").innerText().catch(() => "");
console.log("prompt:", why);
if (!/larger than an S-DRY base/.test(why)) fail("no prompt naming why S-DRY can't fit");
await shot("f1-sdry-prompt");
await pg.locator('[data-sdry-answer="wedi"]').click(); await pg.waitForTimeout(900);
const chip = await pg.locator("[data-wedi-sdrychip]").innerText().catch(() => "");
console.log("chip:", chip);
if (!/S-DRY walls on a wedi pan/.test(chip)) fail("no 'S-DRY walls on a wedi pan' chip");
if (/S-Dry Shower Base/i.test(await grpText("Base"))) fail("the wedi-pan answer still bills an S-DRY base");
if (!/S-DRY/i.test(await grpText("Walls"))) fail("the wedi-pan answer lost the S-DRY walls");
await shot("f2-wedi-pan-sdry-walls");
await pg.locator("[data-wedi-sdrychip]").click(); await pg.waitForTimeout(400);
await pg.locator('[data-sdry-answer="nearest"]').click(); await pg.waitForTimeout(900);
if (!/S-Dry Shower Base/i.test(await grpText("Base"))) fail("the nearest answer did not build on an S-DRY base");
if (!/nearest S-DRY base/.test(await pg.locator("[data-wedi-sdrychip]").innerText().catch(() => ""))) fail("no nearest chip");
await shot("f3-nearest");

// --- print ---
await room(48, 72);
await pg.locator('[data-sdry-answer="sdry"]').click().catch(() => {}); await pg.waitForTimeout(600);
await pg.locator("[data-wedi-print], button:has-text('Print layout')").first().click(); await pg.waitForTimeout(400);
const pt = await pg.locator(".wedi-printsheet").innerText().catch(() => "");
if (!/S-DRY membrane walls/.test(pt)) fail("the print head does not name the wall system");
if (!/membrane needs a backer/.test(pt)) fail("the print sheet lacks the backer note");
await printShot("p1-sdry-print");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// --- back to Building Panel: the kit is as today ---
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
if ((await pg.locator("[data-wedi-pan='US9176001']").count())) fail("S-DRY cards show under Building Panel");
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
if (!/Building Panel walls/.test(await pg.locator(".bc-h .sub").innerText())) fail("the Building Panel subtitle is missing");
if (!/Building Panel/.test(await grpText("Walls"))) fail("the Building Panel kit lost its panel");
await shot("k2-building-panel");

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");

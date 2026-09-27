// Proof: "+" on every wedi bucket (ticket 158 Phase 1c) — two niches of
// different sizes ("✓ Niche ×2"), a stepped panel add with "kit also bills",
// a stepped curb add with no Auto or No curb, an added line's own ⇄, − taking
// one niche off (not both), a land + Reconfigure round trip that keeps the
// added lines without doubling, and a curb added to a curbless kit billed but
// not drawn.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs
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
const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name, "i") }) });
const grpText = async (name) => flat(await grp(name).innerText());
const plus = async (g) => { await pg.locator(`[data-add-group="${g}"]`).click(); await pg.waitForSelector("[data-add-pop]", { timeout: 5000 }); await pg.waitForTimeout(200); };
const drawing = async () => pg.locator("svg").evaluateAll((els) => els.map((e) => e.outerHTML).join(""));

await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500); // Full catalog
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800); // 36×60

const groups = await pg.locator("[data-add-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-add-group")));
console.log("+ on:", groups.join(", "));
if (groups.join() !== "floor,walls,bench,drain,install,addon") fail("not every bucket has a +");

// two niches of different sizes through the chip — it adds another each click
for (const nth of [0, 3]) {
  await pg.locator('[data-wedi-chip="niche"]').click(); await pg.waitForTimeout(300);
  await pg.locator(".wedi-chipmenu .srow").nth(nth).click(); await pg.waitForTimeout(300);
}
const addons = await grpText("Add-ons");
console.log("Add-ons:", addons);
if ((await grp("Add-ons").locator("[data-added-tag]").count()) !== 2) fail("two niche sizes did not land as two added lines");
if (!/✓ Niche ×2/.test(addons)) fail("the niche chip does not read ✓ Niche ×2");
await shot("w1-two-niches");

// a stepped panel add: the kit's panel again, qty 2 — its own line, "kit also bills 2"
await plus("walls");
if (await pg.locator('[data-drain-chip^="Size:auto"]').count()) fail("the panel + shows an Auto chip");
await pg.locator("[data-add-qty] button").nth(1).click(); await pg.waitForTimeout(200);
console.log("panel +:", await pop());
await shot("w2-panel-add");
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
const walls = await grpText("Walls");
console.log("Walls:", walls);
if (!/kit also bills 2/.test(walls)) fail("the added panel lacks 'kit also bills 2'");
const wallLines = await grp("Walls").locator(".bline").evaluateAll((els) => els.map((e) => !!e.querySelector("[data-added-tag]")));
if (wallLines[wallLines.length - 1] !== true || wallLines.slice(0, -1).some(Boolean)) fail("the added panel is not its own line below the kit's");
await shot("w3-panel-kit-also");

// a stepped curb add: Style → Length, no Auto, no No curb
await plus("floor");
await pg.locator('[data-drain-chip="Part:curb"]').click(); await pg.waitForTimeout(300);
const curbPop = await pop();
console.log("curb +:", curbPop);
if (/Auto|No curb/.test(curbPop)) fail("the curb + offers Auto or No curb");
await shot("w4-curb-add");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// an added niche's own ⇄: a list of niches, the row it replaces lit
await grp("Add-ons").locator("[data-added-swapb]").first().click(); await pg.waitForTimeout(300);
console.log("added ⇄:", (await pop()).slice(0, 200));
if (!/Swap the added niche/.test(await pop())) fail("the added niche's ⇄ is not its own panel");
await shot("w5-added-swap");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// − on one niche takes that one off, not both
await grp("Add-ons").locator(".bline").first().locator(".stepper button").first().click(); await pg.waitForTimeout(400);
if ((await grp("Add-ons").locator(".bline").count()) !== 1) fail("− on one niche did not leave the other");

// land + Reconfigure: the added lines come back, nothing doubles
const before = await grpText("Walls") + await grpText("Add-ons");
await pg.locator("[data-wedi-add]").click();
await pg.waitForSelector("[data-wedi-confirm]", { timeout: 5000 });
await pg.locator("[data-wedi-confirm]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-sheet-reconfig]").first().click();
await pg.waitForSelector(".stepper", { timeout: 5000 }); await pg.waitForTimeout(900);
const after = await grpText("Walls") + await grpText("Add-ons");
console.log("reopened:", after);
if (after !== before) fail("Reconfigure did not reopen the added lines as they were");
await shot("w6-reconfigure-round-trip");

// a curb added to a curbless kit bills but isn't drawn
await pg.getByRole("button", { name: "Clear design" }).click(); await pg.waitForTimeout(400);
await pg.locator("[data-wedi-pan='US9200007']").click(); await pg.waitForTimeout(800);
const flat0 = await drawing();
await plus("floor");
await pg.locator('[data-drain-chip="Part:curb"]').click(); await pg.waitForTimeout(300);
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
if (!(await pg.locator(".bline", { hasText: /Curb(?!less)/ }).count())) fail("the added curb did not bill");
if ((await drawing()) !== flat0) fail("the drawing changed for an added curb");
await shot("w7-curbless-added-curb-not-drawn");

await b.close();
if (err) { console.error("— FAILED"); process.exit(1); }
console.log("— all checks passed");

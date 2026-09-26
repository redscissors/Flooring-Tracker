// Proof: the Schluter stepped drain popover (ticket 158 Phase 1a, Task 6).
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1a/shoot-schluter.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1a";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const popText = () => pg.locator("[data-drain-swap]").innerText();

await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-schluter-tray='KSLT1395S']").click(); await pg.waitForTimeout(800);

const drainSwap = pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: /^Drain/ }) }).locator("[data-schluter-swapb]").first();
await drainSwap.click();
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
console.log("vario:", (await popText()).replace(/\n+/g, " | "));
await shot("s1-vario-popover");

await pg.locator('[data-drain-chip="Family:fixed"]').click();
console.log("fixed:", (await popText()).replace(/\n+/g, " | "));
await shot("s2-fixed-52");

await pg.locator('[data-drain-chip="Grate:floral"]').click();
console.log("floral:", (await popText()).replace(/\n+/g, " | "));
await shot("s3-floral-48");

await pg.locator('[data-drain-chip="Family:frameless"]').click();
await pg.locator('[data-drain-chip="Body:offset"]').click();
console.log("frameless offset:", (await popText()).replace(/\n+/g, " | "));
await shot("s4-frameless-offset");

// back to the fixed solid choice so the drawing shows the 52" channel + 3" fill
await pg.locator('[data-drain-chip="Family:fixed"]').click();
await pg.locator('[data-drain-chip="Grate:solid"]').click();
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(800);
if (await pg.locator("[data-drain-swap]").count()) { console.error("popover still open after Use this"); err = true; }
await shot("s5-used-fixed-build");
const cutH = pg.locator(".dc-h", { hasText: "Cut list" });
await cutH.evaluate((el) => el.scrollIntoView({ block: "start" }));
const cuts = await cutH.locator("xpath=..").innerText();
console.log("cut list:", cuts.replace(/\n+/g, " | "));
if (!/KERDI-LINE 52" channel \+ grate — fill 3"/.test(cuts)) { console.error("cut list lacks the fixed channel"); err = true; }
await shot("s5b-used-fixed-cutlist");

// Esc discards a draft: reopen, pick frameless, Esc, the bill keeps fixed
await drainSwap.click(); await pg.waitForSelector("[data-drain-swap]");
await pg.locator('[data-drain-chip="Family:frameless"]').click();
await pg.keyboard.press("Escape"); await pg.waitForTimeout(400);
const drainText = await pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: /^Drain/ }) }).innerText();
console.log("after Esc:", drainText.replace(/\n+/g, " | "));
if (!/SLRKL1AR19EB130/.test(drainText)) { console.error("Esc did not discard the draft"); err = true; }

// a point-drain build: the grate line's ⇄ opens the Grate-only popover
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(600);
if (await pg.locator("text=Overwrite").count()) { await pg.locator("text=Overwrite").first().click(); await pg.waitForTimeout(600); }
await pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: /^Drain/ }) }).locator("[data-schluter-swapb]").last().click();
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
const chips = pg.locator('[data-drain-chip^="Grate:"]');
await chips.nth(2).click();
console.log("point:", (await popText()).replace(/\n+/g, " | "));
await shot("s6-point-grate-popover");
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
const pointDrain = await pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: /^Drain/ }) }).innerText();
if (!/KDIF4GRKEBD5/.test(pointDrain)) { console.error("point Use this did not land the grate"); err = true; }
// the flange line's ⇄ opens the same Grate-only popover, seeded on the grate now billed
await pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: /^Drain/ }) }).locator("[data-schluter-swapb]").first().click();
await pg.waitForSelector("[data-drain-swap]", { timeout: 5000 });
const onChip = await pg.locator('[data-drain-chip^="Grate:"].bg-\\[color\\:var\\(--ft-brand\\)\\]').getAttribute("data-drain-chip");
console.log("flange ⇄ opens on:", onChip);
if (onChip !== "Grate:KDIF4GRKEBD5") { console.error("flange ⇄ not seeded on the billed grate"); err = true; }

await b.close();
if (err) process.exit(1);

// Proof: Compare's Open in the Apps hub (ticket 158 Phase 4 follow-up) — the
// hub's wedi and Schluter tabs get Open/Sync, Open switches the pane to the
// other configurator on Compare, and the build you left shows as Your build at
// the same money (a session-only set: the hub has no shower to save it on).
// The REAL rail + AppsWorkspace over the fixture books (rail-preview.html).
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p4/shoot-hub.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p4";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1600, height: 1000 } });
let err = false;
pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
const W = "[data-wedi-pop]", S = "[data-schluter-pop]";
const inPop = (pop, sel) => pg.locator(`${pop} ${sel}`);
const toCompare = async (pop) => {
  await inPop(pop, ".modetab").filter({ hasText: "Compare" }).dispatchEvent("click");
  await onCompare(pop);
};
const onCompare = async (pop) => {
  await pg.waitForSelector(`${pop} [data-cmp-col] [data-cmp-total]`, { state: "visible", timeout: 20000 });
  await pg.waitForTimeout(1200);
};
const current = async (pop) => inPop(pop, "[data-cmp-current]").getAttribute("data-cmp-col");
const status = async (pop, k) => inPop(pop, `[data-cmp-col="${k}"] [data-cmp-status]`).getAttribute("data-cmp-status");
const total = async (pop, k) => txt(inPop(pop, `[data-cmp-col="${k}"] [data-cmp-total]`));

// --- 1. wedi from the rail: a 3'6"x5' kit, then Compare — Open is there ---
await pg.goto("http://localhost:5199/rail-preview.html");
await pg.locator("aside button", { hasText: /^\s*wedi\s*$/ }).first().click();
await pg.waitForSelector(`${W} [data-wedi-pan]`, { timeout: 20000 }); await pg.waitForTimeout(600);
await inPop(W, "[data-source-toggle]").click(); await pg.waitForTimeout(500);
await inPop(W, "[data-wedi-pan='US9100007']").click(); await pg.waitForTimeout(900);
await toCompare(W);
const opens = await inPop(W, "[data-cmp-open]").evaluateAll((els) => els.filter((e) => !e.disabled).map((e) => e.getAttribute("data-cmp-open")));
if (opens.join() !== "wedi:membrane,schluter:board,schluter:membrane") fail("the hub's Compare has no Open: " + opens);
if ((await current(W)) !== "wedi:board") fail("the ring is not on wedi Building Panel");
if (await pg.locator("[data-resume]").count()) fail("the hub raised a resume prompt");
const wediTotal = await total(W, "wedi:board");
await shot("h1-hub-wedi-open");

// --- 2. Open Schluter KERDI membrane: the pane moves, the wedi build is kept ---
await inPop(W, '[data-cmp-open="schluter:membrane"]').click();
await onCompare(S);
if (!(await pg.locator(S).isVisible())) fail("Open did not switch the hub to Schluter");
if (await pg.locator(W).isVisible()) fail("the wedi tab is still showing");
if ((await current(S)) !== "schluter:membrane") fail("the ring did not move to KERDI membrane");
if ((await status(S, "wedi:board")) !== "yours") fail("the wedi build you left is not kept");
if ((await total(S, "wedi:board")) !== wediTotal) fail(`the kept wedi build moved: ${await total(S, "wedi:board")} vs ${wediTotal}`);
if (!(await inPop(S, '[data-cmp-sync="wedi:board"]').count())) fail("no Sync on the kept wedi build");
await shot("h2-hub-open-schluter");

// --- 3. Open the kept wedi build: back in wedi, same money ---
await inPop(S, '[data-cmp-open="wedi:board"]').click();
await onCompare(W);
if (!(await pg.locator(W).isVisible())) fail("Open did not switch the hub back to wedi");
if ((await current(W)) !== "wedi:board") fail("the ring is not back on wedi Building Panel");
if ((await total(W, "wedi:board")) !== wediTotal) fail("the reopened wedi build is not the one kept");
if ((await status(W, "schluter:membrane")) !== "yours") fail("the Schluter build you left is not kept");
await shot("h3-hub-back-to-wedi");

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");

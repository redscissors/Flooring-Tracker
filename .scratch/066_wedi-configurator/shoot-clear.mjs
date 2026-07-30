// Clear-design button + kit-seeded form + custom-shower rotate + Drains
// under Covers (owner asks 2026-07-30). Serve wedi-preview.html on :5199.
import { chromium } from "playwright";
const OUT = ".scratch/066_wedi-configurator";
const URL = "http://localhost:5199/wedi-preview.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForTimeout(1200);

const popup = pg.locator("[data-wedi-pop]");

// U1 — pick the 36×60 kit, hop to Custom shower: the form mirrors the kit
// (60 × 36, curbed, center) with the drain boxes back on auto.
await pg.click('[data-wedi-pan="US9100004"]');
await pg.waitForTimeout(400);
await pg.locator(".modetab").nth(1).click();
await pg.waitForTimeout(400);
const wVal = await pg.locator(".roomform .dims input").nth(0).inputValue();
const dVal = await pg.locator(".roomform .dims input").nth(1).inputValue();
const dx = await pg.locator(".roomform .dims input").nth(2).inputValue();
console.log("form after kit pick:", wVal + "x" + dVal, "drain boxes:", JSON.stringify(dx), "(empty = auto)");
await popup.screenshot({ path: `${OUT}/U1-kit-seeds-form.png` });

// U2 — Clear design wipes the build and the form.
await pg.locator("[data-wedi-clear]").click();
await pg.waitForTimeout(500);
const cleared = await pg.locator(".bc-empty").count();
console.log("build cleared:", cleared === 1);
await popup.screenshot({ path: `${OUT}/U2-cleared.png` });

// U3 — solve a room, then the ⇄ in the Walls header rotates it (width ↔
// depth) and re-solves.
const wIn = pg.locator(".roomform .dims input").nth(0);
await wIn.fill("60"); await wIn.press("Enter");
const dIn = pg.locator(".roomform .dims input").nth(1);
await dIn.fill("110"); await dIn.press("Enter");
await pg.waitForTimeout(500);
await pg.locator(".optcard").first().click();
await pg.waitForTimeout(400);
await pg.locator(".wtgl").click();
await pg.waitForTimeout(600);
const wVal2 = await pg.locator(".roomform .dims input").nth(0).inputValue();
const dVal2 = await pg.locator(".roomform .dims input").nth(1).inputValue();
console.log("after rotate:", wVal2 + "x" + dVal2);
await popup.screenshot({ path: `${OUT}/U3-rotated.png` });

// U4 — Browse: Drains now sits under Covers.
await pg.locator(".modetab").nth(2).click();
await pg.waitForTimeout(400);
await popup.screenshot({ path: `${OUT}/U4-drains-under-covers.png` });

console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();

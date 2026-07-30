// Big-pan card + filled corners + 2" build-up (owner round, 2026-07-30).
// Serve wedi-preview.html on :5199, then run this.
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

// V1 — the owner's 60×110 centre-drain room: options no longer leave blank
// corners, and the 60×84 big pan earns a card.
await pg.locator(".modetab").nth(1).click();
await pg.waitForTimeout(300);
const wIn = pg.locator(".roomform .dims input").nth(0);
await wIn.fill("60"); await wIn.press("Enter");
const dIn = pg.locator(".roomform .dims input").nth(1);
await dIn.fill("110"); await dIn.press("Enter");
await pg.waitForTimeout(300);
await pg.locator(".seg button", { hasText: "Center" }).first().click();
await pg.waitForTimeout(600);
await popup.screenshot({ path: `${OUT}/V1-60x110-options.png` });

// V2 — pick the 60×84 card: the build column carries the ½" build-up sheet
// line and the warning list explains the shim.
await pg.locator(".optcard", { hasText: '60" x 84"' }).click();
await pg.waitForTimeout(600);
const shim = await pg.locator(".bline", { hasText: "build-up" }).first().textContent().catch(() => "(none)");
console.log("build-up line:", shim.slice(0, 110));
await popup.screenshot({ path: `${OUT}/V2-60x84-buildup.png` });

console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();

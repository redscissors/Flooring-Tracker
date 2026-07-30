// Curb-round preview shots (wall→curb + square-butted, longest-point curbs).
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
const diagcol = pg.locator(".diagcol");
const topSvg = () => pg.locator(".diagcol svg").first();

// Y1 — 36×60 kit, right-click the right wall: the menu now carries
// "Turn into a curb".
await pg.click('[data-wedi-pan="US9100004"]');
await pg.waitForTimeout(500);
await topSvg().locator(".wband").nth(2).click({ button: "right" });
await pg.waitForTimeout(400);
await popup.screenshot({ path: `${OUT}/Y1-wall-menu-curb-option.png` });

// Y2 — turn it into a curb: the right edge curbs, butting the back wall
// square at the top and filling the entry ring corner — no gaps — and the
// curb line figures at the longest point.
await pg.locator("[data-wedi-wallmenu] .wm-act").click();
await pg.waitForTimeout(600);
const curbLine = await pg.locator(".bline", { hasText: "Curb" }).first().textContent().catch(() => "(none)");
console.log("curb line after wall→curb:", curbLine.slice(0, 90));
await popup.screenshot({ path: `${OUT}/Y2-wall-turned-curb.png` });
await diagcol.screenshot({ path: `${OUT}/Y2b-curb-corners-closeup.png` });

// Y3 — the owner's sketch case: 42×42, 14" entry wall, 28" right wall, the
// entry-right corner cut — the diagonal curb's ends are squared to the wall
// ends (no sliver gaps) and the piece figures at its outer, longest edge.
await pg.locator(".modetab").nth(0).click();
await pg.waitForTimeout(300);
await pg.evaluate(() => { [...document.querySelectorAll(".pancard")].find((c) => c.textContent.includes("42×42"))?.click(); });
await pg.waitForTimeout(300);
// overwrite confirm (custom shower standing from Y2)
if (await pg.locator("[data-wedi-overwrite-yes]").count()) {
  await pg.locator("[data-wedi-overwrite-yes]").click();
  await pg.waitForTimeout(400);
}
const rightLen = pg.locator(".wallrow").nth(2).locator("input").first();
await rightLen.fill("28");
await rightLen.press("Enter");
await pg.waitForTimeout(400);
// add the 14" entry wall by clicking the entry edge on the drawing
await pg.getByText("+ Add wall").click();
await pg.waitForTimeout(200);
const sb = await topSvg().boundingBox();
await pg.mouse.click(sb.x + sb.width * 0.45, sb.y + sb.height * 0.86);
await pg.waitForTimeout(300);
const entryLen = pg.locator(".wallrow").nth(3).locator("input").first();
await entryLen.fill("14");
await entryLen.press("Enter");
await pg.waitForTimeout(500);
await pg.getByText("Cut open corners").click();
await pg.waitForTimeout(500);
await diagcol.screenshot({ path: `${OUT}/Y3-diagonal-squared-ends.png` });
const curbLine2 = await pg.locator(".bline", { hasText: "Curb" }).first().textContent().catch(() => "(none)");
console.log("42x42 wall-to-wall curb line:", curbLine2.slice(0, 90));

console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();

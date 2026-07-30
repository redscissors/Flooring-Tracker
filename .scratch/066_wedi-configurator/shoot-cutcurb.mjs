// Cut-corner off-cut hidden beyond the curb (owner rule 2026-07-30).
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

const diagcol = pg.locator(".diagcol");
const topSvg = () => pg.locator(".diagcol svg").first();

// Z1 — the 42×42 sketch case with the fr corner cut: the curb rides the cut
// line and the off-cut triangle beyond it is HIDDEN (subfloor), not ghosted.
await pg.evaluate(() => { [...document.querySelectorAll(".pancard")].find((c) => c.textContent.includes("42×42"))?.click(); });
await pg.waitForTimeout(400);
const rightLen = pg.locator(".wallrow").nth(2).locator("input").first();
await rightLen.fill("28");
await rightLen.press("Enter");
await pg.waitForTimeout(300);
await pg.getByText("+ Add wall").click();
await pg.waitForTimeout(200);
const sb = await topSvg().boundingBox();
await pg.mouse.click(sb.x + sb.width * 0.45, sb.y + sb.height * 0.86);
await pg.waitForTimeout(300);
const entryLen = pg.locator(".wallrow").nth(3).locator("input").first();
await entryLen.fill("14");
await entryLen.press("Enter");
await pg.waitForTimeout(400);
await pg.getByText("Cut open corners").click();
await pg.waitForTimeout(500);
await diagcol.screenshot({ path: `${OUT}/Z1-cut-offcut-hidden.png` });

// Z2 — the curbless contrast: a curbless pan's cut corner keeps the ghosted
// triangle (no curb to hide behind).
await pg.locator(".modetab").nth(0).click();
await pg.waitForTimeout(300);
await pg.evaluate(() => { [...document.querySelectorAll(".pancard")].find((c) => c.textContent.includes("Curbless"))?.click(); });
await pg.waitForTimeout(300);
if (await pg.locator("[data-wedi-overwrite-yes]").count()) {
  await pg.locator("[data-wedi-overwrite-yes]").click();
  await pg.waitForTimeout(400);
}
await pg.getByText("Cut open corners").click();
await pg.waitForTimeout(500);
await diagcol.screenshot({ path: `${OUT}/Z2-curbless-ghost-kept.png` });

console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();

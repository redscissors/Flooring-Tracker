// The bench/curb junction in the isometric, blown up — with a STANDARD curb
// (4½" wide, 5⅛" tall) so the notch the bench cuts round it is big enough to
// read. node .scratch/079_wedi-custom-pan-interactions/probe-benchcurb.mjs
import { chromium } from "playwright";

const OUT = ".scratch/079_wedi-custom-pan-interactions/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 8 });
pg.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1400);
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(700);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(500);

const at = (fx, fy) => pg.evaluate(([px, py]) => {
  const s = document.querySelector(".diagcol svg");
  const p = [...s.querySelectorAll("rect")].find((e) => e.getAttribute("fill") === "#DCE5CD");
  const r = s.getBoundingClientRect(), k = r.width / s.viewBox.baseVal.width;
  return [r.left + (+p.getAttribute("x") + +p.getAttribute("width") * px) * k,
    r.top + (+p.getAttribute("y") + +p.getAttribute("height") * py) * k];
}, [fx, fy]);

const [bx, by] = await at(0.10, 0.45);
await pg.mouse.move(bx, by);
await pg.waitForTimeout(300);
await pg.mouse.click(bx, by);
await pg.waitForTimeout(600);
await pg.locator(".wedi-benchmenu .bm-opt").first().click();   // wedi 2" build-up
await pg.waitForTimeout(900);
await pg.mouse.move(4, 4);

// swap the lean curb for a standard one, so the notch is 4½" not 2"
const curbLine = pg.locator(".bline", { hasText: "Curb" }).first();
await curbLine.locator(".swapb").click();
await pg.waitForTimeout(500);
const rows = pg.locator(".wedi-swap .srow");
console.log("curb options:", await rows.locator(".n").allTextContents());
for (const t of ["Standard", "Full Foam", "AT"]) {
  const r = pg.locator(".wedi-swap .srow", { hasText: t });
  if (await r.count()) { await r.first().click(); console.log("picked:", t); break; }
}
await pg.waitForTimeout(1000);
await pg.mouse.move(4, 4);
await pg.waitForTimeout(400);

const iso = pg.locator(".diagcol svg").nth(1);
const r = await iso.boundingBox();
await pg.screenshot({ path: `${OUT}/junction-iso.png`, clip: { x: r.x + r.width * 0.05, y: r.y + r.height * 0.50, width: r.width * 0.46, height: r.height * 0.44 } });
await iso.screenshot({ path: `${OUT}/junction-iso-full.png` });
await pg.locator(".diagcol svg").first().screenshot({ path: `${OUT}/junction-plan.png` });

await pg.close();
await b.close();

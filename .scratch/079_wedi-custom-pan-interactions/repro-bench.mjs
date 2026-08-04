// Repro: a bench, then "Max — curb inside".
//   node .scratch/079_wedi-custom-pan-interactions/repro-bench.mjs
import { chromium } from "playwright";

const OUT = ".scratch/079_wedi-custom-pan-interactions/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
pg.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(600);
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(500);

// viewBox fraction of the PAN rect -> client point
const at = (fx, fy) => pg.evaluate(([px, py]) => {
  const svg = document.querySelector(".diagcol svg");
  const pan = [...svg.querySelectorAll("rect")].find((e) => e.getAttribute("fill") === "#DCE5CD");
  const r = svg.getBoundingClientRect(), k = r.width / svg.viewBox.baseVal.width;
  return [r.left + (+pan.getAttribute("x") + +pan.getAttribute("width") * px) * k,
    r.top + (+pan.getAttribute("y") + +pan.getAttribute("height") * py) * k];
}, [fx, fy]);

const state = async (tag) => {
  const s = await pg.evaluate(() => {
    const on = [...document.querySelectorAll(".rseg button")].find((e) => /Sizes|Pan size|Max/.test(e.textContent) && e.classList.contains("on"));
    const svg = document.querySelector(".diagcol svg");
    const bench = [...svg.querySelectorAll("rect,polygon")].filter((e) => e.getAttribute("fill") === "#DCE0C8").length;
    const sub = document.querySelector(".bc-h .sub")?.textContent || "";
    const lines = [...document.querySelectorAll(".buildcol .bline .bn .n")].map((e) => e.textContent);
    return { mode: [...document.querySelectorAll(".rseg button.on")].map((e) => e.textContent).join("|"),
      benchShapes: bench, build: sub, hasBenchLine: lines.some((n) => /bench|seat/i.test(n)), lines: lines.length };
  });
  console.log(tag.padEnd(30), JSON.stringify(s));
  return s;
};

// hover a bench zone along the LEFT wall, then click to open the bench menu
const [bx, by] = await at(0.10, 0.45);
await pg.mouse.move(bx, by);
await pg.waitForTimeout(400);
await pg.mouse.click(bx, by);
await pg.waitForTimeout(600);
const menu = pg.locator(".wedi-benchmenu");
if (await menu.count()) {
  console.log("bench menu options:", await menu.locator(".bm-opt b").allTextContents());
  await menu.locator(".bm-opt").first().click();
  await pg.waitForTimeout(900);
} else console.log("!! no bench menu opened");

await state("after adding a bench");
await pg.locator(".diagcol").screenshot({ path: `${OUT}/bench-1-added.png` });

await pg.locator(".rseg button", { hasText: "Max — curb inside" }).click();
await pg.waitForTimeout(1200);
await state("after Max — curb inside");
await pg.locator(".diagcol").screenshot({ path: `${OUT}/bench-2-max.png` });

await pg.close();
await b.close();

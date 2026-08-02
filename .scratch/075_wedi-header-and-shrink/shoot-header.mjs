// Shoots the four header candidates: one overview sheet, then each panel on
// its own at the width the solver column actually gets (~640px at the shrink
// floor, ~900px at full size).
import { chromium } from "playwright";

const OUT = ".scratch/075_wedi-header-and-shrink/shots";
const URL = "http://127.0.0.1:5199/.scratch/075_wedi-header-and-shrink/headerproto.html";

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];

const page = async (w, h) => {
  const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  pg.on("pageerror", (e) => errs.push(String(e)));
  return pg;
};

const overview = await page(1000, 1400);
await overview.goto(URL, { waitUntil: "load" });
await overview.waitForTimeout(1200);
await overview.screenshot({ path: `${OUT}/header-all-900.png`, fullPage: true });
await overview.close();

for (const [key, name] of [["today", "0-today"], ["a", "A-grouped"], ["b", "B-two-tier"], ["c", "C-summary"], ["d", "D-specrows"]]) {
  for (const w of [940, 660]) {
    const pg = await page(w, 700);
    await pg.goto(URL + "?v=" + key, { waitUntil: "load" });
    await pg.waitForTimeout(700);
    await pg.locator(`[data-panel='${key}']`).screenshot({ path: `${OUT}/header-${name}-${w}.png` });
    await pg.close();
  }
}

// C expanded — the state behind "Edit shower"
const pgC = await page(940, 700);
await pgC.goto(URL + "?v=c", { waitUntil: "load" });
await pgC.waitForTimeout(700);
await pgC.locator(".c-edit").click();
await pgC.waitForTimeout(300);
await pgC.locator("[data-panel='c']").screenshot({ path: `${OUT}/header-C-summary-open-940.png` });
await pgC.close();

await b.close();
console.log(errs.length ? "console errors:\n" + errs.join("\n") : "clean");

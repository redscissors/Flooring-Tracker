// A vs the two slimmed rebuilds, with measured heights — the owner's ask was
// "A but half the size", so the number is the point.
import { chromium } from "playwright";

const OUT = ".scratch/075_wedi-header-and-shrink/shots";
const URL = "http://127.0.0.1:5199/.scratch/075_wedi-header-and-shrink/headerproto.html";
const PANELS = [["today", "0-today"], ["a", "A-grouped"], ["a1", "A1-compressed"], ["a2", "A2-bands"]];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];
const rows = [];

for (const [key, name] of PANELS) {
  for (const w of [940, 660]) {
    const pg = await b.newPage({ viewport: { width: w, height: 700 }, deviceScaleFactor: 2 });
    pg.on("pageerror", (e) => errs.push(String(e)));
    await pg.goto(URL + "?v=" + key, { waitUntil: "load" });
    await pg.waitForTimeout(700);
    // the control board itself, not the panel's title/note
    const board = pg.locator(`[data-panel='${key}'] > div:last-child`);
    const box = await board.boundingBox();
    rows.push({ panel: name, width: w, height: Math.round(box.height) });
    await board.screenshot({ path: `${OUT}/slim-${name}-${w}.png` });
    await pg.close();
  }
}

await b.close();
console.table(rows);
if (errs.length) console.log("page errors:\n" + errs.join("\n"));

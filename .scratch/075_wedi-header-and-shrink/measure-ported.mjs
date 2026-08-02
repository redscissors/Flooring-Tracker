// The ported Kits list + C1 columns, measured in the REAL configurator through
// the real Apps hub — not the prototype, whose 940px assumption was wrong once
// already. Reports the three column widths per tab (they should be identical)
// and the Kits list's content height, empty and with a kit built.
import { chromium } from "playwright";

const OUT = ".scratch/075_wedi-header-and-shrink/shots";
const URL = "http://127.0.0.1:5199/.scratch/075_wedi-header-and-shrink/hub.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const rows = [];
const errs = [];

const cols = (pg) => pg.evaluate(() => [".main", ".buildcol", ".diagcol"]
  .map((s) => Math.round(document.querySelector(".wedi-pop " + s).offsetWidth)).join(" / "));

for (const vw of [1680, 1440, 1280, 1024]) {
  for (const tab of ["Kits", "Custom shower", "Browse"]) {
    const pg = await b.newPage({ viewport: { width: vw, height: 940 }, deviceScaleFactor: 1.5 });
    pg.on("pageerror", (e) => errs.push(vw + " " + tab + ": " + String(e)));
    await pg.goto(URL, { waitUntil: "load" });
    await pg.waitForTimeout(800);
    const back = pg.locator("button[title='Back to the app list']");
    if (await back.count()) { await back.click(); await pg.waitForTimeout(300); }
    await pg.locator("nav button", { hasText: "wedi configurator" }).click();
    await pg.waitForSelector(".wedi-pop .diagcol", { timeout: 20000 });   // lazy chunk
    await pg.waitForTimeout(1000);
    if (tab !== "Kits") { await pg.locator(".modetab", { hasText: tab }).click(); await pg.waitForTimeout(1200); }

    const row = { viewport: vw, tab, columns: await cols(pg) };
    if (tab === "Kits") {
      row.listContentH = await pg.locator(".main").evaluate((el) => {
        const f = [...el.querySelectorAll(".fam")];
        return Math.round(f[f.length - 1].offsetTop + f[f.length - 1].offsetHeight - f[0].offsetTop);
      });
      await pg.screenshot({ path: `${OUT}/final-${vw}-kits.png` });
      // and again with a kit built, to see how far the columns move
      await pg.locator(".pancard").nth(6).click();
      await pg.waitForTimeout(1400);
      row.columnsWithKit = await cols(pg);
      if (vw === 1680) await pg.screenshot({ path: `${OUT}/final-1680-kits-built.png` });
    } else if (vw === 1680) {
      await pg.screenshot({ path: `${OUT}/final-1680-${tab.split(" ")[0].toLowerCase()}.png` });
    }
    rows.push(row);
    await pg.close();
  }
}

await b.close();
console.table(rows);
if (errs.length) console.log("page errors:\n" + errs.join("\n"));

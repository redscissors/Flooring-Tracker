// Shoots the Apps hub at a spread of widths: the nav rail, the embedded wedi
// configurator's Custom shower tab (the header under review), and the build column.
//   node .scratch/075_wedi-header-and-shrink/shoot.mjs <label>
import { chromium } from "playwright";

const OUT = ".scratch/075_wedi-header-and-shrink/shots";
const LABEL = process.argv[2] || "before";
const URL = "http://127.0.0.1:5199/.scratch/075_wedi-header-and-shrink/hub.html";
const WIDTHS = [1680, 1280, 1024, 860, 720];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const errs = [];

for (const w of WIDTHS) {
  const pg = await b.newPage({ viewport: { width: w, height: 940 }, deviceScaleFactor: 1.5 });
  pg.on("console", (m) => { if (m.type() === "error") errs.push(w + ": " + m.text()); });
  pg.on("pageerror", (e) => errs.push(w + ": " + String(e)));
  await pg.goto(URL, { waitUntil: "load" });
  await pg.waitForTimeout(900);

  // Under 1100 the rail is a drawer: shoot the folded state, then open it.
  const back = pg.locator("button[title='Back to the app list']");
  if (await back.count()) {
    await pg.screenshot({ path: `${OUT}/${LABEL}-${w}-rail-folded.png` });
    await back.click();
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: `${OUT}/${LABEL}-${w}-rail-drawer.png` });
  }

  await pg.locator("nav button", { hasText: "wedi configurator" }).click();
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `${OUT}/${LABEL}-${w}-wedi-kits.png` });

  await pg.locator(".modetab", { hasText: "Custom shower" }).click();
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: `${OUT}/${LABEL}-${w}-custom.png` });

  const form = pg.locator(".roomform");
  if (await form.count()) await form.screenshot({ path: `${OUT}/${LABEL}-${w}-header.png` });

  await pg.close();
}

await b.close();
console.log(errs.length ? "console errors:\n" + errs.join("\n") : "clean");

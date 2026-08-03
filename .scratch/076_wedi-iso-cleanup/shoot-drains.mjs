// The pan label vs the drain box across the three drain shapes.
//   node .scratch/076_wedi-iso-cleanup/shoot-drains.mjs <label>
import { chromium } from "playwright";
const OUT = ".scratch/076_wedi-iso-cleanup/shots";
const LABEL = process.argv[2] || "after2";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);

const shots = [
  ["offset", "US9100005"],   // offset point drain, off the pan centre
  ["linear", "US9310001"],   // channel drain
  ["module", "US9320003"],   // Riolito neo module
  ["center", "US9100016"],   // 6' x 6' centre drain — the big-piece case
];
for (const [tag, key] of shots) {
  await pg.locator(`[data-wedi-pan="${key}"]`).click();
  await pg.waitForTimeout(1000);
  await pg.locator(".diagcol svg").first().screenshot({ path: `${OUT}/${LABEL}-6-drain-${tag}.png` });
}
await b.close();

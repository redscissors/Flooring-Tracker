// The Kits tab as it stands: the note box, one pan card, and how tall the whole
// grid of families runs. Half the card is the target, so measure the card.
import { chromium } from "playwright";

const OUT = ".scratch/075_wedi-header-and-shrink/shots";
const URL = "http://127.0.0.1:5199/.scratch/075_wedi-header-and-shrink/hub.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const rows = [];

for (const w of [1680, 1280, 1024]) {
  const pg = await b.newPage({ viewport: { width: w, height: 940 }, deviceScaleFactor: 1.5 });
  await pg.goto(URL, { waitUntil: "load" });
  await pg.waitForTimeout(700);
  const back = pg.locator("button[title='Back to the app list']");
  if (await back.count()) { await back.click(); await pg.waitForTimeout(300); }
  await pg.locator("nav button", { hasText: "wedi configurator" }).click();
  await pg.waitForTimeout(1200);

  const note = await pg.locator(".kitnote").evaluate((el) => Math.round(el.getBoundingClientRect().height)).catch(() => 0);
  const card = await pg.locator(".pancard").first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  const perRow = await pg.locator(".cards").first().evaluate((el) => {
    const tops = [...el.children].map((c) => c.getBoundingClientRect().top);
    return tops.filter((t) => Math.abs(t - tops[0]) < 2).length;
  });
  const total = await pg.locator(".main").evaluate((el) => el.scrollHeight);
  rows.push({ viewport: w, noteH: note, cardW: card.w, cardH: card.h, cardsPerRow: perRow, tabScrollH: total });
  await pg.screenshot({ path: `${OUT}/kits-before-${w}.png` });
  await pg.close();
}

await b.close();
console.table(rows);

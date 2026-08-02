// Each Kits variant: a screenshot plus the two numbers that decide it — how
// tall one card is, and how tall the whole tab scrolls (which is what "aim for
// half" really means to someone hunting for a 60×60).
import { chromium } from "playwright";

const OUT = ".scratch/075_wedi-header-and-shrink/shots";
const URL = "http://127.0.0.1:5199/.scratch/075_wedi-header-and-shrink/kitsproto.html";
const KEYS = ["today", "k1", "k2", "k3", "k4"];

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const rows = [];

for (const k of KEYS) {
  const pg = await b.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  await pg.goto(URL + "?k=" + k, { waitUntil: "load" });
  await pg.waitForTimeout(1800);
  const card = await pg.locator(".pancard").first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
  const scrollH = await pg.locator(".main").evaluate((el) => el.scrollHeight);
  const firstFam = await pg.locator(".fam").first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
  rows.push({ variant: k, cardH: card, firstFamilyH: firstFam, wholeTabScrollH: scrollH });
  await pg.locator(".main").screenshot({ path: `${OUT}/kits-${k}.png` });
  await pg.close();
}

await b.close();
console.table(rows);

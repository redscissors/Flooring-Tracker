// Shoots the masthead prototypes. `npx vite --port 5199` first.
// Usage: node header-shot.mjs
// Two passes: screen media (the on-screen Print preview) and print media (what
// actually goes to the printer, where the mono-ink remap in index.css bites).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const OUT = "/home/user/Flooring-Tracker/.scratch/090_print-fit-one-page";
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 800, height: 1400 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto("http://localhost:5199/.scratch/090_print-fit-one-page/header-proto.html", { waitUntil: "networkidle" });
await page.waitForTimeout(700);

// The reference clip: the real sheet's masthead + customer grid, nothing below.
// page.screenshot({clip}) takes DOCUMENT coordinates, so the scroll offset has
// to go back in — a fullPage shot earlier in the run leaves the page scrolled.
const todayClip = async () => page.evaluate(() => {
  const paper = document.querySelector('[data-shot="today"]');
  const kids = [...paper.firstElementChild.children].slice(0, 2);
  const box = paper.getBoundingClientRect();
  const bottom = kids[1].getBoundingClientRect().bottom;
  return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: bottom - box.y + 8 };
});

const heights = await page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll("[data-shot^='v-']")].map((el) => [el.dataset.shot, Math.round(el.firstElementChild.getBoundingClientRect().height)])
));
const today = await page.evaluate(() => {
  const kids = [...document.querySelector('[data-shot="today"]').firstElementChild.children].slice(0, 2);
  return kids.map((el) => Math.round(el.getBoundingClientRect().height));
});
console.log(`today: ${today[0] + today[1]}px (masthead ${today[0]} + grid ${today[1]})`);
console.log(heights);

// Variant D's project-name width budget: the name now owns the second row's
// center cell, flanked by the customer and salesperson stacks. Its budget is
// the row width minus the two stacks' natural widths and gaps. Convert to a
// character cap by measuring real Manrope 800 glyphs — a WIDE reference name
// (no dot-width padding tricks) so the cap holds for worst-ish names.
const budget = await page.evaluate(() => {
  const name = document.querySelector("[data-mast-name]");
  const row = name.parentElement;
  const [cust, , sp] = row.children;
  const ctx0 = document.createElement("canvas").getContext("2d");
  // The flank cells are 1fr (stretched) — their real footprint is the widest
  // LINE they contain, measured with each line's own font.
  const natural = (cell) => Math.max(...[...cell.children].map((d) => {
    ctx0.font = getComputedStyle(d).font;
    return ctx0.measureText(d.textContent).width;
  }));
  const avail = row.getBoundingClientRect().width - natural(cust) - natural(sp) - 2 * 18;
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = getComputedStyle(name).font;
  const wide = "Hammond Woodworks LLC";       // ~average-to-wide real name
  const perChar = ctx.measureText(wide).width / wide.length;
  const caps = "SHOWROOM REMODEL MAIN";       // all-caps worst case
  const perCharCaps = ctx.measureText(caps).width / caps.length;
  return { avail: Math.round(avail), perChar: +perChar.toFixed(2), perCharCaps: +perCharCaps.toFixed(2), fit: Math.floor(avail / perChar), fitCaps: Math.floor(avail / perCharCaps) };
});
console.log(`name budget: center cell ${budget.avail}px`);
console.log(`  ≈ ${budget.fit} chars mixed-case (${budget.perChar}px/ch) · ${budget.fitCaps} chars ALL-CAPS (${budget.perCharCaps}px/ch)`);

const shoot = async (tag) => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${OUT}/header-today-${tag}.png`, clip: await todayClip() });
  for (const v of ["v-a", "v-b", "v-c", "v-d"]) {
    await page.locator(`[data-shot="${v}"]`).screenshot({ path: `${OUT}/header-${v}-${tag}.png` });
  }
  await page.screenshot({ path: `${OUT}/header-all-${tag}.png`, fullPage: true });
};

await shoot("screen");
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(300);
await shoot("print");

await browser.close();

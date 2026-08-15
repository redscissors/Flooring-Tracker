// Measures where the printed estimate's vertical space goes, and how many
// pages the sheet actually takes. `npx vite --port 5199` first.
// Usage: node measure.mjs [label] [--zoom=0.85]
//
// Letter at 96dpi is 816 x 1056px; index.css sets @page{margin:1.4cm} = 52.9px
// a side, so the printable box is ~710 x 950px. The harness renders the real
// print wrapper at that width, in print media, then PDFs it for a true count.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const LABEL = (process.argv[2] || "baseline").replace(/^--.*/, "baseline");
const ZOOM = Number((process.argv.find((a) => a.startsWith("--zoom=")) || "").split("=")[1] || 0);
const EXTRA_CSS = (process.argv.find((a) => a.startsWith("--css=")) || "").split("=").slice(1).join("=");
const OUT = "/home/user/Flooring-Tracker/.scratch/090_print-fit-one-page";
const PAGE_H = 1056 - 2 * 52.9; // printable height between the @page margins

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 710, height: 1200 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

await page.goto("http://localhost:5199/.scratch/090_print-fit-one-page/preview.html", { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
if (ZOOM) await page.addStyleTag({ content: `@media print{ [data-shot="paper"]{ zoom:${ZOOM} } }` });
if (EXTRA_CSS) await page.addStyleTag({ content: EXTRA_CSS });

// --areas=N: keep only the first N area blocks, to price a smaller job.
const AREAS = Number((process.argv.find((a) => a.startsWith("--areas=")) || "").split("=")[1] || 0);
if (AREAS) {
  await page.evaluate((n) => {
    const paper = document.querySelector('[data-shot="paper"] > div');
    const kids = [...paper.children];
    const last = kids.findIndex((el) => el.textContent.startsWith("Extras"));
    kids.slice(2 + n, last).forEach((el) => el.remove());
  }, AREAS);
}

// --cols=N: flow the AREA blocks (everything between the customer grid and the
// Extras block) down N newspaper columns, the way the Extras block already
// flows its own two columns.
const COLS = Number((process.argv.find((a) => a.startsWith("--cols=")) || "").split("=")[1] || 0);
if (COLS) {
  await page.evaluate((n) => {
    const paper = document.querySelector('[data-shot="paper"] > div');
    const kids = [...paper.children];
    const first = 2, last = kids.findIndex((el) => el.textContent.startsWith("Extras"));
    const wrap = document.createElement("div");
    wrap.style.cssText = `columns:${n};column-gap:20px;column-fill:balance`;
    paper.insertBefore(wrap, kids[first]);
    kids.slice(first, last).forEach((el) => wrap.appendChild(el));
  }, COLS);
}
await page.waitForTimeout(500);

const blocks = await page.evaluate(() => {
  const paper = document.querySelector('[data-shot="paper"] > div');
  return [...paper.children].map((el) => ({
    h: Math.round(el.getBoundingClientRect().height),
    text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 46),
  }));
});
const total = await page.evaluate(() => Math.round(document.querySelector('[data-shot="paper"]').getBoundingClientRect().height));

const pdf = await page.pdf({ path: `${OUT}/sheet-${LABEL}.pdf`, format: "letter", printBackground: true, preferCSSPageSize: true });
const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

const rows = blocks.map((b) => `${String(b.h).padStart(5)}px  ${((b.h / total) * 100).toFixed(1).padStart(5)}%  ${b.text}`);
const report = [
  `— ${LABEL}${ZOOM ? ` (zoom ${ZOOM})` : ""} —`,
  `printable page box: 710 x ${Math.round(PAGE_H)}px`,
  `paper height: ${total}px  =  ${(total / PAGE_H).toFixed(2)} pages of content`,
  `PDF pages: ${pages}`,
  "",
  "top-level blocks:",
  ...rows,
].join("\n");
console.log(report);
writeFileSync(`${OUT}/measure-${LABEL}.txt`, report + "\n");

await page.screenshot({ path: `${OUT}/shot-${LABEL}.png`, fullPage: true });
await browser.close();

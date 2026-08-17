// Same rig as 090_print-fit-one-page/measure.mjs, pointed at the 091 harness.
// `npx vite --port 5199` first. Usage: node measure.mjs [label]
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const LABEL = (process.argv[2] || "baseline").replace(/^--.*/, "baseline");
const OUT = "/home/user/Flooring-Tracker/.scratch/091_print-type-label-tighter";
const PAGE_H = 1056 - 2 * 52.9;

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 710, height: 1200 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

await page.goto("http://localhost:5199/.scratch/091_print-type-label-tighter/preview.html", { waitUntil: "networkidle" });
await page.emulateMedia({ media: "print" });
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
  `— ${LABEL} —`,
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

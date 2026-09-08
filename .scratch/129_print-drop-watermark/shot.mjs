// Production proof for the selection-sheet masthead + watermark: the REAL
// EstimatePaper (after the change) over the 090 fixture, in screen media (the
// Preview tab) and print media (page 1 + 2 at page offsets, so the fixed
// watermark lands where it lands on paper), plus the PDF page count.
// `npx vite --port 5199` from the repo root first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const OUT = "/home/user/Flooring-Tracker/.scratch/129_print-drop-watermark";
const PAGE_H = 950;
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 726, height: PAGE_H }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:5199/.scratch/128_print-selection-sheet/preview.html", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.emulateMedia({ media: "screen" });
await page.screenshot({ path: `${OUT}/sheet-screen.png`, fullPage: true });
const wm = await page.evaluate(() => document.querySelectorAll(".ft-pwm-screen").length);
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(150);
for (const n of [1, 2]) {
  await page.evaluate((y) => window.scrollTo(0, y), (n - 1) * PAGE_H);
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${OUT}/sheet-print-p${n}.png` });
}
const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
const doc = await getDocument({ data: new Uint8Array(pdf) }).promise;
const head = await page.evaluate(() => { const paper = document.querySelector("[data-shot=paper]"); return Math.round(paper.querySelector(".ft-pband").getBoundingClientRect().top - paper.getBoundingClientRect().top); });
console.log(`pages ${doc.numPages} · screen watermark copies ${wm} · header ${head}px`);
await browser.close();

// Shoots every masthead × watermark combination. `npx vite --port 5199` first.
// Usage: node shot.mjs
// Per combo: screen media full sheet (the on-screen Print preview), print media
// page 1 and page 2 as the printer sees them (viewport-sized shots at page
// offsets, so the position:fixed watermark lands where it lands on paper), and
// a Letter PDF (kept in memory) for the authoritative page count (pdfjs).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

const OUT = "/home/user/Flooring-Tracker/.scratch/126_print-selection-sheet-protos";
const BASE = "http://localhost:5199/.scratch/126_print-selection-sheet-protos/proto.html";
const PAGE_H = 950, W = 726; // 710 paper + p-2 padding
// Round 1 shot today/A/B × none/outline/fill; round 2 shoots the A variants.
const ROUND = process.argv[2] || "2";
const COMBOS = ROUND === "1"
  ? [["today", "none"], ["A", "none"], ["A", "outline"], ["A", "fill"], ["B", "none"], ["B", "outline"], ["B", "fill"]]
  : [["A1", "none"], ["A1", "outline"], ["A2", "none"], ["A2", "outline"], ["A3", "none"], ["A3", "outline"]];

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: W, height: PAGE_H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

for (const [v, wm] of COMBOS) {
  const tag = `${v}-${wm}`;
  await page.goto(`${BASE}?v=${v}&wm=${wm}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: `${OUT}/${tag}-screen.png`, fullPage: true });

  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(150);
  for (const n of [1, 2]) {
    await page.evaluate((y) => window.scrollTo(0, y), (n - 1) * PAGE_H);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/${tag}-print-p${n}.png` });
  }
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const doc = await getDocument({ data: new Uint8Array(pdf) }).promise;
  const head = await page.evaluate(() => {
    const paper = document.querySelector('[data-shot="paper"]');
    const band = paper.querySelector(".ft-pband");
    return Math.round(band.getBoundingClientRect().top - paper.getBoundingClientRect().top - 8);
  });
  console.log(`${tag}: ${doc.numPages} pages · header ${head}px`);
}
await browser.close();

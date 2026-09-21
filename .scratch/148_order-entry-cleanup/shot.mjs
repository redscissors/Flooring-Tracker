// Preview proof (issue 148): the REAL OrderEntryPanel over the harness's ERP
// fixtures. Vite on :5199 (npx vite --port 5199), then
//   node .scratch/148_order-entry-cleanup/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const shot = async (state, file, { width = 1280, height = 1400, act } = {}) => {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", state, e.message));
  await page.goto(`http://localhost:5199/order-entry-preview.html?state=${state}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  if (act) await act(page);
  await page.screenshot({ path: join(dir, file), fullPage: false });
  console.log("shot", file);
  await page.close();
};
// focus.png — numbered project, no order: the field is focused on open and
// shows the gray "ERP #" placeholder; typed.png — the number typed with no
// click first, proving the focus (the harness adds it on Enter).
await shot("none", "focus.png", { act: async (p) => {
  console.log("focused:", await p.evaluate(() => document.activeElement?.getAttribute("aria-label")));
} });
await shot("none", "typed.png", { act: async (p) => { await p.keyboard.type("48213"); await p.waitForTimeout(150); } });
// keyed.png — one order, four stamped lines: flat rows, the copied ones pale
// moss in both lists, one wedi band and one Schluter band.
await shot("one", "keyed.png");
// copy-all.png — Copy remaining: every stock line tinted.
await shot("one", "copy-all.png", { act: async (p) => { await p.click("button:has-text('Copy remaining')"); await p.waitForTimeout(300); } });
// compact.png — the Compact view: flat rows and the tint in its one run.
await shot("one", "compact.png", { act: async (p) => { await p.click("button:has-text('Compact')"); await p.waitForTimeout(200); } });
await shot("one", "fold.png", { width: 420 });
await browser.close();

// Screenshot run for the change-control preview. `npx vite --port 5199` first.
// Usage: node shot.mjs <prefix>   (e.g. "before" / "after")
// Shoots each fixture three ways: screen media (the on-screen preview),
// print media (what goes to the printer), and print media through a
// grayscale filter (how a mono laser sees it).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_LIB || "playwright-core");

const PREFIX = process.argv[2] || "shot";
const URL = "http://localhost:5199/.scratch/085_print-mono-ink/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/085_print-mono-ink";

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1600 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const shoot = async (tag) => {
  for (const shot of ["plain", "options"]) {
    await page.locator(`[data-shot="${shot}"]`).screenshot({ path: `${OUT}/${PREFIX}-${shot}-${tag}.png` });
  }
};

await shoot("screen");
await page.emulateMedia({ media: "print" });
await page.waitForTimeout(200);
await shoot("print");
await page.addStyleTag({ content: `[data-shot]{filter:grayscale(1)}` });
await page.waitForTimeout(200);
await shoot("print-gray");

await browser.close();
console.log("done:", PREFIX);

// npx vite --port 5199 ; node .scratch/166_print-joborder-heading/shot.mjs <name>
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] || "after";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 816, height: 1400 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://localhost:5199/.scratch/166_print-joborder-heading/preview.html", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
console.log("shot", name, /job order/i.test(await page.locator('[data-shot="paper"]').innerText()) ? "HAS heading" : "no heading");
await browser.close();

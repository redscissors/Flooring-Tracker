// Screenshot run for the change-control preview. `npx vite --port 5199` first.
// Shoots the numbered + unnumbered fixtures in screen media (the on-screen
// Print preview) and print media (what goes to the printer, ink-only).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_LIB || "playwright-core");

const URL = "http://localhost:5199/.scratch/088_project-numbers/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/088_project-numbers";

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1600 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
for (const media of ["screen", "print"]) {
  await page.emulateMedia({ media });
  for (const shot of ["numbered", "unnumbered"]) {
    const el = page.locator(`[data-shot="${shot}"]`);
    await el.screenshot({ path: `${OUT}/${shot}-${media}.png` });
  }
}
await browser.close();
console.log("done");

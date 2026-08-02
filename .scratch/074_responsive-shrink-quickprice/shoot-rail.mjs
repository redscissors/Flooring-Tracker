import { chromium } from "playwright";
const PAGE = "http://localhost:5199/.scratch/074_responsive-shrink-quickprice/app-preview.html";
const dir = "/home/user/Flooring-Tracker/.scratch/074_responsive-shrink-quickprice/shots/";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const w of [1440, 820]) {
  const p = await b.newPage({ viewport: { width: w, height: 820 }, deviceScaleFactor: 3 });
  await p.goto(PAGE, { waitUntil: "networkidle" });
  await p.waitForTimeout(1600);
  await p.locator("aside").first().screenshot({ path: `${dir}rail-${w}.png` });
  console.log("rail", w);
  await p.close();
}
await b.close();

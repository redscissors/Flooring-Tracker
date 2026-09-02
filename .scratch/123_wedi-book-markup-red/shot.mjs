// Screenshot drive for the change-control preview. `PORT=5199 npx vite` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const OUT = "/home/user/Flooring-Tracker/.scratch/123_wedi-book-markup-red";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto("http://127.0.0.1:5199/preview.html", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const cases = page.locator("p.ft-eyebrow");
const n = await cases.count();
console.log("cases:", n);
// the two markup cases: the plain no-markup book (red) and the wedi-shaped one
for (const [i, name] of [[2, "vtc-no-markup"], [3, "wedi-publishes-retail"]]) {
  const card = cases.nth(i).locator("xpath=following-sibling::div[1]");
  await card.getByRole("button", { name: /^Markup/ }).first().click().catch(() => {});
  await page.waitForTimeout(300);
  await card.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot", name, (await card.innerText()).split("\n").filter((l) => /markup|retail|cost/i.test(l)).slice(0, 6).join(" | "));
}
await browser.close();

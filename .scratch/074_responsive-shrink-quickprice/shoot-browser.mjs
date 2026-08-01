// Customer browser: the salesperson box defaulting to the signed-in salesman,
// and its roster dropdown.
import { chromium } from "playwright";

const PAGE = "http://localhost:5199/.scratch/074_responsive-shrink-quickprice/app-preview.html";
const dir = new URL("./shots/", import.meta.url).pathname;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("  page error:", String(e)));
await page.goto(PAGE, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);

await page.getByTitle("Browse all customers").click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${dir}browser-default.png` });

await page.getByTitle("Pick a salesperson").click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${dir}browser-roster.png` });
console.log("  browser shots done");
await browser.close();

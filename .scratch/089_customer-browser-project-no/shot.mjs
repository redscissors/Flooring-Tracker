// Screenshot run for the change-control preview. `npx vite --port 5199` first.
// Shoots the REAL customer browser three ways: the grid as it opens, the grid
// with the drafts strip + project lines open, and a number search.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_LIB || "playwright-core");

const URL = "http://localhost:5199/.scratch/089_customer-browser-project-no/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/089_customer-browser-project-no";

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/grid.png` });

await page.getByRole("button", { name: /Estimates & drafts/ }).click();
await page.getByText("Kathy Marsh").click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/lines-and-drafts.png` });

await page.getByPlaceholder("Name, phone, address…").fill("214");
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/search-n214.png` });

await browser.close();
console.log("done");

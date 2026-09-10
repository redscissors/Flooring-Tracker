// Preview proof (issue 133): the REAL App over the fake client. Shot 1 — an
// Employee job's extras strip: costed grout/backer repriced, uncosted mortar
// and caulk marked Retail. Shot 2 — Settings → Materials & add-ons → the grout
// editor's Cost box. Vite on :5199:
//   npx vite --config .scratch/133_extras-employee-cost/vite.config.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
await page.goto("http://localhost:5199/.scratch/133_extras-employee-cost/preview.html", { waitUntil: "networkidle" });
await page.waitForSelector("[data-prod-card]", { timeout: 15000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
const shot = async (name, loc = page) => { await page.waitForTimeout(250); await loc.screenshot({ path: join(dir, name) }); console.log("shot", name); };
const card = page.locator("[data-prod-card]").first();
console.log("card:", (await card.innerText()).replace(/\n+/g, " | ").slice(0, 400));
await shot("1-employee-extras.png");
// Settings → Materials & add-ons (the sidebar button presets the section).
const settingsBtn = page.getByRole("button", { name: /^Settings$/ }).first();
if (!(await settingsBtn.isVisible())) await page.locator("button:has(svg.lucide-menu)").first().click();
await settingsBtn.click();
await page.getByText("PermaColor Select", { exact: true }).first().click();
await page.waitForTimeout(400);
const costBox = page.locator("label", { hasText: /^Cost$/ }).first();
console.log("cost boxes:", await page.locator("label", { hasText: /^Cost$/ }).count(), "grout cost value:", await costBox.locator("xpath=following-sibling::input").inputValue());
await shot("2-settings-cost.png");
await browser.close();

// Preview proof (issue 161): the REAL App over the fake client. Vite on :5198:
//   npx vite --config .scratch/161_grout-base-options/vite.config.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const URL = "http://localhost:5198/.scratch/161_grout-base-options/preview.html";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("[data-prod-card]", { timeout: 15000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
const shot = async (name, opts = {}) => { await page.waitForTimeout(300); await page.screenshot({ path: join(dir, name), ...opts }); console.log("shot", name); };

// 1 — the first row's grout pop-up: Base chip after the joint width.
await page.locator("[data-mats-pill]").first().click();
await page.waitForTimeout(500);
console.log("base chip:", await page.locator("text=/^Base: /").first().innerText());
await shot("1-row-base-chip.png");
// 2 — the chip open: ★ default + the Commercial unit.
await page.locator("text=/^Base: /").first().click();
await page.waitForTimeout(500);
await shot("2-base-dropdown.png");
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
// 3 — tick Grout on the third row: it starts on the remembered SpectraLOCK PRO + Commercial.
await page.locator("[data-mats-pill]").nth(2).click();
await page.waitForTimeout(400);
await page.locator('button[title="Add grout"]').first().click();
await page.waitForTimeout(600);
console.log("third row base:", await page.locator("text=/^Base: /").first().innerText());
await shot("3-tick-remembers.png");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
// 4 — Extras: the three rows' kits share Commercial units across colors.
const extras = page.locator("text=Order summary").first();
await extras.scrollIntoViewIfNeeded();
console.log("extras grout:", (await page.locator("text=/Commercial Unit/i").allInnerTexts()).join(" | "));
await shot("4-extras.png");
// 4b — the printed estimate's Extras lists the Commercial unit with its SKU.
await page.getByText("Print preview", { exact: true }).first().click();
await page.waitForTimeout(800);
await page.evaluate(() => { const el = [...document.querySelectorAll("div")].reverse().find((d) => d.textContent.trim() === "Extras" && d.offsetParent); el?.scrollIntoView({ block: "start" }); });
await shot("4b-print-extras.png");
await page.getByText("Edit", { exact: true }).first().click();
await page.waitForTimeout(400);
// 5 — Settings → SpectraLOCK PRO: the base list.
const settingsBtn = page.getByRole("button", { name: /^Settings$/ }).first();
if (await settingsBtn.count() && await settingsBtn.isVisible()) await settingsBtn.click();
else { await page.locator("button[aria-label='Settings']").first().click(); }
await page.waitForTimeout(500);
const mat = page.getByText("Materials & add-ons", { exact: true }).first();
if (await mat.count()) await mat.click();
await page.waitForTimeout(500);
await page.getByText("SpectraLOCK PRO", { exact: true }).first().click();
await page.waitForTimeout(600);
await shot("5-settings-bases.png");
// 6 — the phone row sheet carries the same chip.
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await phone.goto(URL, { waitUntil: "networkidle" });
await phone.waitForTimeout(1500);
await phone.getByText("Daltile Volume 1.0 — Ash").first().click();
await phone.waitForTimeout(800);
const chip = phone.locator("text=/^Base: /").first();
if (await chip.count()) { await chip.scrollIntoViewIfNeeded(); console.log("phone chip:", await chip.innerText()); }
await phone.waitForTimeout(300);
await phone.screenshot({ path: join(dir, "6-phone-sheet.png") });
console.log("shot 6-phone-sheet.png");
await browser.close();

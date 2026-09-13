// Preview proof (issue 134): the REAL App over the fake client. Vite on :5199:
//   npx vite --config .scratch/134_grout-special-order-colors/vite.config.mjs
// Shot 1 — the job: a stocked color and a special-order color on two rows, the
// row chip and the order-summary badge; the console logs the grouped dropdown.
// Shot 2 — Order entry: the special-order color files with the special orders.
// Shot 3 — Settings → the grout's color list with SO badges + the source line.
// Shot 4 — the "Special-order colors" source dialog with its preview.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
await page.goto("http://localhost:5199/.scratch/134_grout-special-order-colors/preview.html", { waitUntil: "networkidle" });
await page.waitForSelector("[data-prod-card]", { timeout: 15000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
const shot = async (name, loc = page) => { await page.waitForTimeout(250); await loc.screenshot({ path: join(dir, name) }); console.log("shot", name); };
// Open the second row's materials box (the strip toggles it), then read the
// color dropdown's groups straight from the DOM.
await page.locator("text=Midnight Black").first().click();
await page.waitForTimeout(500);
const groups = await page.evaluate(() => [...document.querySelectorAll("select")].filter((s) => [...s.options].some((o) => o.value === "Midnight Black")).map((s) =>
  [...s.children].map((c) => c.tagName === "OPTGROUP" ? `${c.label}: ${[...c.children].map((o) => o.value).join(", ")}` : c.value).join(" | ")));
console.log("color dropdown:", groups[0]);
console.log("row chips:", await page.locator("text=special order").count());
await shot("1-job-rows.png");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await page.getByRole("button", { name: /Order entry/ }).first().click({ force: true });
await page.waitForTimeout(500);
console.log("special rows:", (await page.locator("text=Special order ·").first().innerText()));
await shot("2-order-entry.png");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const settingsBtn = page.getByRole("button", { name: /^Settings$/ }).first();
if (!(await settingsBtn.isVisible())) await page.locator("button:has(svg.lucide-menu)").first().click();
await settingsBtn.click();
await page.getByText("SpectraLOCK 1", { exact: true }).first().click();
await page.waitForTimeout(500);
console.log("SO badges:", await page.locator("span", { hasText: /^SO$/ }).count());
console.log("source line:", await page.locator("text=/special-order colors? from/").first().innerText());
await shot("3-settings-colors.png");
await page.getByRole("button", { name: "Change…" }).click();
await page.waitForTimeout(600);
console.log("dialog preview:", await page.locator("text=/rows match/").first().innerText());
await shot("4-source-dialog.png");
await browser.close();

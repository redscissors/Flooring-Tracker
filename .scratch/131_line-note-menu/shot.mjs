// Preview proof: the REAL App (fake client) — the ⋯ menu on the misc line
// with "Add note", the note box it reveals on the misc row, then the same
// on the tile line where the note sits in the extras strip. Vite on :5199.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text().slice(0, 200)); });
await page.goto("http://localhost:5199/.scratch/131_line-note-menu/preview.html", { waitUntil: "networkidle" });
await page.waitForSelector("[data-prod-card]", { timeout: 15000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(dir, name) }); console.log("shot", name); };
const cards = page.locator("[data-prod-card]");
console.log("rows", await cards.count());
await shot("1-job-sheet.png");
const dots = (i) => cards.nth(i).locator('button[title^="Line menu"]');
// misc line (row 1): click ⋯ → menu with "Add note"
await dots(1).click();
await page.waitForSelector("text=Add note");
await shot("2-misc-menu-add-note.png");
await page.click("text=Add note");
await page.waitForTimeout(200);
console.log("focused placeholder:", await page.evaluate(() => document.activeElement?.placeholder));
await page.keyboard.type("Customer will meet the truck — call 30 min ahead");
await shot("3-misc-note-typed.png");
await page.keyboard.press("Tab");
await dots(1).click();
await page.waitForSelector("text=Edit note");
await shot("4-misc-menu-edit-note.png");
await page.keyboard.press("Escape");
// tile line (row 0): the same item, note lands under the extras strip
await dots(0).click();
await page.waitForSelector("text=Add note");
await page.click("text=Add note");
await page.waitForTimeout(200);
await page.keyboard.type("Stagger 1/3, not 1/2");
await shot("5-tile-note-in-extras.png");
// abandon an empty note: the box hides again
await dots(1).click(); await page.click("text=Edit note"); await page.waitForTimeout(150);
await page.keyboard.press("Control+A"); await page.keyboard.press("Backspace"); await page.keyboard.press("Tab");
await page.waitForTimeout(200);
console.log("misc note boxes after clearing:", await cards.nth(1).locator('input[placeholder="note…"]').count());
await shot("6-misc-note-cleared-hidden.png");
// the misc note carries through to the printed estimate
await dots(1).click(); await page.click("text=Add note"); await page.waitForTimeout(150);
await page.keyboard.type("Customer will meet the truck"); await page.keyboard.press("Tab");
await page.click("text=Print preview"); await page.waitForTimeout(600);
await shot("7-print-preview-misc-note.png");
await browser.close();

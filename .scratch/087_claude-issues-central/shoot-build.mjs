// Screenshot the REAL components via the claude-issues-preview.html dev
// harness (vite dev must be running on PORT). Preview proof for the 087 build.
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
await page.goto(`http://localhost:${port}/claude-issues-preview.html`);
await page.waitForSelector("[data-stage='menu']");
const shot = async (name) => { await page.waitForTimeout(300); await page.screenshot({ path: join(dir, name) }); };

// The Claude tab as it boots (seeded issues, all three source kinds + a done one)
await shot("R1-claude-tab.png");

// Team tab untouched
await page.click("text=Team list");
await shot("R2-team-tab.png");
await page.click("text=Claude (3)");

// The real line menu
await page.click("[data-stage='menu']");
await shot("R3-line-menu.png");
await page.keyboard.press("Escape");

// Move-to-area expanded inline
await page.click("[data-stage='menu']");
await page.click("text=Move to area");
await shot("R4-move-submenu.png");
await page.keyboard.press("Escape");

// The flag popover with a job-line context; add with chip + note
await page.click("[data-stage='flag-job']");
await page.click("text=Wrong size / coverage");
await page.fill("textarea", "Carton label at the shop says 17.6, book says 15.5.");
await shot("R5-flag-popover-job.png");
await page.click("text=Add to Claude issues");
await shot("R6-added-to-bucket.png");

// The book-row context variant
await page.click("[data-stage='flag-book']");
await shot("R7-flag-popover-book.png");

await browser.close();

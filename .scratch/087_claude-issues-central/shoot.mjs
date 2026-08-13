// Screenshot the prototype's key states for the issue README (preview proof).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1100, height: 860 } });
await page.goto("file://" + join(dir, "prototype.html"));

const shot = async (name) => { await page.waitForTimeout(250); await page.screenshot({ path: join(dir, name), fullPage: false }); };

await shot("A1-job-sheet.png");

// open the row menu via the ⋯ on the first row
await page.click('[data-dots="0"]');
await shot("A2-line-menu.png");

// open the flag dialog, tick a chip, type a note
await page.click("#miFlag");
await page.click("#quickChips .qc:nth-child(2)");
await page.fill("#noteBox", "Wrong size / coverage. Carton label at the shop says 17.6, book says 15.5.");
await shot("A3-flag-dialog.png");

// add it → toast over the sheet
await page.click("#dlgAdd");
await shot("A4-toast-flagged-row.png");

// the central bucket with the new issue on top
await page.click("#toastView");
await shot("B1-claude-tab.png");

// team tab untouched
await page.click("#teamTab");
await shot("B2-team-tab.png");
await page.click("#claudeTab");

// scene 3
await page.click('[data-scene="s3"]');
await shot("C1-other-flag-points.png");
await page.click("#bookFlag");
await shot("C2-book-flag-dialog.png");

await browser.close();

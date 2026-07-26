import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const dir = new URL(".", import.meta.url).pathname;
const page0 = "http://localhost:8392/.scratch/054_quick-markups-settings/proof.html"; // serve proof-dist: python3 -m http.server 8392

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1180, height: 1150 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.log("[console]", m.text()));
await page.goto(page0);
await page.waitForTimeout(700);

const priceCell = page.locator('[data-testid="price"] input[data-c="price"]');
const chips = page.locator('input[aria-label^="Quick markup"]');
const popupButtons = () => page.locator('button[title^="Price at cost + "]').allTextContents();

// 1 — the shipped defaults, in the card and in the popup.
await priceCell.click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${dir}01-defaults.png`, fullPage: true });
console.log("defaults in popup:", (await popupButtons()).join(" "));
await page.keyboard.press("Escape");

// 2 — retune the list the way the shop would: 30 -> 25, 50 -> 45, add 75 and 125.
await chips.nth(0).fill("25");
await chips.nth(1).fill("45");
await page.getByTitle("Add another markup button").click();
await page.waitForTimeout(120);
await chips.nth(3).fill("75");
await page.getByTitle("Add another markup button").click();
await page.waitForTimeout(120);
await chips.nth(4).fill("125");
await page.waitForTimeout(200);
await page.screenshot({ path: `${dir}02-retuned-card.png`, fullPage: true });

// 3 — the popup, unreloaded, now offers exactly that list (and wraps at five).
await priceCell.click();
await page.waitForTimeout(300);
await page.keyboard.type("4.00");
await page.waitForTimeout(150);
await page.getByTitle("Price at cost + 125%").click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${dir}03-popup-follows.png`, fullPage: true });
const after = await popupButtons();
console.log("after retune  :", after.join(" "));
await page.keyboard.press("Escape");

// 4 — clear the list entirely: the buttons go, the % box stays usable.
for (let i = 0; i < 5; i++) { await page.getByTitle("Remove this button").first().click(); await page.waitForTimeout(80); }
await priceCell.click();
await page.waitForTimeout(300);
await page.locator('input[title="Any other markup"]').fill("62");
await page.waitForTimeout(250);
await page.screenshot({ path: `${dir}04-empty-list-still-usable.png`, fullPage: true });
const empty = await popupButtons();
console.log("cleared       :", empty.length ? empty.join(" ") : "(no preset buttons — % box only)");

const pass =
  after.join(",") === "+25%,+45%,+100%,+75%,+125%" &&
  empty.length === 0;
console.log(pass ? "settings -> popup: wiring confirmed" : "settings -> popup: MISMATCH");

await browser.close();

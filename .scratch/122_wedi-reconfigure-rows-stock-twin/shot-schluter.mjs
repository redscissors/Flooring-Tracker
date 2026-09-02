// Screenshot drive for the change-control preview. `npx vite --port 5199` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const OUT = "/home/user/Flooring-Tracker/.scratch/122_wedi-reconfigure-rows-stock-twin";
const must = (ok, msg) => { if (!ok) throw new Error("ASSERT: " + msg); console.log("ok —", msg); };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 2000, height: 1000 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text()); });

// --- 1. reconfigure reads the sheet -----------------------------------------
await page.goto("http://localhost:5199/schluter-preview.html", { waitUntil: "networkidle" });
await page.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await page.locator("[data-schluter-tray]:not(.dis)").nth(0).click();
await page.waitForSelector(".stepper");
await page.click("[data-schluter-add]");
await page.waitForSelector("[data-schluter-confirm]");
await page.click("[data-schluter-confirm]");
await page.waitForSelector("[data-sheet]");
await page.waitForTimeout(300);
const rows = page.locator("[data-sheet-row]");
const n = await rows.count();
must(n >= 3, `kit landed as ${n} sheet rows`);
const target = rows.nth(1);                       // the first companion (panels)
const tid = await target.getAttribute("data-sheet-row");
const name = (await target.innerText()).split("\n")[1] || (await target.innerText());
const was = await page.locator(`[data-sheet-qty="${tid}"]`).inputValue();
const now = String(Number(was) + 2);
await page.screenshot({ path: `${OUT}/schluter-1-kit-landed.png` });

await page.locator(`[data-sheet-qty="${tid}"]`).fill(now);
await page.waitForTimeout(200);
must((await page.locator(`[data-sheet-qty="${tid}"]`).inputValue()) === now, `sheet row "${name.trim()}" qty edited ${was} → ${now}`);
await page.screenshot({ path: `${OUT}/schluter-2-sheet-qty-edited.png` });

await page.locator("[data-sheet-reconfig]").first().click();
await page.waitForSelector(".stepper");
await page.waitForTimeout(400);
must((await page.locator("[data-schluter-add]").innerText()).includes("Update this kit"), "reopened as Update this kit");
const ov = page.locator(".q.ov");
must(await ov.count() >= 1, "the build column shows a hand-set (override) quantity");
const ovText = (await ov.first().innerText()).trim();
must(ovText === now, `the override reads the sheet's ${now} (was the recipe's ${was})`);
await page.screenshot({ path: `${OUT}/schluter-3-reconfigure-shows-sheet-qty.png` });

await page.click("[data-schluter-add]");
await page.waitForSelector("[data-schluter-confirm]");
await page.click("[data-schluter-confirm]");
await page.waitForTimeout(400);
// companions re-land as fresh rows (landKitLines), so find the line by name
const relanded = page.locator("[data-sheet-row]", { hasText: name.trim() }).first();
must((await relanded.locator("input").inputValue()) === now, `Update this kit re-lands "${name.trim()}" at ${now}`);
must((await page.locator("[data-sheet-row]").count()) === n, "same row count after the update — nothing doubled");
await page.screenshot({ path: `${OUT}/schluter-4-updated-keeps-qty.png` });

await browser.close();
console.log("DONE");

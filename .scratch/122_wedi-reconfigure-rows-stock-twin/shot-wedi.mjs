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
await page.goto("http://localhost:5199/wedi-preview.html", { waitUntil: "networkidle" });
await page.waitForSelector(".pancard", { timeout: 20000 });
await page.locator(".pancard:not(.dis)").nth(0).click();
await page.waitForSelector(".stepper");
await page.click("[data-wedi-add]");
await page.waitForSelector("[data-wedi-confirm]");
await page.click("[data-wedi-confirm]");
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
await page.screenshot({ path: `${OUT}/wedi-1-kit-landed.png` });

await page.locator(`[data-sheet-qty="${tid}"]`).fill(now);
await page.waitForTimeout(200);
must((await page.locator(`[data-sheet-qty="${tid}"]`).inputValue()) === now, `sheet row "${name.trim()}" qty edited ${was} → ${now}`);
await page.screenshot({ path: `${OUT}/wedi-2-sheet-qty-edited.png` });

await page.locator("[data-sheet-reconfig]").first().click();
await page.waitForSelector(".stepper");
await page.waitForTimeout(400);
must((await page.locator("[data-wedi-add]").innerText()).includes("Update this kit"), "reopened as Update this kit");
const ov = page.locator(".q.ov");
must(await ov.count() >= 1, "the build column shows a hand-set (override) quantity");
const ovText = (await ov.first().innerText()).trim();
must(ovText === now, `the override reads the sheet's ${now} (was the recipe's ${was})`);
await page.screenshot({ path: `${OUT}/wedi-3-reconfigure-shows-sheet-qty.png` });

await page.click("[data-wedi-add]");
await page.waitForSelector("[data-wedi-confirm]");
await page.click("[data-wedi-confirm]");
await page.waitForTimeout(400);
// companions re-land as fresh rows (landKitLines), so find the line by name
const relanded = page.locator("[data-sheet-row]", { hasText: name.trim() }).first();
must((await relanded.locator("input").inputValue()) === now, `Update this kit re-lands "${name.trim()}" at ${now}`);
must((await page.locator("[data-sheet-row]").count()) === n, "same row count after the update — nothing doubled");
await page.screenshot({ path: `${OUT}/wedi-4-updated-keeps-qty.png` });

// --- 2. search: the stocked twin swaps in -----------------------------------
await page.goto("http://localhost:5199/wedi-preview.html?search=1", { waitUntil: "networkidle" });
await page.waitForSelector("[data-search-q]");
for (const [q, shot] of [['wedi panel 1/2', "wedi-5-search-panel-half"], ['wedi 36"x60"', "wedi-6-search-36x60"]]) {
  await page.fill("[data-search-q]", q);
  await page.waitForTimeout(600);
  await page.waitForSelector("[data-hit]");
  const hits = await page.locator("[data-hit]").evaluateAll((els) => els.map((e) => e.dataset.hit + ":" + e.dataset.hitKind));
  console.log(`"${q}" →`, hits.join(", "));
  must(hits.includes("47700:stock"), `"${q}": the 3'x5' panel shows as STOCK 47700`);
  must(!hits.some((h) => h.startsWith("US8000017:")), `"${q}": its pricelist copy US8000017 is not a second, special-order row`);
  await page.screenshot({ path: `${OUT}/${shot}.png` });
}
await browser.close();
console.log("DONE");

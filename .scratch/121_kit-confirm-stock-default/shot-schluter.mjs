// Screenshot drive for the change-control preview. `npx vite --port 5199` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const URL = "http://localhost:5199/schluter-preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/121_kit-confirm-stock-default";
const must = (ok, msg) => { if (!ok) throw new Error("ASSERT: " + msg); console.log("ok —", msg); };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text()); });

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("[data-schluter-tray]", { timeout: 20000 });
await page.waitForTimeout(300);
must(await page.locator("[data-source-stock].on").count() === 1, "fresh popup opens on Stock only");
await page.screenshot({ path: `${OUT}/schluter-1-stock-default.png` });

const trays = page.locator("[data-schluter-tray]:not(.dis)");
const nTrays = await trays.count();
console.log("enabled trays under stock only:", nTrays);
must(nTrays >= 3, "at least three stocked trays to hop between");

await trays.nth(0).click();
const extra = () => page.locator("[data-schluter-kfix]:not([disabled])").first();
await page.waitForSelector("[data-schluter-kfix]");
await extra().click();
await page.waitForTimeout(200);
must(await page.locator("[data-schluter-kfix].on").count() === 1, "KERDI-FIX chip on (build is customized)");
await trays.nth(1).click();
await page.waitForSelector("[data-kit-confirm=schluter]");
await page.screenshot({ path: `${OUT}/schluter-2-confirm-four-way.png` });

await page.click("[data-kit-keep]");
await page.waitForTimeout(300);
must(await trays.nth(1).evaluate((el) => el.classList.contains("on")), "second tray is now the build");
must(await page.locator("[data-schluter-kfix].on").count() === 1, "Keep what I added carried the KERDI-FIX line onto the new tray");
await page.screenshot({ path: `${OUT}/schluter-3-keep-added.png` });

await page.click("[data-schluter-add]");
await page.waitForSelector("[data-schluter-confirm]");
await page.click("[data-schluter-confirm]");
await page.waitForTimeout(400);
await page.click("[data-schluter-basket]");
await page.waitForSelector("[data-kit-basket]");
await page.locator("[data-kit-basket] button", { hasText: "Reconfigure" }).first().click();
await page.waitForSelector("[data-schluter-kfix]");
await page.waitForTimeout(300);
must((await page.locator("[data-schluter-add]").innerText()).includes("Update this kit"), "reopened kit reads Update this kit");
must(await page.locator("[data-source-stock].on").count() === 1, "a kit built under Stock only reopens on Stock only");
await page.screenshot({ path: `${OUT}/schluter-4-reconfigure-update.png` });

await extra().click();
// a reopened marker lands on the Custom tab — hop back to Kits for the third tray
await page.locator(".modetab", { hasText: /kits/i }).click();
await page.waitForSelector("[data-schluter-tray]");
await trays.nth(2).click();
await page.waitForSelector("[data-kit-confirm=schluter]");
await page.click("[data-kit-new]");
await page.waitForTimeout(400);
must((await page.locator("[data-schluter-add]").innerText()).includes("Add to product lines"), "after New shower the popup is a NEW kit");
must((await page.locator("[data-schluter-basket]").innerText()).includes("1"), "the edit of kit A is parked in the basket");
await page.screenshot({ path: `${OUT}/schluter-5-new-shower-detached.png` });

await page.click("[data-schluter-add-basket]");
await page.waitForSelector("[data-kit-basket]");
await page.waitForTimeout(300);
const drawer = (await page.locator("[data-kit-basket]").innerText()).replace(/\n/g, " | ");
console.log("DRAWER >>>", drawer);
must(drawer.includes("2 staged"), "two staged entries");
must(await page.locator("[data-kit-basket] span", { hasText: /^update$/i }).count() === 1, "exactly one wears the UPDATE chip");
await page.screenshot({ path: `${OUT}/schluter-6-drawer-update-plus-new.png` });

await page.locator("[data-kit-basket] button", { hasText: "Select all" }).click();
await page.locator("[data-kit-basket] button", { hasText: "Move 2" }).click();
await page.waitForTimeout(500);
const placed = await page.locator("[data-kit-basket] button", { hasText: "Reconfigure" }).count();
must(placed === 2, "after Move: TWO placed kits — got " + placed);
await page.screenshot({ path: `${OUT}/schluter-7-two-placed-kits.png` });

await browser.close();
console.log("schluter drive done");

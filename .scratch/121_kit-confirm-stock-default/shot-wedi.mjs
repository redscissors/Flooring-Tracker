// Screenshot drive for the change-control preview. `npx vite --port 5199` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const URL = "http://localhost:5199/wedi-preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/121_kit-confirm-stock-default";
const must = (ok, msg) => { if (!ok) throw new Error("ASSERT: " + msg); console.log("ok —", msg); };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text()); });

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".pancard", { timeout: 20000 });
await page.waitForTimeout(300);
must(await page.locator("[data-source-stock].on").count() === 1, "fresh popup opens on Stock only");
await page.screenshot({ path: `${OUT}/wedi-1-stock-default.png` });

const pans = page.locator(".pancard:not(.dis)");
const nPans = await pans.count();
console.log("enabled pan cards under stock only:", nPans);
must(nPans >= 3, "at least three stocked pan cards to hop between");
const gun = () => page.locator(".addchips .addchip", { hasText: "Sealant gun" }).first();

await pans.nth(0).click();
await page.waitForSelector(".stepper");
await gun().click();
await page.locator(".stepper button").nth(1).click();   // + on the first line → qtyOv
await page.waitForTimeout(200);
must(await page.locator(".addchips .addchip.on", { hasText: "Sealant gun" }).count() === 1, "gun chip on (build is customized)");
await pans.nth(1).click();
await page.waitForSelector("[data-kit-confirm=wedi]");
await page.screenshot({ path: `${OUT}/wedi-2-confirm-four-way.png` });

await page.click("[data-kit-keep]");
await page.waitForTimeout(300);
must(await page.locator("[data-kit-confirm]").count() === 0, "confirm closed");
must(await pans.nth(1).evaluate((el) => el.classList.contains("on")), "second kit is now the build");
must(await page.locator(".addchips .addchip.on", { hasText: "Sealant gun" }).count() === 1, "Keep what I added carried the gun onto the new kit");
await page.screenshot({ path: `${OUT}/wedi-3-keep-added.png` });

// land kit A, reopen it from the drawer → editing mode
await page.click("[data-wedi-add]");
await page.waitForSelector("[data-wedi-confirm]");
await page.click("[data-wedi-confirm]");
await page.waitForTimeout(400);
await page.click("[data-wedi-basket]");
await page.waitForSelector("[data-kit-basket]");
await page.locator("[data-kit-basket] button", { hasText: "Reconfigure" }).first().click();
await page.waitForSelector(".stepper");
await page.waitForTimeout(300);
must((await page.locator("[data-wedi-add]").innerText()).includes("Update this kit"), "reopened kit reads Update this kit");
must(await page.locator("[data-source-stock].on").count() === 1, "a kit built under Stock only reopens on Stock only (marker source)");
await page.screenshot({ path: `${OUT}/wedi-4-reconfigure-update.png` });

// customize, hop to a third kit → New shower
await gun().click();
await pans.nth(2).click();
await page.waitForSelector("[data-kit-confirm=wedi]");
await page.click("[data-kit-new]");
await page.waitForTimeout(400);
must((await page.locator("[data-wedi-add]").innerText()).includes("Add to product lines"), "after New shower the popup is a NEW kit (Add to product lines)");
must((await page.locator("[data-wedi-basket]").innerText()).includes("1"), "the edit of kit A is parked in the basket");
await page.screenshot({ path: `${OUT}/wedi-5-new-shower-detached.png` });

await page.click("[data-wedi-add-basket]");
await page.waitForSelector("[data-kit-basket]");
await page.waitForTimeout(300);
const drawer = (await page.locator("[data-kit-basket]").innerText()).replace(/\n/g, " | ");
console.log("DRAWER >>>", drawer);
must(drawer.includes("2 staged"), "two staged entries");
must(await page.locator("[data-kit-basket] span", { hasText: /^update$/i }).count() === 1, "exactly one wears the UPDATE chip");
await page.screenshot({ path: `${OUT}/wedi-6-drawer-update-plus-new.png` });

await page.locator("[data-kit-basket] button", { hasText: "Select all" }).click();
await page.locator("[data-kit-basket] button", { hasText: "Move 2" }).click();
await page.waitForTimeout(500);
const placed = await page.locator("[data-kit-basket] button", { hasText: "Reconfigure" }).count();
must(placed === 2, "after Move: TWO placed kits (A updated in place, B appended) — got " + placed);
await page.screenshot({ path: `${OUT}/wedi-7-two-placed-kits.png` });

// source round trip: update kit A under Full catalog, reopen → Full catalog
await page.locator("[data-kit-basket] button", { hasText: "Reconfigure" }).first().click();
await page.waitForSelector(".stepper");
await page.click("[data-source-all]");
await page.waitForTimeout(200);
await page.click("[data-wedi-add]");
await page.waitForSelector("[data-wedi-confirm]");
await page.click("[data-wedi-confirm]");
await page.waitForTimeout(400);
await page.click("[data-wedi-basket]");
await page.waitForSelector("[data-kit-basket]");
await page.locator("[data-kit-basket] button", { hasText: "Reconfigure" }).first().click();
await page.waitForTimeout(400);
must(await page.locator("[data-source-all].on").count() === 1, "a kit updated under Full catalog reopens on Full catalog");
await page.screenshot({ path: `${OUT}/wedi-8-source-roundtrip.png` });

await browser.close();
console.log("wedi drive done");

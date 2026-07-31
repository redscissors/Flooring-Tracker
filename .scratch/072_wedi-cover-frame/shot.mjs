// Screenshot run for the change-control preview. `npx vite --port 5199` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const URL = "http://localhost:5199/.scratch/072_wedi-cover-frame/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/072_wedi-cover-frame";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.click("text=wedi configurator");
await page.waitForSelector(".pancard", { timeout: 15000 });

const shot = async (n) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${n}.png` }); };
// the chip row sits at the bottom of the build column — scroll it into frame
const toChips = async () => {
  await page.locator(".bc-scroll").evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(300);
};
const chipShot = async (n) => { await toChips(); await shot(n); };
const chips = () => page.locator(".addchip");
const frameChip = () => page.locator(".addchip", { hasText: "Cover frame" });
const drainGroup = () => page.locator(".bgroup", { hasText: "Drain & finish" });
const drainLines = () => drainGroup().locator(".bline");
const menuRow = (txt) => page.locator(".wedi-swap .srow").filter({ hasText: txt }).first();
const dump = async (tag) => console.log(tag, "|", (await drainLines().allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim()));

// 1. A point-drain kit has no frame to match — the chip stays hidden.
await page.locator(".pancard").first().click();
await page.waitForTimeout(600);
console.log("fundo chips:", await chips().allInnerTexts());
await shot("preview-1-point-drain-no-chip");

// 2. A Fundo Linear base: the chip is there, off.
await page.locator('.pancard:has-text("Linear")').first().click();
await page.waitForTimeout(600);
const ow = page.locator("[data-wedi-overwrite-yes]");
if (await ow.count()) { await ow.click(); await page.waitForTimeout(500); }
console.log("linear chips:", await chips().allInnerTexts());
await dump("before");
await chipShot("preview-2-linear-frame-chip-off");

// 3. The SS43 cover matches exactly one frame — one click adds it, no picker.
await frameChip().click();
await dump("after +Cover frame");
await chipShot("preview-3-frame-added");

// 4. Its swap arrow offers every 43" frame + No frame.
await drainLines().filter({ hasText: "Frame" }).first().locator(".swapb").click();
await shot("preview-4-frame-swap-menu");
await menuRow("B43").click();
await dump("after swap → brass");
await shot("preview-5-brass-frame-swapped");

// 5. Swap the COVER to tileable — the hand-picked brass frame stays.
await drainLines().first().locator(".swapb").click();
await page.waitForTimeout(400);
await menuRow("T43").click();
await dump("after cover → tileable");
await shot("preview-6-tileable-cover-brass-frame");

// 6. Chip off, then on again — a tileable cover offers all four, so it opens
//    the picker instead of auto-adding.
await frameChip().click();
await dump("after chip off");
await chipShot("preview-7-frame-off");
await toChips();
await frameChip().click();
await shot("preview-8-tileable-frame-picker");
await page.locator(".wedi-chipmenu .srow").first().click();
await dump("after picker pick");
await chipShot("preview-9-picked-from-picker");

await browser.close();
console.log("done");

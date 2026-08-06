// Preview proof for issue 080 round 3 — size-led bases, worded cover finishes,
// exterior-led niches.   node .scratch/080_wedi-curb-names/shoot2.mjs
import { chromium } from "playwright";

const OUT = ".scratch/080_wedi-curb-names/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);

// --- 1 · kit build: base + cover lines read the new way ----------------------
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(600);
await pg.locator(".buildcol").screenshot({ path: `${OUT}/4-build-column-bases-covers.png` });
console.log("head sub:", await pg.locator(".bc-h .sub").textContent());
console.log("pan line:", await pg.locator(".buildcol .bline", { hasText: "Shower Base" }).first().textContent());
console.log("cover line:", await pg.locator(".buildcol .bline", { hasText: "Drain Cover" }).first().textContent());

// --- 2 · the drain-cover swap popover: finish words --------------------------
const coverLine = pg.locator(".buildcol .bline", { hasText: "Drain Cover" }).first();
await coverLine.hover();
await coverLine.locator(".swapb").click();
await pg.waitForTimeout(400);
await pg.locator(".wedi-swap").screenshot({ path: `${OUT}/5-cover-swap-finishes.png` });
console.log("cover rows:", (await pg.locator(".wedi-swap .srow .n").allTextContents()).slice(0, 5).join(" | "));
await pg.mouse.click(20, 20);
await pg.waitForTimeout(300);

// --- 3 · niche chip picker: exterior main, interior below --------------------
await pg.locator(".addchip", { hasText: "Niche" }).click();
await pg.waitForTimeout(400);
await pg.locator(".wedi-swap").screenshot({ path: `${OUT}/6-niche-picker.png` });
console.log("niche rows:", (await pg.locator(".wedi-swap .srow .n").allTextContents()).slice(0, 4).join(" | "));
await pg.mouse.click(20, 20);
await pg.waitForTimeout(300);

// --- 4 · Kits tab cards still tag only the exceptions ------------------------
await pg.locator(".main").screenshot({ path: `${OUT}/7-kits-tab.png` });
console.log("tags on cards:", (await pg.locator(".pancard .nm").allTextContents()).join(" | ") || "(none)");

await pg.close();
await b.close();

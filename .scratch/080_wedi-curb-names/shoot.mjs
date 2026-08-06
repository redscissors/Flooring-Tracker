// Preview proof for issue 080 — plain curb names + full foam → lean → AT order.
//   node .scratch/080_wedi-curb-names/shoot.mjs
import { chromium } from "playwright";

const OUT = ".scratch/080_wedi-curb-names/shots";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1680, height: 980 }, deviceScaleFactor: 2 });
await pg.goto("http://127.0.0.1:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);

// --- 1 · a curbed house kit: the curb line reads by length + profile ---------
await pg.locator(".pancard").nth(2).click();
await pg.waitForTimeout(600);
await pg.locator(".buildcol").screenshot({ path: `${OUT}/1-build-column.png` });
console.log("curb line:", await pg.locator(".buildcol .bline", { hasText: "Curb" }).first().textContent().catch(() => "(?)"));

// --- 2 · the curb swap popover: new names, full foam → lean → AT → caps ------
const curbLine = pg.locator(".buildcol .bline", { hasText: "Lean Curb" }).first();
await curbLine.hover();
await curbLine.locator(".swapb").click();
await pg.waitForTimeout(400);
await pg.locator(".wedi-swap").screenshot({ path: `${OUT}/2-curb-swap-order.png` });
console.log("swap rows:", (await pg.locator(".wedi-swap .srow .n").allTextContents()).join(" | "));
await pg.mouse.click(20, 20);
await pg.waitForTimeout(300);

// --- 3 · change the drain: the re-solved build shows the curb the same way ---
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(500);
await pg.locator(".rseg button", { hasText: "Linear" }).click();
await pg.waitForTimeout(800);
const card = pg.locator(".optcard").first();
await card.click();
await pg.waitForTimeout(600);
await pg.locator(".buildcol").screenshot({ path: `${OUT}/3-after-drain-change.png` });
console.log("after drain change:", await pg.locator(".buildcol .bline", { hasText: "Curb" }).first().textContent().catch(() => "(?)"));

await pg.close();
await b.close();

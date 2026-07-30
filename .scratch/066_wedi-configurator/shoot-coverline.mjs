// Covers/frames sub-line reads Size · Type · Color (owner ask 2026-07-30).
import { chromium } from "playwright";
const OUT = ".scratch/066_wedi-configurator";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto("http://localhost:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);
await pg.locator(".modetab").nth(2).click();
await pg.waitForTimeout(400);
await pg.locator(".ft-hhead", { hasText: "Covers" }).click();
await pg.waitForTimeout(400);
const subs = await pg.locator(".brow .s").allTextContents();
console.log(subs.slice(0, 6).join("\n"));
await pg.locator("[data-wedi-pop]").screenshot({ path: `${OUT}/U5-cover-lines.png` });
console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();

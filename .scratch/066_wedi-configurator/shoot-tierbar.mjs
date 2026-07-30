// Tier bar pressed like the project header + Order entry button.
import { chromium } from "playwright";
const OUT = ".scratch/066_wedi-configurator";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto("http://localhost:5199/wedi-preview.html", { waitUntil: "load" });
await pg.waitForTimeout(1200);
await pg.click('[data-wedi-pan="US9100004"]');
await pg.waitForTimeout(400);
await pg.locator(".tierbar button", { hasText: "Builder" }).click();
await pg.waitForTimeout(300);
await pg.locator(".pop-head").screenshot({ path: `${OUT}/U6-tierbar-pressed.png` });
const btn = await pg.locator(".bc-foot .btnrow").textContent();
console.log("footer buttons:", btn);
await pg.locator(".bc-foot").screenshot({ path: `${OUT}/U6b-order-entry-btn.png` });
console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();

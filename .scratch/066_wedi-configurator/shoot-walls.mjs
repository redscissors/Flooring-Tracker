// Round-5 preview shots (walls / corner cuts / curbs): drives the REAL
// WediConfigurator through wedi-preview.html. Serve with
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npx vite --port 5199
// then `node .scratch/066_wedi-configurator/shoot-walls.mjs`.
import { chromium } from "playwright";
const OUT = ".scratch/066_wedi-configurator";
const URL = "http://localhost:5199/wedi-preview.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForTimeout(1200);

const popup = pg.locator("[data-wedi-pop]");
const topSvg = () => pg.locator(".diagcol svg").first();

// W1 — 36×60 house kit, right wall shortened to 20": the band shortens in the
// drawing, the exposed right run + entry grow the curb to 76" (96" lean curb).
await pg.click('[data-wedi-pan="US9100004"]');
await pg.waitForTimeout(400);
const rightLen = pg.locator(".wallrow").nth(2).locator("input").first();
await rightLen.fill("20");
await rightLen.press("Enter");
await pg.waitForTimeout(500);
await popup.screenshot({ path: `${OUT}/W1-wall-shortened-curb.png` });

// W2 — "Cut open corners": both entry corners chamfer 45° off the pan.
await pg.getByText("Cut open corners").click();
await pg.waitForTimeout(500);
await popup.screenshot({ path: `${OUT}/W2-corner-cuts.png` });
await pg.locator(".diagcol").screenshot({ path: `${OUT}/W2b-drawings-closeup.png` });

// Behavior check: a boxed-in corner refuses the cut with a toast.
const svg1 = await topSvg().boundingBox();
await pg.mouse.click(svg1.x + svg1.width * 0.13, svg1.y + svg1.height * 0.12); // back-left, two walls
await pg.waitForTimeout(300);
const toast = await pg.locator(".wedi-toast").textContent().catch(() => "");
console.log("boxed-corner toast:", toast || "(none)");

// W3 — Custom tab, 48×66: pick the top option, add an entry wall by clicking
// the drawing's bottom edge — the wall lands as a row, draws in moss, and the
// curb run shrinks to the remaining doorway.
await pg.locator(".modetab").nth(1).click();
await pg.waitForTimeout(400);
await pg.click('[data-wedi-opt="0"]');
await pg.waitForTimeout(500);
await pg.getByText("+ Add wall").click();
await pg.waitForTimeout(300);
const svg2 = await topSvg().boundingBox();
// mid-edge — a click within 10" of a corner toggles that corner instead
await pg.mouse.click(svg2.x + svg2.width * 0.52, svg2.y + svg2.height * 0.9);
await pg.waitForTimeout(600);
await popup.screenshot({ path: `${OUT}/W3-custom-entry-wall.png` });

// W4 — the print sheet. With window.print() stubbed, no afterprint ever
// fires, so the sheet stays mounted until the component's fallback timer —
// the capture window.
await pg.evaluate(() => { window.print = () => {}; });
await pg.locator("button:has-text('Print layout')").click();
await pg.emulateMedia({ media: "print" });
await pg.waitForTimeout(250);
await pg.screenshot({ path: `${OUT}/W4-print-curb-corners.png`, fullPage: true });
await pg.emulateMedia({ media: "screen" });

console.log(errs.length ? "PAGE ERRORS:\n" + errs.join("\n") : "no page errors");
await b.close();

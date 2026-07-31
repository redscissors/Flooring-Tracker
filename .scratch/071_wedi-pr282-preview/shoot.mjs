import { chromium } from "playwright";
const OUT = ".scratch/071_wedi-pr282-preview";
const URL = "http://localhost:5199/wedi-preview.html";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 2 });
const errs = [];
pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
pg.on("pageerror", (e) => errs.push(String(e)));
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForTimeout(1400);

const popup = pg.locator("[data-wedi-pop]");
const diagcol = pg.locator(".diagcol");
const custom = () => pg.locator(".modetab", { hasText: "Custom shower" }).click();
const field = (label) => pg.locator(".rf", { hasText: label }).locator("input");
const setNum = async (label, i, v) => {
  const el = field(label).nth(i);
  await el.fill(String(v)); await el.press("Enter"); await pg.waitForTimeout(350);
};

// A — the owner's repro: 58 × 33 curbed, offset preference, drain 6 × 16.5.
await custom();
await pg.waitForTimeout(400);
await setNum("Shower size", 0, 58);
await setNum("Shower size", 1, 33);
await pg.locator(".rf", { hasText: "Drain preference" }).locator("button", { hasText: "Offset" }).click();
await pg.waitForTimeout(300);
await setNum("Drain — from left", 0, 6);
await setNum("Drain — from left", 1, 16.5);
await pg.waitForTimeout(600);
await popup.screenshot({ path: `${OUT}/A1-58x33-closest-fit.png` });

// B — Riolito neo modular: 36 × 72 linear, both wedi layouts.
await setNum("Drain — from left", 0, "");
await setNum("Drain — from left", 1, "");
await setNum("Shower size", 0, 36);
await setNum("Shower size", 1, 72);
await pg.locator(".rf", { hasText: "Drain preference" }).locator("button", { hasText: "Linear" }).click();
await pg.waitForTimeout(700);
await popup.screenshot({ path: `${OUT}/B1-36x72-neo-module-wall.png` });
await pg.locator("[data-wedi-opt='1']").click();
await pg.waitForTimeout(500);
await popup.screenshot({ path: `${OUT}/B2-36x72-neo-module-centred.png` });
await diagcol.screenshot({ path: `${OUT}/B3-neo-centred-drawings.png` });

// C — 36 × 100: only the centred module reaches.
await setNum("Shower size", 1, 100);
await pg.waitForTimeout(700);
await popup.screenshot({ path: `${OUT}/C1-36x100-centred-only.png` });

// D — the one-piece Fundo Linear base: channel 6" off the long wall.
await setNum("Shower size", 0, 36);
await setNum("Shower size", 1, 60);
await pg.waitForTimeout(700);
await diagcol.screenshot({ path: `${OUT}/D1-US9310001-channel.png` });

// E — pan fall arrows at a third: a plain 60 × 60 fundo with extensions.
await pg.locator(".rf", { hasText: "Drain preference" }).locator("button", { hasText: "Any" }).click();
await setNum("Shower size", 0, 60);
await setNum("Shower size", 1, 66);
await pg.waitForTimeout(700);
await diagcol.screenshot({ path: `${OUT}/E1-fall-arrows-third.png` });

// G — 36 × 48 linear: the module can run the back wall OR a side wall; the
// side-wall card draws its channel down the room.
await pg.locator(".modetab", { hasText: "Custom shower" }).click();
await pg.waitForTimeout(300);
await pg.locator(".rf", { hasText: "Drain preference" }).locator("button", { hasText: "Linear" }).click();
await setNum("Shower size", 0, 36);
await setNum("Shower size", 1, 48);
await pg.waitForTimeout(700);
await pg.locator("[data-wedi-opt='1']").click();
await pg.waitForTimeout(500);
await popup.screenshot({ path: `${OUT}/G1-module-on-side-wall.png` });

// F — Kits: pick a neo line module direct. It now draws its channel AND its
// extension module, and the kit lists the extension.
await pg.locator(".modetab", { hasText: "Kits" }).click();
await pg.waitForTimeout(400);
await pg.click('[data-wedi-pan="US9320002"]');
await pg.waitForTimeout(400);
const ow = pg.locator("button", { hasText: "Overwrite — start the kit" });
if (await ow.count()) { await ow.click(); await pg.waitForTimeout(600); }
await pg.mouse.wheel(0, -3000);
await pg.waitForTimeout(400);
await popup.screenshot({ path: `${OUT}/F1-kits-module-pick.png` });

console.log("errors:", errs.slice(0, 8));
await b.close();

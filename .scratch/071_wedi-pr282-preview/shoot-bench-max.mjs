import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = "/tmp/claude-0/-home-user-Flooring-Tracker/e98e1262-3535-5a73-9f6d-f204a761b236/scratchpad/shots4";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 3 });
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));

const planClick = async (rx, ry, btn = "left") => {
  const svg = pg.locator(".diagcol svg").first();
  const box = await svg.boundingBox();
  const W = 60, D = 48, w = 328, h = 268;
  const sc = Math.min((w - 92) / W, (h - 72) / D);
  const ox = (w - W * sc) / 2, oy = 30;
  const px = box.x + (ox + rx * sc) * (box.width / w);
  const py = box.y + (oy + ry * sc) * (box.height / h);
  await pg.mouse.move(px, py);
  await pg.waitForTimeout(250);
  await pg.mouse.click(px, py, { button: btn });
  await pg.waitForTimeout(350);
};

const run = async (name, maxMode, benchLabel) => {
  await pg.goto("http://localhost:5199/wedi_harness.html?tab=custom&w=60&d=48&curb=curbed&drain=center", { waitUntil: "load" });
  await pg.waitForTimeout(1400);
  const opt = pg.locator("[data-wedi-opt='0']");
  if (await opt.count()) { await opt.click(); await pg.waitForTimeout(500); }
  if (maxMode) {
    await pg.locator("button", { hasText: "Max — curb inside" }).first().click();
    await pg.waitForTimeout(700);
  }
  await planClick(7, 24);
  const item = pg.locator("button", { hasText: benchLabel }).first();
  await item.click();
  await pg.waitForTimeout(600);
  await pg.keyboard.press("Escape");
  await pg.waitForTimeout(400);
  await pg.mouse.move(20, 20);
  await pg.waitForTimeout(300);
  const svgs = pg.locator(".diagcol svg");
  await svgs.nth(0).screenshot({ path: `${OUT}/${name}-plan.png` });
  await svgs.nth(1).screenshot({ path: `${OUT}/${name}-iso.png` });
};

await run("max-site-left", true, "build-up");
await run("max-framed-left", true, "Framed by");
await run("pansize-site-left", false, "build-up");
console.log("errors:", errs.slice(0, 8));
await b.close();

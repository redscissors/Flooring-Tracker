// Screenshots layouts.html (static, file://) — D/E/F, light and dark.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const dark of [false, true]) {
  const p = await b.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
  await p.goto("file://" + join(here, "layouts.html"), { waitUntil: "networkidle" });
  if (dark) await p.evaluate(() => document.documentElement.classList.add("ned-dark"));
  await p.waitForTimeout(600);
  for (const id of ["d", "e", "f"]) await (await p.$("#" + id)).screenshot({ path: join(here, `${id}${dark ? "-dark" : ""}.png`) });
  if (!dark) {
    await p.click("#d .tierchip");
    await p.waitForTimeout(150);
    await (await p.$("#d")).screenshot({ path: join(here, "d-menu.png") });
    await p.screenshot({ path: join(here, "layouts-full.png"), fullPage: true });
  }
  await p.close();
}
await b.close();

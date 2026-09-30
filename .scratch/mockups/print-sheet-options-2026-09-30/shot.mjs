// Screenshots each mockup sheet: node .scratch/mockups/print-sheet-options-2026-09-30/shot.mjs <outdir>
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
const f = "file://" + process.cwd() + "/.scratch/mockups/print-sheet-options-2026-09-30.html";
const out = process.argv[2];
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1240, height: 1000 }, deviceScaleFactor: 1.5 });
const errs = []; pg.on("pageerror", (e) => errs.push(e.message)); pg.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await pg.goto(f); await pg.waitForTimeout(800);
for (const id of ["A","B","C","D","E","F","G","H","G2","G3","G3a","G3b","G3c"]) {
  await pg.evaluate((i) => show(i), id); await pg.waitForTimeout(150);
  const s = await pg.$(`#p${id} .sheet`);
  const bb = await s.boundingBox(); const sh = await s.evaluate((el) => [el.scrollHeight, el.clientHeight, el.scrollWidth, el.clientWidth]);
  console.log(id, Math.round(bb.width), Math.round(bb.height), sh.join(","));
  await s.screenshot({ path: `${out}/sheet-${id}.png` });
}
console.log("errors:", errs);
await b.close();

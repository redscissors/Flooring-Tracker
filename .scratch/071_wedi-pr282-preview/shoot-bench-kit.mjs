import { chromium } from "playwright";
const OUT = "/tmp/claude-0/-home-user-Flooring-Tracker/e98e1262-3535-5a73-9f6d-f204a761b236/scratchpad/shots5";
import { mkdirSync } from "fs";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 }, deviceScaleFactor: 3 });
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));

const scenarios = [
  ["std-framed-right-full", [{ kind: "wall", side: "right", build: "framed", panFit: "cut" }]],
  ["std-framed-right-40", [{ kind: "wall", side: "right", build: "framed", panFit: "cut", len: 40 }]],
  ["std-framed-left-40", [{ kind: "wall", side: "left", build: "framed", panFit: "cut", len: 40 }]],
  ["std-site-left-full", [{ kind: "wall", side: "left", build: "site" }]],
  ["std-site-left-40", [{ kind: "wall", side: "left", build: "site", len: 40 }]],
  ["std-site-back", [{ kind: "wall", side: "back", build: "site" }]],
  ["std-premade-left", [{ kind: "wall", side: "left", part: "US3000000" }]],
];

for (const [name, benches] of scenarios) {
  const url = "http://localhost:5199/wedi_harness.html?benches=none&curbKey=US3000039&bjson=" + encodeURIComponent(JSON.stringify(benches));
  await pg.goto(url, { waitUntil: "load" });
  await pg.waitForTimeout(1200);
  const svgs = pg.locator(".diagcol svg");
  const n = await svgs.count();
  for (let i = 0; i < Math.min(n, 2); i++) {
    await svgs.nth(i).screenshot({ path: `${OUT}/${name}-${i === 0 ? "plan" : "iso"}.png` });
  }
}
console.log("errors:", errs.slice(0, 8));
await b.close();

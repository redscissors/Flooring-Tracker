// Renders the real ProjectHeaderBar (header-preview.html on a running vite
// dev server) with each variant's CSS injected, light and dark.
// node render.mjs http://localhost:5199
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const base = process.argv[2] || "http://localhost:5199";
const css = (f) => readFileSync(join(here, f), "utf8").replace(/@import url\("([^"]+)"\);/g, (_, g) => css(g));
const variants = [["current", ""], ["a", "a-hairline-grid.css"], ["b", "b-paper-grid.css"], ["c", "c-paper-grid-moss.css"]];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const dark of [false, true]) {
  for (const [name, file] of variants) {
    const p = await b.newPage({ viewport: { width: 1180, height: 700 }, deviceScaleFactor: 2 });
    await p.goto(base + "/header-preview.html", { waitUntil: "networkidle" });
    if (dark) await p.evaluate(() => document.documentElement.classList.add("ned-dark"));
    if (file) await p.addStyleTag({ content: css(file) });
    await p.waitForTimeout(500);
    await (await p.$("#proj-header")).screenshot({ path: join(here, `${name}${dark ? "-dark" : ""}.png`) });
    await p.close();
  }
}
await b.close();

// Side-by-side close-up of the two shower areas (rows 290–590 of each full shot).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const dir = dirname(fileURLToPath(import.meta.url));
const b64 = (f) => "data:image/png;base64," + readFileSync(join(dir, f)).toString("base64");
const html = `<html><body style="margin:0;background:#fff;font:700 13px Manrope,sans-serif;color:#333">
<div style="display:flex;gap:16px;padding:12px">
${[["Before (2026-10-01)", "configurator.png"], ["After — size · name · SKU (ADR 0054)", "after.png"]].map(([t, f]) =>
  `<div><div style="margin-bottom:6px">${t}</div><div style="width:816px;height:300px;background:url(${b64(f)}) 0 -290px no-repeat;border:1px solid #ddd"></div></div>`).join("")}
</div></body></html>`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1680, height: 360 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.screenshot({ path: join(dir, "before-after.png"), fullPage: true });
await browser.close();
console.log("before-after.png");

// npx vite --port 5199 ; node .scratch/167_email-estimate/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1000, height: 1200 } });
const page = await ctx.newPage();
// The sandbox browser can't reach Google Fonts through the egress proxy; curl
// can, so the real Manrope files are relayed in and the PDF shows the real font.
await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
  const url = route.request().url();
  const body = execFileSync("curl", ["-sS", "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36", url], { maxBuffer: 1 << 24 });
  route.fulfill({ status: 200, body, headers: { "content-type": url.includes("gstatic") ? "font/woff2" : "text/css", "access-control-allow-origin": "*" } });
});
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));
await page.goto("http://localhost:5199/.scratch/167_email-estimate/preview.html", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
console.log("fonts loaded:", await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").length));
console.log("mail", JSON.stringify(await page.evaluate(() => window.__mail), null, 1));
const t0 = Date.now();
const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 60000 }), page.click("#go")]);
console.log("download name:", dl.suggestedFilename(), "after", Date.now() - t0, "ms");
await dl.saveAs(join(dir, "sample.pdf"));
await page.waitForFunction(() => window.__result && window.__result !== "running", null, { timeout: 30000 });
console.log("result:", await page.evaluate(() => window.__result));
await browser.close();

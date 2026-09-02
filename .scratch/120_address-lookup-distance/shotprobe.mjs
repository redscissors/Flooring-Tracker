// Screenshot run for task 11's "Test address lookup" probe button. Shoots
// the button's four reporting cases plus the transient "Checking…" state.
// `npx vite --port 5199` first (real VITE_SUPABASE_URL/ANON_KEY — see
// settingsprobe.jsx's header comment), then this script.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_LIB || "playwright-core");

const URL = "http://localhost:5199/.scratch/120_address-lookup-distance/settingsprobe.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/120_address-lookup-distance";
const WAIT = 400; // 120ms fake relay latency + margin

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const btn = page.locator('button:has-text("Test address lookup"), button:has-text("Checking…")');

async function run(mode, shotName, { catchChecking } = {}) {
  await page.locator(`[data-mode="${mode}"]`).click();
  await btn.click();
  if (catchChecking) {
    await page.waitForTimeout(20); // must beat the fake relay's 120ms latency
    await page.screenshot({ path: `${OUT}/${shotName}-checking.png` });
  }
  await page.waitForTimeout(WAIT);
  await page.screenshot({ path: `${OUT}/${shotName}.png` });
}

// 1. not configured
await run("not-configured", "11-01-not-configured", { catchChecking: true });

// 2. working — both answered 200
await run("ok", "11-02-working");

// 3. Places 403, Routes 200 — names which one
await run("places-403", "11-03-places-403");

// 4. both Places and Routes 403
await run("both-403", "11-04-both-403");

// 5. other relay error (unauthorized) — routed through lookupErrText
await run("unauthorized", "11-05-unauthorized");

await browser.close();
console.log("done");

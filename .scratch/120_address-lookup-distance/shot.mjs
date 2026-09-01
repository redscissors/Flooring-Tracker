// Screenshot run for the address lookup + distance preview. `npx vite --port
// 5199` first (with the real VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY so the
// hook's real "client exists" branch runs — see preview.jsx's header comment).
// Shoots the six required states plus a couple of extra diagnostic frames
// (the transient "Measuring…" state, the Recheck round trip, and two widths
// for the suggestions dropdown / chip wrap).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_LIB || "playwright-core");

const URL = "http://localhost:5199/.scratch/120_address-lookup-distance/preview.html";
const OUT = "/home/user/Flooring-Tracker/.scratch/120_address-lookup-distance";
const DEBOUNCE_WAIT = 700; // 350ms debounce + 120ms fake relay latency + margin

const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });

async function newPage(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  return page;
}

async function shootCard(page, key, path) {
  await page.locator(`[data-card="${key}"] input`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${OUT}/${path}` });
}

// ---------- 820px pass: the six required states ----------
const page = await newPage(820, 900);

// 1. suggestions open under a partly-typed address
const f1 = page.locator('[data-card="suggestions"] input');
await f1.click();
await f1.fill("4905 Har");
await page.waitForTimeout(DEBOUNCE_WAIT);
await shootCard(page, "suggestions", "01-suggestions-open.png");
await page.locator("h1").click(); // blur -> closes the dropdown so it doesn't overlap the next card's click target
await page.waitForTimeout(250);

// 2. pick a suggestion -> fresh distance chip
const f2 = page.locator('[data-card="fresh-distance"] input');
await f2.click();
await f2.fill("4905 Har");
await page.waitForTimeout(DEBOUNCE_WAIT);
await page.locator('[data-card="fresh-distance"] input').scrollIntoViewIfNeeded();
await page.locator('[data-card="fresh-distance"] .cursor-pointer').first().click();
await page.waitForTimeout(20); // catch the transient "Measuring…" — must beat the fake relay's 120ms latency
await page.screenshot({ path: `${OUT}/02a-measuring.png` });
await page.waitForTimeout(400);
await shootCard(page, "fresh-distance", "02-fresh-distance.png");

// 3. stale stored distance -> drift chip + Recheck pill (seeded, no typing needed)
await shootCard(page, "stale-distance", "03-stale-distance.png");
// verify the Recheck pill actually triggers a re-measure
await page.locator('[data-card="stale-distance"] input').scrollIntoViewIfNeeded();
await page.locator('[data-card="stale-distance"] button:has-text("Recheck")').click();
await page.waitForTimeout(20); // must beat the fake relay's 120ms latency
await page.screenshot({ path: `${OUT}/03a-recheck-measuring.png` });
await page.waitForTimeout(400);
await shootCard(page, "stale-distance", "03b-recheck-resolved.png");

// 4. not-configured (no Google key)
await page.locator('[data-mode="not-configured"]').click();
const f4 = page.locator('[data-card="not-configured"] input');
await f4.click();
await f4.fill("4905 Har");
await page.waitForTimeout(DEBOUNCE_WAIT);
await shootCard(page, "not-configured", "04-not-configured.png");
await page.locator("h1").click();
await page.waitForTimeout(250);

// 5. over-quota
await page.locator('[data-mode="over-quota"]').click();
const f5 = page.locator('[data-card="over-quota"] input');
await f5.click();
await f5.fill("4905 Har");
await page.waitForTimeout(DEBOUNCE_WAIT);
await shootCard(page, "over-quota", "05-over-quota.png");
await page.locator("h1").click();
await page.waitForTimeout(250);

// 6. no-route (suggest still works under this mode; only the distance call errors)
await page.locator('[data-mode="no-route"]').click();
const f6 = page.locator('[data-card="no-route"] input');
await f6.click();
await f6.fill("4905 Har");
await page.waitForTimeout(DEBOUNCE_WAIT);
await shootCard(page, "no-route", "06a-no-route-suggestions.png");
await page.locator('[data-card="no-route"] .cursor-pointer').first().click();
await page.waitForTimeout(300);
await shootCard(page, "no-route", "06-no-route.png");

await page.close();

// ---------- 420px pass: dropdown clearance + chip wrap at a narrow width ----------
const narrow = await newPage(420, 900);

const nf1 = narrow.locator('[data-card="suggestions"] input');
await nf1.click();
await nf1.fill("4905 Har");
await narrow.waitForTimeout(DEBOUNCE_WAIT);
await shootCard(narrow, "suggestions", "07-suggestions-420.png");
await narrow.locator("h1").click();
await narrow.waitForTimeout(250);

await shootCard(narrow, "stale-distance", "08-stale-distance-420.png");

await narrow.close();

await browser.close();
console.log("done");

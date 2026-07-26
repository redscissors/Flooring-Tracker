import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");

const dir = new URL(".", import.meta.url).pathname;
const page0 = "http://localhost:8391/.scratch/053_price-cost-popup/proof.html"; // serve proof-dist: python3 -m http.server 8391

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));
await page.goto(page0);
await page.waitForTimeout(500);

const price = (id) => page.locator(`[data-testid="${id}"] input[data-c="price"]`);

// 1 — manual line: click the price cell, popup opens on the empty cost.
await price("manual").click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${dir}01-popup-opens.png`, fullPage: true });

// 2 — type a cost, hit +50%: the price and the margin fill in.
await page.keyboard.type("3.40");
await page.waitForTimeout(120);
await page.getByTitle("Price at cost + 50%").first().click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${dir}02-cost-plus-50.png`, fullPage: true });

// 3 — Enter closes and hands the caret back to the grid cell.
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
await page.screenshot({ path: `${dir}03-closed-and-stored.png`, fullPage: true });

// 4 — a count line: the popup names the row's own unit, custom % typed by hand.
await price("misc").click();
await page.waitForTimeout(150);
await page.keyboard.type("18.75");
await page.locator('input[title="Any other markup"]').last().fill("65");
await page.waitForTimeout(200);
await page.screenshot({ path: `${dir}04-count-line-custom-pct.png`, fullPage: true });
await page.keyboard.press("Escape");

// 5 — the Employee tier's costless line, and a book line opening pre-filled.
await price("employee").click();
await page.waitForTimeout(150);
await page.keyboard.type("6.20");
await page.waitForTimeout(250);
await page.screenshot({ path: `${dir}05-employee-tier-gets-a-cost.png`, fullPage: true });
await page.keyboard.press("Escape");

await price("booked").click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${dir}06-price-book-line.png`, fullPage: true });
await page.keyboard.press("Escape");

// 7 — click-outside dismissal, in the three places it has to work: empty page,
// another row's field, and (the one that could have gone wrong) a click inside
// the panel itself, which must NOT close it.
const panel = page.locator('[title="Close (Enter or Esc)"]');
// n is the panel COUNT, so "handed over" (exactly one) can't pass as "two open".
const check = async (label, act, want) => {
  await act();
  await page.waitForTimeout(250);
  const n = await panel.count();
  const pass = n === want;
  console.log(`${pass ? "ok  " : "FAIL"} ${label} → ${n} panel(s) open (wanted ${want})`);
  return pass;
};

let ok = true;
ok &= await check("open on the manual row", () => price("manual").click(), 1);
ok &= await check("click inside the panel (markup button)", () => page.getByTitle("Price at cost + 30%").first().click(), 1);
ok &= await check("click the page background", () => page.mouse.click(1400, 700), 0);

ok &= await check("re-open", () => price("misc").click(), 1);
ok &= await check("click another row's description cell", () => page.getByText("Mannington AduraMax Fossil").first().click(), 0);
ok &= await check("re-open, then click this row's own SKU cell", async () => {
  await price("misc").click();
  await page.waitForTimeout(200);
  await page.getByText("Stair nose, site finished").first().click();
}, 0);

// A click that lands on a DIFFERENT price cell must hand the panel over —
// exactly one open, never two and never none.
ok &= await check("click straight from one price cell to another", async () => {
  await price("manual").click();
  await page.waitForTimeout(200);
  await price("employee").click();
}, 1);
await page.screenshot({ path: `${dir}08-click-outside-dismiss.png`, fullPage: true });
await page.mouse.click(1400, 700);
await page.waitForTimeout(200);
console.log(ok ? "click-outside: all cases pass" : "click-outside: FAILURES ABOVE");

// 8 — the phone sheet's in-line cost row (its own page load: the sheet is a
// full-screen portal and its scrim would sit over the desktop rows).
const phone = await browser.newPage({ viewport: { width: 402, height: 900 }, deviceScaleFactor: 2 });
await phone.goto(`${page0}?phone`);
await phone.waitForTimeout(600);
await phone.screenshot({ path: `${dir}07-mobile-cost-row.png` });

await browser.close();
console.log("done");

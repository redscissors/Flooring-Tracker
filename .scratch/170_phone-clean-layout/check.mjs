// Proof for ticket 170 (phone Clean layout): the REAL app at 344×820 (Fold 5
// cover screen) over a stubbed Supabase — the .scratch/169 harness. Each case
// boots one job, asserts on the DOM, saves a shot, and prints PASS/FAIL lines;
// exit 1 on any FAIL. Needs Vite up:
//   VITE_SUPABASE_URL=https://stub.supabase.co VITE_SUPABASE_ANON_KEY=stub npx vite --port 5199 --strictPort
// Usage: OUT_DIR=after node check.mjs [--case=top --case=scroll …]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("/opt/node-tools/node_modules/playwright");

const OUT = process.env.OUT_DIR || ".";
mkdirSync(OUT, { recursive: true });
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
const jwt = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub: "u1", exp, role: "authenticated", email: "demo@floortrack.test" })}.x`;
const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "demo@floortrack.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: jwt, token_type: "bearer", expires_in: 86400 * 30, expires_at: exp, refresh_token: "fake-refresh", user };

let n = 0;
const prod = (over = {}) => ({ id: "pr" + (++n), type: "tile", sku: "", L: "12", W: "24", thickness: "0.375", sizeText: "12\"x24\"", brandColor: "", priceSqft: "", qtyType: "sqft", qty: "", ...over });
const filled = (name, sku, price, qty, over = {}) => prod({ brandColor: name, sku, priceSqft: String(price), qty: String(qty), ...over });
const blank = () => prod({ L: "", W: "", thickness: "", sizeText: "" });
const area = (name, products, over = {}) => ({ id: "a" + (++n), name, option: "", products: [...products, blank()], ...over });

const baseProject = (over = {}) => ({
  name: "Marsh — whole first floor", address: "44 Beech Ln", phone: "", email: "", notes: "",
  createdAt: Date.now(), attachments: [], salesperson: { name: "Sam", phone: "", email: "" },
  priceTier: "retail", printPricing: "full", erpOrders: [{ no: "48213" }],
  categories: [
    area("Kitchen", [filled("COREtec Blond Oak", "VV012", 4.35, 95, { type: "vinyl", sizeText: "7\"x48\"" })]),
    area("Hall bath — stone", [filled("Daltile Keystones White", "DKEYWH", 6.4, 60), filled("Schluter Jolly 3/8 Satin", "J100AE", 18.5, 4, { type: "misc", qtyType: "count" })]),
    area("Laundry", []),
  ],
  ...over,
});
const JOBS = {
  top: () => ({ project: baseProject() }),
  scroll: () => ({ project: baseProject({ categories: ["Kitchen", "Hall bath", "Mudroom", "Powder room", "Primary bath", "Basement"].map((nm, i) => area(nm, [0, 1, 2].map((j) => filled(`${nm} tile ${j + 1}`, `SKU${i}${j}`, 4 + j, 40 + 10 * j)))) }) }),
  options: () => ({ project: baseProject({ freight: false, categories: [
    area("Kitchen", [filled("COREtec Blond Oak", "VV012", 4.35, 95, { type: "vinyl" })]),
    area("Hall bath — tile", [filled("Daltile Keystones White", "DKEYWH", 6.4, 60)], { option: "A" }),
    area("Hall bath — LVP", [filled("COREtec Blond Oak", "VV012", 4.35, 60, { type: "vinyl" })], { option: "B" }),
  ] }) }),
  unassigned: () => ({ customer: null, project: baseProject({ name: "Lakeview Commons — Building C, units 101 through 118 (phase 2)", address: "2200 Lakeview Commons Parkway, Suite 400", priceTier: "builder", erpOrders: [],
    categories: [area("Units 101–118", [filled("Mohawk Slate Grey commercial", "MHSLGR", 6.5, 2100)])] }) }),
};
JOBS.name = JOBS.top; JOBS.sheet = JOBS.top; JOBS.desk = JOBS.top;

const book = { id: "bk1", kind: "stock", name: "Shop stock", active: true, data: {}, updated_at: "2026-09-01T00:00:00Z" };
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "access-control-expose-headers": "*" };
const json = (route, body, status = 200) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json", "content-range": "0-99/*" }, body: JSON.stringify(body) });

async function boot(browser, job, viewport) {
  const project = job.project;
  const custId = job.customer === null ? null : "c1";
  const lightRow = { id: "p1", created_at: "2026-08-01T12:00:00Z", updated_at: "2026-08-20T12:00:00Z", customer_id: custId, name: project.name, address: project.address, phone: "", email: "", quick: null, sales: "Sam", project_no: 214 };
  const personRow = { id: "c1", created_at: "2026-08-01T12:00:00Z", updated_at: "2026-08-20T12:00:00Z", builder_id: null, name: "Tom Marsh", phone: "", email: "", address: "9 Elm St", notes: "" };
  const restData = (url, wantsObject) => {
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "projects") return (url.searchParams.get("select") || "") === "data" ? (wantsObject ? { data: project } : [{ data: project }]) : [lightRow];
    if (table === "customers") return custId ? [personRow] : [];
    if (table === "app_data") return wantsObject ? { data: { profile: { name: "Sam", phone: "", email: "" } } } : [];
    if (table === "shared_settings") return wantsObject ? null : [];
    if (table === "price_books") return [book];
    return [];
  };
  const ctx = await browser.newContext(viewport.width < 768 ? { viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport });
  const page = await ctx.newPage();
  await page.addInitScript(([s]) => { localStorage.setItem("sb-stub-auth-token", s); localStorage.setItem("ft-last-open", JSON.stringify({ projectId: "p1" })); }, [JSON.stringify(session)]);
  await page.route("https://stub.supabase.co/**", (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    if (url.pathname.startsWith("/auth/v1/token")) return json(route, session);
    if (url.pathname.startsWith("/auth/v1/user")) return json(route, user);
    if (url.pathname.startsWith("/rest/v1/")) {
      if (req.method() !== "GET" && !(req.method() === "POST" && url.searchParams.get("select"))) return json(route, [], 201);
      const wantsObject = (req.headers().accept || "").includes("vnd.pgrst.object");
      const body = restData(url, wantsObject);
      if (wantsObject && body === null) return route.fulfill({ status: 406, headers: cors, body: "{}" });
      return json(route, body);
    }
    return json(route, {});
  });
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  await page.goto("http://localhost:5199/");
  await page.waitForFunction(() => document.querySelectorAll("[data-area-drop]").length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  return { page, ctx };
}

let fails = 0;
const check = (c, ok, why) => { console.log(ok ? `PASS ${c}: ${why}` : `FAIL ${c}: ${why}`); if (!ok) fails++; };
const fits = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && el.scrollWidth <= el.clientWidth; }, sel);
const rect = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; }, sel);

const CASES = {
  async top(page) {
    const head = await rect(page, "[data-phone-head]");
    check("top", !!head, "[data-phone-head] renders");
    check("top", head && head.height <= 124, `header height ≤ 124px (got ${head?.height})`);
    check("top", (await page.getByText("Customer", { exact: true }).count()) === 0, "the old band's Customer box is gone");
    const total = await page.locator("[data-phone-total]").textContent().catch(() => null);
    check("top", /^\$[\d,]+\.\d\d$/.test(total || ""), `[data-phone-total] reads money (got ${total})`);
    check("top", await fits(page, "[data-phone-bar]"), "[data-phone-bar] fits without overflow");
    const title = await rect(page, "[data-area-title]");
    check("top", title && title.height <= 18, `area title ≤ 18px tall (got ${title?.height})`);
    check("top", (await page.locator("[data-type-dot]").count()) > 0, "product lines wear a [data-type-dot]");
    check("top", (await page.getByText("No products yet. Tap Price book below.").count()) > 0, "empty area copy");
  },
  async scroll(page) {
    const titles = page.locator("[data-area-title]");
    check("scroll", (await titles.count()) >= 2, "area titles render");
    if ((await titles.count()) < 2) return;
    await page.evaluate(() => { const m = document.querySelector("main"); const a = document.querySelectorAll("[data-area-drop]")[1]; m.scrollTop += a.getBoundingClientRect().top - m.getBoundingClientRect().top + 40; });
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const m = document.querySelector("main").getBoundingClientRect(); const t = document.querySelectorAll("[data-area-title]")[1].getBoundingClientRect(); return { d: Math.abs(t.top - m.top) }; });
    check("scroll", r.d <= 1, `2nd area title sticks at main's top (off by ${r.d.toFixed(1)}px)`);
    const head = await rect(page, "[data-phone-head]");
    check("scroll", head && head.top < 30, "header stays pinned");
  },
  async name(page) {
    const input = page.locator("[data-area-title] input").first();
    check("name", (await input.count()) > 0, "title has the name input");
    if (!(await input.count())) return;
    await input.tap();
    await page.waitForTimeout(400);
    check("name", await input.evaluate((el) => document.activeElement === el), "tapping the name focuses it (no drag preventDefault)");
    await page.locator("[data-area-title] [aria-label='Area options']").first().tap();
    await page.waitForTimeout(400);
    check("name", await page.getByText("Delete area…").isVisible().catch(() => false), "⋯ opens the area menu with Delete area…");
  },
  async sheet(page) {
    await page.getByText("Daltile Keystones White").first().tap();
    await page.waitForTimeout(600);
    const sheet = await rect(page, ".ft-sheet");
    const head = await rect(page, "[data-phone-head]");
    check("sheet", sheet && head && sheet.top < head.bottom, `row sheet covers the header (sheet top ${sheet?.top}, header bottom ${head?.bottom})`);
  },
  async options(page) {
    const total = page.locator("[data-phone-total]");
    check("options", ((await total.textContent().catch(() => "")) || "").trim() === "2 options", "total reads 2 options");
    check("options", (await page.locator("[data-phone-bar] [aria-label='No freight']").count()) === 1, "freight off shows the struck truck");
    if (await total.count()) { await total.tap(); await page.waitForTimeout(500); }
    check("options", await page.locator(".ft-sheet").getByPlaceholder("Project name").isVisible().catch(() => false), "tapping it opens the ⋯ sheet");
  },
  async unassigned(page) {
    check("unassigned", ((await page.locator("[data-phone-head]").textContent().catch(() => "")) || "").includes("Unassigned"), "header reads Unassigned");
    const total = (await page.locator("[data-phone-total]").textContent().catch(() => "")) || "";
    check("unassigned", /^\$\d{2},\d{3}\.\d\d$/.test(total), `five-figure total (got ${total})`);
    check("unassigned", await fits(page, "[data-phone-bar]"), "bar fits with the long total");
    const bar = await rect(page, "[data-phone-bar]");
    const more = await rect(page, "[data-phone-bar] [aria-label='Project details']");
    check("unassigned", bar && more && more.right <= bar.right, "⋯ stays inside the bar");
  },
  async desk(page) {
    check("desk", (await page.locator("[data-phone-head]").count()) === 0, "no phone header on desktop");
  },
};

const want = process.argv.filter((a) => a.startsWith("--case=")).map((a) => a.slice(7));
const run = want.length ? want : Object.keys(CASES);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const c of run) {
  n = 0;
  const vp = c === "desk" ? { width: 1440, height: 940 } : { width: 344, height: 820 };
  try {
    const { page, ctx } = await boot(browser, JOBS[c](), vp);
    await CASES[c](page);
    await page.screenshot({ path: `${OUT}/${c}.png` });
    await ctx.close();
  } catch (e) { check(c, false, `crashed: ${e.message.split("\n")[0]}`); }
}
await browser.close();
console.log(fails ? `${fails} FAIL` : "ALL PASS");
process.exit(fails ? 1 : 0);

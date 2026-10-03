// Proof for ticket 171 (phone price-book search: field at the bottom, results
// flowing up from it), on ticket 170's harness: the REAL app at 344×820 (Fold 5
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
JOBS.wide = () => ({ project: baseProject({ priceTier: "employee", printPricing: "unit", address: "",
  categories: [area("Warehouse", [filled("Mohawk Slate Grey commercial", "MHSLGR", 6.5, 20000, { costSqft: "6" })])] }) });
JOBS.stray = () => ({ project: baseProject({ categories: [area("Kitchen", [filled("COREtec Blond Oak", "VV012", 4.35, 95, { type: "vinyl" })]), area("Den", [blank()])] }) });
JOBS.noaddr = () => ({ customer: null, project: baseProject({ name: "Lakeview Commons — Building C units", address: "", erpOrders: [] }) });
JOBS.name = JOBS.top; JOBS.hold = JOBS.top; JOBS.sheet = JOBS.top; JOBS.desk = JOBS.top;

const item = (sku, description, price) => ({ book_id: "bk1", sku, active: true, disabled: false, data: { description, unit: "CT", price, priceSqft: price, sfPerUnit: 10, size: "12x24", type: "tile", vendorSkus: [], fits: [], cost: price * 0.6 } });
const ITEMS = [item("DKEYWH", "Daltile Keystones White 2x2", 6.4), item("DKEYBK", "Daltile Keystones Black 2x2", 6.6), item("DKEYGR", "Daltile Keystones Grey 2x2", 6.5)];
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
    if (table === "price_book_items") return ITEMS;
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


const openSearch = async (page) => {
  await page.locator(".ft-rail button").filter({ hasText: "Price book" }).last().tap();
  await page.getByPlaceholder("Search SKU or product…").waitFor({ timeout: 5000 });
};
const CASES = {
  async bottom(page) {
    await openSearch(page);
    const vh = page.viewportSize().height;
    const field = await rect(page, "input[placeholder='Search SKU or product…']");
    check("bottom", field && field.top > vh * 0.75, `search field sits at the bottom (top ${Math.round(field?.top)} of ${vh})`);
    check("bottom", await page.evaluate(() => document.activeElement?.placeholder === "Search SKU or product…"), "the field takes focus");
    const hint = await page.getByText("Type a SKU or product words — picks fill the row.").boundingBox().catch(() => null);
    check("bottom", hint && field && hint.y + hint.height <= field.top && field.top - (hint.y + hint.height) < 80, "the opening hint sits just above the field");
  },
  async flow(page) {
    await openSearch(page);
    await page.getByPlaceholder("Search SKU or product…").fill("keystones");
    await page.waitForTimeout(700);
    const hits = await page.evaluate(() => [...document.querySelectorAll("[data-hit-rank]")].map((el) => ({ rank: Number(el.dataset.hitRank), top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom })));
    check("flow", hits.length >= 3, `3 hits render (got ${hits.length})`);
    const byRank = [...hits].sort((a, b) => a.rank - b.rank);
    check("flow", byRank.every((h, i) => i === 0 || h.top < byRank[i - 1].top), "rank 0 is lowest, each next hit sits above it");
    const status = await rect(page, "[data-search-status]");
    check("flow", status && byRank[0] && status.top - byRank[0].bottom < 4, "the best hit sits right above the status line");
    const field = await rect(page, "input[placeholder='Search SKU or product…']");
    check("flow", status && field && status.bottom <= field.top + 1, "status line sits right above the field");
  },
  async pick(page) {
    await openSearch(page);
    await page.getByPlaceholder("Search SKU or product…").fill("keystones");
    await page.waitForTimeout(700);
    await page.locator("[data-hit-rank='0']").tap();
    await page.waitForTimeout(800);
    check("pick", !(await page.getByPlaceholder("Search SKU or product…").isVisible().catch(() => false)), "one tap picks and closes the search");
    check("pick", await page.locator(".ft-sheet").getByText("Daltile Keystones", { exact: false }).first().isVisible().catch(() => false), "the row sheet shows the picked product");
  },
  async kb(page) {
    // A 300px keyboard the way iOS / Android Chrome report one: the visual
    // viewport shrinks, the layout viewport doesn't.
    await page.evaluate(() => {
      const fake = { height: window.innerHeight - 300, offsetTop: 0, addEventListener() {}, removeEventListener() {} };
      Object.defineProperty(window, "visualViewport", { value: fake, configurable: true });
    });
    await openSearch(page);
    await page.waitForTimeout(300);
    const vh = page.viewportSize().height;
    const field = await rect(page, "input[placeholder='Search SKU or product…']");
    check("kb", field && field.bottom <= vh - 300 + 2 && field.bottom > vh - 360, `field rides above the keyboard (bottom ${Math.round(field?.bottom)}, keyboard top ${vh - 300})`);
  },
  async vendor(page) {
    await openSearch(page);
    await page.getByPlaceholder("Search SKU or product…").fill("sheoga");
    await page.waitForTimeout(700);
    const v = await rect(page, "[data-sheoga-entry]");
    const status = await rect(page, "[data-search-status]");
    check("vendor", v && status && status.top - v.bottom < 4, "the vendor row sits nearest the bottom");
  },
};
JOBS.bottom = JOBS.top; JOBS.kb = JOBS.top; JOBS.flow = JOBS.top; JOBS.pick = JOBS.top; JOBS.vendor = JOBS.top;
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

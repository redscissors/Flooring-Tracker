// Proof for ticket 172 (installers): the REAL app over a stubbed Supabase —
// the .scratch/169 harness. Each case
// boots one job, asserts on the DOM, saves a shot, and prints PASS/FAIL lines;
// exit 1 on any FAIL. Needs Vite up:
//   VITE_SUPABASE_URL=https://stub.supabase.co VITE_SUPABASE_ANON_KEY=stub npx vite --port 5199 --strictPort
// Usage: OUT_DIR=after node check.mjs [--case=top --case=scroll …]
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("/opt/node22/lib/node_modules/playwright");

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

const SETTINGS = { waste: { tile: 10, floor: 5 }, installers: [
  { id: "i1", company: "Keystone Interiors", contact: "Rachel Yoder", phone: "(574) 555-0114", email: "rachel@keystoneint.example", trades: ["tile", "hard"], priority: 8 },
  { id: "i2", company: "Elkhart Flooring Group", contact: "Dan Miller", phone: "(574) 555-0187", email: "dan@efgfloors.example", trades: ["tile", "hard", "carpet"], priority: 6 },
  { id: "i3", company: "Goshen Floor Covering", contact: "Tom Hochstetler", phone: "(574) 555-0146", email: "tom@goshenfloorcovering.example", trades: ["tile", "hard", "carpet"], priority: 8 },
  { id: "i4", company: "Hartline Tile & Stone", contact: "Mike Ostrander", phone: "(574) 555-0162", email: "mike@hartlinetile.example", trades: ["tile"], priority: 9 },
  { id: "i5", company: "Northside Carpet Install", contact: "Lisa Graber", phone: "(574) 555-0139", email: "lisa@northsidecarpet.example", trades: ["carpet"], priority: 8 },
  { id: "i6", company: "J&R Plank Works", contact: "Jose Ramirez", phone: "(574) 555-0120", email: "jose@jrplank.example", trades: ["hard"], priority: 7 },
] };
const snap = (i) => ({ id: i.id, company: i.company, contact: i.contact, phone: i.phone, email: i.email, trades: i.trades, addedAt: 1, addedBy: "Sam" });
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
    if (table === "shared_settings") return wantsObject ? { data: SETTINGS } : [{ data: SETTINGS }];
    if (table === "price_books") return [book];
    if (table === "price_book_items") return [{ book_id: "bk1", sku: "DKEYWH", active: true, disabled: false, data: { description: "Daltile Keystones White 2x2", unit: "CT", price: 6.4, priceSqft: 6.4, sfPerUnit: 10, size: "12x24", type: "tile", vendorSkus: [], fits: [], cost: 3.84 } }];
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
const rect = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width }; }, sel);
const job = (installers) => ({ project: baseProject({ installers, categories: [
  area("Kitchen", [filled("COREtec Blond Oak", "VV012", 4.35, 95, { type: "vinyl", sizeText: "7\"x48\"" })]),
  area("Hall bath — stone", [filled("Daltile Keystones White", "DKEYWH", 6.4, 60), filled("Schluter Jolly 3/8 Satin", "J100AE", 18.5, 4, { type: "misc", qtyType: "count" })]),
  area("Bedrooms", [filled("Shaw Bellera Pebble Path", "SHBEL", 20.8, 520, { type: "carpet", L: "", W: "", sizeText: "12'" })]),
] }) });
const SET = [SETTINGS.installers[2], SETTINGS.installers[5]].map(snap);

const CASES = {
  async box(page) {
    const hammer = await rect(page, "[data-inst-hammer]");
    check("box", !!hammer, "hammer in the header");
    const badge = await page.locator("[data-inst-hammer] span").textContent().catch(() => "");
    check("box", badge === "2", `badge counts 2 (got ${badge})`);
    const box = await rect(page, "[data-inst-box]"), area = await rect(page, "[data-area-drop]");
    check("box", !!box, "box beside the areas");
    check("box", box && area && Math.abs(box.top - area.top) <= 1, `box top level with the first area (box ${box?.top}, area ${area?.top})`);
    check("box", box && area && box.left > area.right, "box sits right of the areas");
    check("box", (await page.locator("[data-inst-entry]").count()) === 2, "two entries listed");
  },
  async picker(page) {
    await page.click("[data-inst-hammer]");
    await page.waitForTimeout(500);
    check("picker", (await page.locator("[data-inst-picker]").count()) === 1, "picker opens");
    const order = await page.locator("[data-inst-pick]").evaluateAll((els) => els.map((e) => e.getAttribute("data-inst-pick")));
    check("picker", order.join() === "i3,i2,i1,i4,i5,i6".split(",").filter((x) => order.includes(x)).join() && order[0] === "i3" && order[1] === "i2", `whole-job installers first by priority (got ${order.join()})`);
    await page.click("[data-inst-pick='i4']");
    await page.waitForTimeout(300);
    check("picker", (await page.locator("[data-inst-entry]").count()) === 3, "a click adds Hartline to the box at once");
  },
  async narrow(page) {
    check("narrow", (await page.locator("[data-inst-box]").count()) === 0, "no box at 1280 wide");
    check("narrow", !!(await rect(page, "[data-inst-hammer]")), "hammer still in the header");
  },
  async print(page) {
    await page.click("button[aria-label='Print preview']");
    await page.waitForTimeout(800);
    const blk = page.locator("[data-print-installers]").first();
    check("print", (await blk.count()) === 1, "installers block on the sheet");
    const t = (await blk.textContent()) || "";
    check("print", /Goshen Floor Covering/.test(t) && /J&R Plank Works/.test(t), "both installers print");
    check("print", /TileHard SurfaceCarpet/.test(t), "Goshen's three trades stack");
    check("print", !/priority/i.test(t), "no priority on paper");
    await blk.scrollIntoViewIfNeeded();
  },
  async settings(page) {
    await page.click("[data-inst-hammer]");
    await page.waitForTimeout(400);
    await page.getByText("Manage installers →").click();
    await page.waitForSelector("[data-inst-row]", { timeout: 15000 }).catch(() => {});
    check("settings", (await page.locator("[data-inst-row]").count()) === 6, "Manage opens General → Installers with 6 rows");
    await page.click("[data-inst-row='i2']");
    await page.waitForTimeout(200);
  },
  async phone(page) {
    const fits = await page.evaluate(() => { const el = document.querySelector("[data-phone-bar]"); return !!el && el.scrollWidth <= el.clientWidth; });
    check("phone", fits, "phone bar still fits at 344px");
    const badge = await page.locator("[data-phone-bar] [data-inst-hammer] span").textContent().catch(() => "");
    check("phone", badge === "2", `hammer in the phone bar, badge 2 (got ${badge})`);
    await page.locator("[data-phone-bar] [data-inst-hammer]").tap();
    await page.waitForTimeout(600);
    check("phone", (await page.locator("[data-inst-picker]").count()) === 1, "tap opens the installers sheet");
    await page.locator("[data-inst-pick='i4']").tap();
    await page.waitForTimeout(400);
    const after = await page.locator("[data-phone-bar] [data-inst-hammer] span").textContent().catch(() => "");
    check("phone", after === "3", `a tap adds Hartline (badge ${after})`);
  },
  async phonebar(page) {
    const W = () => page.evaluate(() => [...document.querySelectorAll("[data-phone-bar] > *")].map((e) => `${(e.getAttribute("aria-label") || e.textContent || e.tagName).slice(0, 12)}:${Math.round(e.getBoundingClientRect().width)}`).join(" | "));
    console.log("with hammer   ", await W());
    await page.evaluate(() => document.querySelector("[data-phone-bar] [data-inst-hammer]").remove());
    await page.waitForTimeout(200);
    console.log("without hammer", await W());
  },
  async addnew(page) {
    await page.click("[data-inst-hammer]");
    await page.waitForTimeout(400);
    await page.getByText("Manage installers →").click();
    await page.waitForSelector("[data-inst-row]", { timeout: 15000 }).catch(() => {});
    await page.click("[data-inst-new]");
    await page.fill("#inst-company", "Lakeside Tile Co.");
    await page.fill("#inst-contact", "Ann Weaver");
    await page.click("[data-inst-trade='tile']");
    await page.locator("button:has-text('Add installer')").last().click();
    await page.waitForTimeout(300);
    check("addnew", (await page.locator("[data-inst-row]").count()) === 7, "the new installer joins the list");
  },
};

const want = process.argv.filter((a) => a.startsWith("--case=")).map((a) => a.slice(7));
const run = want.length ? want : Object.keys(CASES);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const c of run) {
  n = 0;
  const vp = c === "narrow" ? { width: 1280, height: 860 } : (c === "phone" || c === "phonebar") ? { width: 344, height: 820 } : { width: 1440, height: 940 };
  try {
    const { page, ctx } = await boot(browser, job(SET), vp);
    await CASES[c](page);
    await page.screenshot({ path: `${OUT}/${c}.png` });
    await ctx.close();
  } catch (e) { check(c, false, `crashed: ${e.message.split("\n")[0]}`); }
}
await browser.close();
console.log(fails ? `${fails} FAIL` : "ALL PASS");
process.exit(fails ? 1 : 0);

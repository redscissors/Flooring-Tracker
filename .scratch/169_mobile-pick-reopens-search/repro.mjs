// Repro + proof: the REAL app (vite dev @5199, VITE_SUPABASE_URL=https://stub.supabase.co)
// at the Fold 5 cover width over a stubbed Supabase (the .scratch/111 harness
// pattern) with one stock book. Taps the bottom bar's Price book, picks a hit,
// and reports whether the full-screen search came back after the pick.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("/opt/node-tools/node_modules/playwright");

const OUT = process.env.OUT_DIR || ".";
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
const jwt = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub: "u1", exp, role: "authenticated", email: "demo@floortrack.test" })}.x`;
const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "demo@floortrack.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: jwt, token_type: "bearer", expires_in: 86400 * 30, expires_at: exp, refresh_token: "fake-refresh", user };

const prod = (id, over = {}) => ({ id, type: "tile", sku: "", L: "12", W: "24", thickness: "0.375", sizeText: "12\"x24\"", brandColor: "", priceSqft: "", qtyType: "sqft", qty: "", ...over });
const project = {
  name: "Marsh — whole first floor", address: "44 Beech Ln", phone: "", email: "", notes: "",
  createdAt: Date.now(), attachments: [], salesperson: { name: "Sam", phone: "", email: "" },
  priceTier: "retail", printPricing: "full",
  categories: [
    { id: "a1", name: "Kitchen", option: "", products: [prod("p1", { brandColor: "Marazzi Rice 12x24", priceSqft: "5.25", qty: "420", sku: "MZRICE1224" }), prod("p2")] },
    { id: "a2", name: "Hall bath", option: "", products: [prod("p3")] },
  ],
};
const lightRow = { id: "p1", created_at: "2026-08-01T12:00:00Z", updated_at: "2026-08-20T12:00:00Z", customer_id: "c1", name: project.name, address: project.address, phone: "", email: "", quick: null, sales: "Sam", project_no: 214 };
const personRow = { id: "c1", created_at: "2026-08-01T12:00:00Z", updated_at: "2026-08-20T12:00:00Z", builder_id: null, name: "Tom Marsh", phone: "", email: "", address: "44 Beech Ln", notes: "" };
const book = { id: "bk1", kind: "stock", name: "Shop stock", active: true, data: {}, updated_at: "2026-09-01T00:00:00Z" };
const item = (sku, description, price, sf) => ({ book_id: "bk1", sku, active: true, disabled: false, data: { description, unit: "CT", price, priceSqft: price, sfPerUnit: sf, size: "12x24", type: "tile", vendorSkus: [], fits: [], cost: price * 0.6 } });
const items = [item("DKEYWH", "Daltile Keystones White 2x2", 6.4, 10), item("MHSLGR", "Mohawk Slate Grey 12x24", 3.95, 15.5)];

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "access-control-expose-headers": "*" };
const json = (route, body, status = 200) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json", "content-range": "0-99/*" }, body: JSON.stringify(body) });
const restData = (url, wantsObject) => {
  const table = url.pathname.replace("/rest/v1/", "");
  const q = url.searchParams;
  if (table === "projects") {
    if ((q.get("select") || "") === "data") return wantsObject ? { data: project } : [{ data: project }];
    return [lightRow];
  }
  if (table === "customers") return [personRow];
  if (table === "app_data") return wantsObject ? { data: { profile: { name: "Sam", phone: "", email: "" } } } : [];
  if (table === "shared_settings") return wantsObject ? null : [];
  if (table === "price_books") return [book];
  if (table === "price_book_items") return items;
  return [];
};

const run = async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 344, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await page.addInitScript(([k, s]) => localStorage.setItem(k, s), ["sb-stub-auth-token", JSON.stringify(session)]);
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
  await page.waitForTimeout(2500);
  // Open the project from the sidebar drawer.
  await page.locator("button:has(svg.lucide-menu)").first().click().catch(() => {});
  await page.waitForTimeout(400);
  await page.getByText("Tom Marsh").first().click();
  await page.waitForTimeout(500);
  const projLink = page.getByText("Marsh — whole first floor").first();
  if (await projLink.isVisible().catch(() => false)) await projLink.click().catch(() => {});
  await page.getByRole("button", { name: /Price book/ }).last().waitFor({ timeout: 10000 });
  await page.waitForTimeout(1500); // stage-2 stock load
  await page.screenshot({ path: `${OUT}/1-job.png` });

  await page.getByRole("button", { name: /Price book/ }).last().click();
  const input = page.getByPlaceholder("Search SKU or product…");
  await input.waitFor({ timeout: 5000 });
  await input.fill("keystones");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/2-search.png` });
  await page.getByText("Daltile Keystones White", { exact: false }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/3-after-pick.png` });
  const reopened = await page.getByPlaceholder("Search SKU or product…").isVisible().catch(() => false);
  const value = reopened ? await page.getByPlaceholder("Search SKU or product…").inputValue() : "";
  console.log(`RESULT: search ${reopened ? `REOPENED after the pick (query "${value}")` : "closed after the pick"}`);
  await browser.close();
  process.exitCode = reopened ? 1 : 0;
};
run().catch((e) => { console.error(e); process.exit(2); });

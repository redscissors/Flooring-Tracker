// Preview proof: the REAL app (vite dev @5199) over a stubbed Supabase.
// A fake session is seeded in localStorage; every stub.supabase.co request is
// intercepted and answered with mock rows, so App.jsx boots and renders the
// real areas grid.
import { chromium } from "@playwright/test";

const OUT = process.env.OUT_DIR || ".";
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
const jwt = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub: "u1", exp, role: "authenticated", email: "demo@floortrack.test" })}.x`;
const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "demo@floortrack.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: jwt, token_type: "bearer", expires_in: 86400 * 30, expires_at: exp, refresh_token: "fake-refresh", user };

const uid = (() => { let n = 0; return () => "id" + (++n); })();
const prod = (over = {}) => ({ id: uid(), type: "tile", sku: "", L: "12", W: "24", thickness: "0.375", sizeText: "12\"x24\"", brandColor: "", priceSqft: "", qtyType: "sqft", qty: "", ...over });
const area = (name, option, products) => ({ id: uid(), name, option, products });

const categories = [
  area("Kitchen + Pantry", "", [prod({ brandColor: "Marazzi Rice 12x24", priceSqft: "5.25", qty: "420", sku: "MZRICE1224" }), prod()]),
  area("Master Bath — tile", "A", [prod({ brandColor: "Carrara Hex", priceSqft: "8.10", qty: "95", sku: "CARHEX02" }), prod()]),
  area("Master Bath — LVP", "B", [prod({ type: "vinyl", brandColor: "COREtec Blond Oak", priceSqft: "4.35", qty: "95", sizeText: "7\"x48\"" }), prod()]),
  area("Hall bath", "G", [prod({ brandColor: "Daltile Keystones", priceSqft: "6.40", qty: "60" }), prod()]),
  area("Laundry", "H", [prod({ brandColor: "Glazzio Fog 2x2", priceSqft: "9.75", qty: "40" }), prod()]),
];
const project = {
  name: "Marsh — whole first floor", address: "44 Beech Ln", phone: "", email: "", notes: "",
  createdAt: Date.now(), categories, attachments: [],
  salesperson: { name: "Sam", phone: "", email: "" },
  priceTier: "retail", printPricing: "full",
  optionNames: { A: "Tile package", B: "LVP package", G: "Budget", H: "Premium" },
};
const lightRow = { id: "p1", created_at: "2026-08-01T12:00:00Z", updated_at: "2026-08-20T12:00:00Z", customer_id: "c1", name: project.name, address: project.address, phone: "", email: "", quick: null, sales: "Sam", project_no: 214 };
const personRow = { id: "c1", created_at: "2026-08-01T12:00:00Z", updated_at: "2026-08-20T12:00:00Z", builder_id: null, name: "Tom Marsh", phone: "", email: "", address: "44 Beech Ln", notes: "" };

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  "access-control-expose-headers": "*",
};
const json = (route, body, status = 200) =>
  route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });

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
  return [];
};

const run = async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } });
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
      console.log("REST:", req.method(), url.pathname, (url.search || "").slice(0, 120), "->", JSON.stringify(body)?.slice(0, 80));
      if (wantsObject && body === null) return route.fulfill({ status: 406, headers: cors, body: "{}" });
      return json(route, body);
    }
    return json(route, {});
  });

  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE:", m.text().slice(0, 300)); });
  page.on("requestfailed", (r) => console.log("REQFAIL:", r.url().slice(0, 120), r.failure()?.errorText));
  await page.goto("http://localhost:5199/");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/0-boot.png` });
  console.log("BODY:", (await page.locator("body").innerText()).slice(0, 400).replace(/\n+/g, " | "));
  // Open the demo project from the sidebar (one project → opens directly).
  const proj = page.getByText("Tom Marsh").first();
  await proj.waitFor({ timeout: 10000 });
  await proj.click();
  await page.locator('button[title="Drag to reorder areas"]').first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/1-areas.png`, fullPage: false });

  // Mid-drag: press the second area's ≡ grip, hold past the arm delay, pull down.
  const grips = page.locator('button[title="Drag to reorder areas"]');
  console.log("grips:", await grips.count());
  const g = grips.nth(0);
  const gb = await g.boundingBox();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(350);
  // Pull down ~500px — past the next area's midpoint, clear of the autoscroll zone.
  await page.mouse.move(gb.x, gb.y + 500, { steps: 12 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/2-drag.png`, fullPage: false });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/3-dropped.png`, fullPage: false });

  // The area menu showing the uniform-tint slots (used + first free).
  await page.locator("[data-area-drop]").nth(1).click({ button: "right", position: { x: 320, y: 15 } });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/4-area-menu.png`, fullPage: false });

  await browser.close();
};
run().catch((e) => { console.error(e); process.exit(1); });

// Preview proof (issue 153): the customer column (rail) — real app on vite
// :5199 over a stubbed Supabase. Start vite with
//   VITE_SUPABASE_URL=https://stub.supabase.co VITE_SUPABASE_ANON_KEY=stub npx vite --port 5199
// then: node .scratch/153_customer-column-cleanup/shot.mjs [suffix]
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
const dir = dirname(fileURLToPath(import.meta.url));
const suffix = process.argv[2] ? `-${process.argv[2]}` : "";

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
const jwt = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub: "u1", exp, role: "authenticated", email: "demo@floortrack.test" })}.x`;
const user = { id: "u1", aud: "authenticated", role: "authenticated", email: "demo@floortrack.test", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const session = { access_token: jwt, token_type: "bearer", expires_in: 86400 * 30, expires_at: exp, refresh_token: "fake-refresh", user };

const names = ["Tom Marsh", "Kelly Anderson-Whitfield", "Greenway Builders — Lot 14", "Ruth Olsen", "Dave & Maria Kowalski", "Pat Nguyen", "Sam Porter", "Linda Chu"];
const people = names.map((name, i) => ({ id: `c${i}`, created_at: "2026-08-01T12:00:00Z", updated_at: `2026-09-${String(20 - i).padStart(2, "0")}T12:00:00Z`, builder_id: i === 1 ? "b1" : null, name, phone: "", email: "", address: "", notes: "" }));
const projects = [];
people.forEach((c, i) => { for (let k = 0; k < (i % 3) + 1; k++) projects.push({ id: `p${i}_${k}`, created_at: "2026-08-01T12:00:00Z", updated_at: `2026-09-${String(20 - i).padStart(2, "0")}T12:00:00Z`, customer_id: c.id, name: ["Kitchen + baths", "Basement LVP", "Shower remodel"][k], address: "", phone: "", email: "", quick: null, sales: "Sam", project_no: 200 + projects.length }); });
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "access-control-expose-headers": "*" };
const json = (route, body, status = 200) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
const restData = (url, wantsObject) => {
  const table = url.pathname.replace("/rest/v1/", "");
  if (table === "projects") return (url.searchParams.get("select") || "") === "data" ? (wantsObject ? { data: {} } : []) : projects;
  if (table === "customers") return people;
  if (table === "builders") return [{ id: "b1", name: "Greenway Homes", data: {} }];
  if (table === "app_data") return wantsObject ? { data: { profile: { name: "Sam" } } } : [];
  return wantsObject ? null : [];
};

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const shoot = async (file, { width = 1440, height = 900, open, drawer, hover } = {}) => {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
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
  // Chromium here has no proxy route to Google Fonts: serve Manrope from a
  // local copy (FONTS dir: manrope.css + its woff2 files, fetched with curl).
  const fonts = process.env.FONTS;
  if (fonts) {
    const { readFileSync } = await import("node:fs");
    await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, headers: { "content-type": "text/css", "access-control-allow-origin": "*" }, body: readFileSync(join(fonts, "manrope.css"), "utf8") }));
    await page.route("https://fonts.gstatic.com/**", (r) => r.fulfill({ status: 200, headers: { "content-type": "font/woff2", "access-control-allow-origin": "*" }, body: readFileSync(join(fonts, new URL(r.request().url()).pathname.split("/").pop())) }));
  }
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  await page.goto("http://localhost:5199/");
  if (drawer) { await page.locator("button:has(svg.lucide-menu)").first().click(); }
  await page.getByText("Tom Marsh").first().waitFor({ timeout: 15000 });
  if (open) { await page.getByText(open).first().click(); }
  if (hover) { await page.locator(hover).first().hover(); }
  await page.waitForTimeout(700);
  await page.evaluate(() => document.fonts.ready);
  const rail = await page.locator("aside").boundingBox();
  await page.screenshot({ path: join(dir, file), clip: { x: 0, y: 0, width: rail.width + 40, height } });
  await page.close();
};
await shoot(`rail${suffix}.png`);
await shoot(`rail-open${suffix}.png`, { open: "Kelly Anderson-Whitfield" });
await shoot(`rail-hover${suffix}.png`, { hover: 'button[title="Browse all customers"]', height: 520 });
await shoot(`phone-drawer${suffix}.png`, { width: 390, height: 844, drawer: true });
await browser.close();

// Stand-in for src/lib/supabase.js (aliased in by vite.config.mjs): the issue
// 134 harness's chainable query builder over seeded rows, so the REAL App.jsx
// boots with no network. Writes are accepted and dropped. Dev-only.
// Seed (issue 162): an N259-shaped job — two tiles sharing ProLite in the
// shower, trim + wedi-style lines with no install materials, a floor tile on
// Ditra, a Sheoga (special-order) hardwood on an Aquabar pad, a backsplash on
// PermaColor Select + AcrylPro. ?pricing=unit|none sets the print mode;
// ?opts=1 tags the flooring and backsplash areas as options A/B.
import { newProject, newArea, newProduct } from "../../src/model.js";
import { normalizeSettings, serializeSettings } from "../../src/catalog.js";

const q = new URLSearchParams(location.search);
const settings = normalizeSettings(undefined);
for (const co of settings.catalog.companies) {
  for (const g of co.grouts) {
    if (g.name === "SpectraLOCK PRO") Object.assign(g, { coverage: 60, price: 32.89, cost: 20, unit: "units", sku: "1518988",
      base: { sku: "1518983", name: "0.8 Gal SpectraLOCK PRO Epoxy Grout Full Unit Part A&B", unit: "EA", price: 132.99, cost: 90, per: 1 } });
    if (g.name === "PermaColor Select") Object.assign(g, { coverage: 90, price: 5.39, cost: 3, unit: "bags", sku: "1519028",
      base: { sku: "1519065", name: "10 lb PermaColor Select Sanded Grout Base", unit: "EA", price: 24.75, cost: 15, per: 1 } });
  }
  for (const m of co.mortars || []) {
    if (m.name === "ProLite") Object.assign(m, { price: 39.99, cost: 25, sku: "29438" });
    if (m.name === "AcrylPro") Object.assign(m, { price: 24.99, cost: 15, sku: "267821", unit: "units" });
  }
  for (const u of co.underlayments || []) {
    if (u.name === "Ditra Underlayment Uncoupling Membrane") Object.assign(u, { price: 106.94, cost: 70, sku: "1509746", unit: "rolls", coverage: 54 });
    if (u.name === "Aquabar B") Object.assign(u, { price: 42.89, cost: 25, sku: "07879", unit: "EA", coverage: 500 });
  }
}
const P = (over) => ({ ...newProduct(), ...over });
const grout = (product, color, joint, extra = {}) => ({ ...newProduct().grout, checked: true, product, color, joint, ...extra });
const tile = (name, sku, L, W, qty, price, cartonSf, over = {}) => P({ brandColor: name, sku, L, W, qty: String(qty), priceSqft: String(price), cartonSf: String(cartonSf), ...over });
const misc = (name, sizeText, sku, qty, price, over = {}) => P({ type: "misc", brandColor: name, sizeText, sku, qtyType: "count", qty: String(qty), priceSqft: String(price), ...over });
const prolite = { checked: true, product: "ProLite", manual: "" };
const shower = { ...newArea(), name: "Main Bath Tile Shower", products: [
  tile("VT Luce Tile - 02CV61282R Oro Satin", "1504065", "12", "24", 127, 10.92, 11.6, { grout: grout("SpectraLOCK PRO", "Bright White", 0.125, { caulk: "1", caulkPrice: "22.99", caulkSku: "1519070" }), mortar: prolite }),
  tile("VT Luce Hexagon Tile - CV6001265 Oro Satin", "1504066", "4", "4", 16, 30.9, 0.9, { sizeText: '4"', cartonUnit: "SH", grout: grout("SpectraLOCK PRO", "Bright White", 0.125), mortar: prolite }),
  misc("Schluter Jolly Trendline - A100MBW Matte White", '3/8"', "23194", 4, 22.5),
  misc("wedi — 3'x5' Shower Base", '36" x 60" x 1 37/64"', "1504156", 1, 566.01, { note: "Center drain" }),
  misc("wedi® Joint Sealant Tube", "10.5 oz cartridge", "47735", 11, 19.22),
  misc("wedi — 4'x8'x1/2\" Building Panel", '48" x 96" x 1/2"', "47828", 2, 117.75),
] };
const floor = { ...newArea(), name: "Main Bath Flooring", products: [
  tile("VT Quartz Essence Nest - U4P4E3C2", "1518129", "12", "24", 61.6, 6.7, 13.6, { grout: grout("SpectraLOCK PRO", "Antique White", 0.125, { sku: "1518986" }), mortar: prolite, underlay: { ...newProduct().underlay, checked: true, product: "Ditra Underlayment Uncoupling Membrane" } }),
] };
const beds = { ...newArea(), name: "Bedrooms-Kitchen-Living Flooring", products: [
  P({ type: "hardwood", brandColor: "Sheoga White Oak Character Engineered Old Mill Micro bevel Prefinished Fresh Cut stain 5sheen", sizeText: '7¼"', qty: "895", priceSqft: "14.98", cartonSf: "23.5", sheoga: { style: "Engineered" }, underlay: { ...newProduct().underlay, checked: true, product: "Aquabar B" } }),
] };
const splash = { ...newArea(), name: "Kitchen Backsplash", products: [
  tile("WOW Vestige Sagano Square Matte", "WOWVSSA44M", "4.3", "4.3", 40, 20.31, 4.4, { grout: grout("PermaColor Select", "Bright White", 0.125), mortar: { checked: true, product: "AcrylPro", manual: "" } }),
] };
if (q.get("opts")) { floor.option = "A"; splash.option = "B"; }
const project = { ...newProject(null, "Test"), id: "p1", categories: [shower, floor, beds, splash], printPricing: q.get("pricing") || "full" };
const now = new Date().toISOString();
const TABLES = {
  projects: [{ id: "p1", customer_id: null, project_no: 259, created_at: now, updated_at: now, name: project.name, quick: "false", sales: "", data: project }],
  app_data: [{ data: { profile: { name: "Sam Miller", phone: "(574) 555-0199", email: "sam@example.com" } } }],
  shared_settings: [{ data: serializeSettings(settings) }],
  // The shop's stock book carries every SKU on the job except the WOW
  // backsplash, so that line (hand-entered, unstocked SKU) and the Sheoga floor
  // are the sheet's special orders — the app's own isSpecialOrder rules.
  price_books: [{ id: "stock1", kind: "stock", name: "Keim stock", active: true, data: {}, updated_at: now }],
  price_book_items: ["1504065", "1504066", "23194", "1504156", "47735", "47828", "1518129"].map((sku) => ({ book_id: "stock1", sku, active: true, disabled: false, updated_at: now, data: { description: sku } })),
};

const ok = (data = null) => ({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
function table(rows) {
  let cur = rows;
  const qb = new Proxy({}, {
    get: (_, k) => {
      if (k === "then") return (res, rej) => Promise.resolve(ok(cur)).then(res, rej);
      if (k === "maybeSingle" || k === "single") return async () => ok(cur[0] ?? null);
      if (k === "range") return async (a, b) => ok(cur.slice(a, b + 1));
      if (k === "eq") return (col, val) => { if (cur.some((r) => col in r)) cur = cur.filter((r) => r[col] === val); return qb; };
      if (k === "insert" || k === "update" || k === "upsert" || k === "delete") return () => { cur = []; return qb; };
      return () => qb;
    },
  });
  return qb;
}
export const isConfigured = true;
export const supabase = {
  from: (t) => table(TABLES[t] || []),
  rpc: () => table([]),
  storage: { from: () => ({ upload: async () => ok(), download: async () => ok(new Blob()), remove: async () => ok() }) },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() { } } } }),
    signOut: async () => ({ error: null }),
  },
};

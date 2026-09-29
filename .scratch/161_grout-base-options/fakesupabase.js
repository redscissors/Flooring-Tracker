// Stand-in for src/lib/supabase.js (aliased in by vite.config.mjs): the issue
// 134 harness's chainable query builder over seeded rows, so the REAL App.jsx
// boots with no network. Writes are accepted and dropped. Dev-only.
// Seed (issue 161): SpectraLOCK PRO carries a Full unit (★) and a Commercial
// unit (per 4); PermaColor Select a Sanded (★) and an Unsanded base. The job
// remembers SpectraLOCK PRO on Commercial; two rows use it, a third has no
// grout yet.
import { newProject, newArea, newProduct } from "../../src/model.js";
import { normalizeSettings, serializeSettings } from "../../src/catalog.js";

const settings = normalizeSettings(undefined);
for (const co of settings.catalog.companies) for (const g of co.grouts) {
  if (g.name === "SpectraLOCK PRO") Object.assign(g, { coverage: 60, price: 38.9, cost: 24, unit: "kits", sku: "LAT-SLP-C",
    base: { sku: "LAT-SLP-FULL", name: "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B", unit: "units", price: 62, cost: 40, per: 1 },
    altBases: [{ sku: "LAT-SLP-COMM", name: "3.2 GAL SPECTRALOCK PRO EPOXY GROUT COMMERCIAL UNIT", unit: "units", price: 218, cost: 150, per: 4 }] });
  if (g.name === "PermaColor Select") Object.assign(g, { coverage: 90, price: 21.4, cost: 12, unit: "kits", sku: "LAT-PCS-CK",
    base: { sku: "LAT-PCS-SND", name: "PermaColor Select Sanded Base", unit: "units", price: 24.5, cost: 15, per: 1 },
    altBases: [{ sku: "LAT-PCS-UNS", name: "PermaColor Select Unsanded Base", unit: "units", price: 26, cost: 16, per: 1 }] });
}
const tile = (name, qty, grout) => ({ ...newProduct(), sku: "", brandColor: name, L: "12", W: "24", thickness: "0.375", priceSqft: "5.40", qty: String(qty),
  grout: { ...newProduct().grout, joint: 0.125, ...grout }, mortar: { checked: true, product: "ProLite", manual: "" } });
const area = { ...newArea(), name: "Master bath", products: [
  tile("Daltile Volume 1.0 — Ash", 120, { checked: true, product: "SpectraLOCK PRO", color: "Bright White", base: "LAT-SLP-COMM" }),
  tile("Daltile Keystones — Arctic White", 45, { checked: true, product: "SpectraLOCK PRO", color: "Natural Gray", base: "LAT-SLP-COMM", joint: 0.0625 }),
  tile("Emser Craft — Chalk", 38, { checked: false, product: "" }),
] };
const project = { ...newProject(null, "Grout base options"), id: "p1", categories: [area], groutMemory: { product: "SpectraLOCK PRO", bases: { "SpectraLOCK PRO": "LAT-SLP-COMM" } } };
const now = new Date().toISOString();
const TABLES = {
  projects: [{ id: "p1", customer_id: null, project_no: 161, created_at: now, updated_at: now, name: project.name, quick: "false", sales: "", data: project }],
  app_data: [{ data: { profile: { name: "Preview" } } }],
  shared_settings: [{ data: serializeSettings(settings) }],
  price_books: [],
  price_book_items: [],
};

const ok = (data = null) => ({ data, error: null, count: Array.isArray(data) ? data.length : 0 });
function table(rows) {
  let cur = rows;
  const q = new Proxy({}, {
    get: (_, k) => {
      if (k === "then") return (res, rej) => Promise.resolve(ok(cur)).then(res, rej);
      if (k === "maybeSingle" || k === "single") return async () => ok(cur[0] ?? null);
      if (k === "range") return async (a, b) => ok(cur.slice(a, b + 1));
      if (k === "eq") return (col, val) => { if (cur.some((r) => col in r)) cur = cur.filter((r) => r[col] === val); return q; };
      if (k === "insert" || k === "update" || k === "upsert" || k === "delete") return () => { cur = []; return q; };
      return () => q;
    },
  });
  return q;
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

// Stand-in for src/lib/supabase.js (aliased in by vite.config.mjs): a chainable
// thenable query builder over seeded rows, so the REAL App.jsx boots with no
// network. Writes are accepted and dropped. Dev-only proof harness.
// Seed (issue 133): an Employee-tier job with one 12×12 tile line whose extras
// split two ways — grout + backer carry a book cost (repriced), mortar + caulk
// carry none (stay retail, flagged).
import { newProject, newArea, newProduct } from "../../src/model.js";
import { normalizeSettings, serializeSettings } from "../../src/catalog.js";

const settings = normalizeSettings(undefined);
for (const co of settings.catalog.companies) {
  for (const g of co.grouts) if (g.name === "PermaColor Select") Object.assign(g, { price: 24, cost: 14.2, base: { sku: "1519001", name: "PermaColor Sanded Base", unit: "bags", price: 31, cost: 18.6, per: 1 } });
  for (const m of co.mortars) if (m.name === "ProLite") Object.assign(m, { price: 38, cost: 0 });
  for (const u of co.underlayments) if (u.name === "HardieBacker") Object.assign(u, { price: 19.5, cost: 11.75 });
}
const row = { ...newProduct(), sku: "TILE-1", brandColor: "Emser Catch — Bone", L: "12", W: "12", thickness: "0.375", priceSqft: "5.40", costSqft: "3.10", qty: "180",
  grout: { ...newProduct().grout, checked: true, product: "PermaColor Select", color: "Almond", joint: 0.125, caulk: "2", caulkSku: "1519067", caulkPrice: "12.50", caulkCost: "" },
  mortar: { checked: true, product: "ProLite", manual: "" },
  underlay: { checked: true, product: "HardieBacker", manual: "", install: false, installMortars: {}, installSkip: {} } };
const area = { ...newArea(), name: "Master bath", products: [row] };
const project = { ...newProject(null, "Employee pricing — extras cost"), id: "p1", priceTier: "employee", categories: [area] };
const now = new Date().toISOString();
const TABLES = {
  projects: [{ id: "p1", customer_id: null, project_no: 133, created_at: now, updated_at: now, name: project.name, quick: "false", sales: "", data: project }],
  app_data: [{ data: { profile: { name: "Preview" } } }],
  shared_settings: [{ data: serializeSettings(settings) }],
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

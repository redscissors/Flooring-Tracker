// Stand-in for src/lib/supabase.js (aliased in by vite.config.mjs): a chainable
// thenable query builder over seeded rows, so the REAL App.jsx boots with no
// network. Writes are accepted and dropped. Dev-only proof harness.
import { newProject, newArea, newProduct } from "../../src/model.js";

const tile = { ...newProduct(), type: "tile", sku: "HC1224AS", brandColor: "Aniston Silver Polished", sizeText: "12×24", L: "12", W: "24", priceSqft: "4.79", qty: "138", cartonSf: "15.5", grout: { ...newProduct().grout, checked: true, product: "Mapei Ultracolor Plus FA", color: "Warm Gray" } };
const misc = { ...newProduct(), type: "misc", brandColor: "Delivery / haul-away", qtyType: "count", qty: "1", priceSqft: "75" };
const area = { ...newArea(), name: "Kitchen", products: [tile, misc, newProduct()] };
const project = { ...newProject(null, "Yoder, Josiah"), id: "p1", categories: [area] };
const now = new Date().toISOString();
const TABLES = {
  projects: [{ id: "p1", customer_id: null, project_no: 131, created_at: now, updated_at: now, name: project.name, quick: "false", sales: "", data: project }],
  app_data: [{ data: { profile: { name: "Josiah" } } }],
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

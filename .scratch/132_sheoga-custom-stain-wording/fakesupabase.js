// Stand-in for src/lib/supabase.js (aliased in by vite.config.mjs): a chainable
// thenable query builder over seeded rows, so the REAL App.jsx boots with no
// network. Writes are accepted and dropped. Dev-only proof harness.
// Seed: Marcus's flagged line (issue 132) rebuilt through lineItems() from the
// same configuration — Hickory character solid 4¼", custom stain, 1474 sf.
import { newProject, newArea, newProduct } from "../../src/model.js";
import { defaultConfig, lineItems } from "../../src/sheoga.js";

const cfg = { ...defaultConfig("floor"), sp: "Hickory", grade: "char", cons: "solid", w: 4.25, finish: "t1", stain: "S-46297 Dark Chocolate", sheen: "30" };
const rows = lineItems({ mode: "floor", cfg }, { sf: 1474, markupPct: 40 }).map((r) => ({ ...newProduct(), ...r }));
const area = { ...newArea(), name: "Area 1", products: rows };
const project = { ...newProject(null, "Q-Sheoga — Hickory Character Sol-9/9"), id: "p1", categories: [area] };
const now = new Date().toISOString();
const TABLES = {
  projects: [{ id: "p1", customer_id: null, project_no: 132, created_at: now, updated_at: now, name: project.name, quick: "false", sales: "", data: project }],
  app_data: [{ data: { profile: { name: "Marcus" } } }],
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

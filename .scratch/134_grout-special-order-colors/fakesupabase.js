// Stand-in for src/lib/supabase.js (aliased in by vite.config.mjs): a chainable
// thenable query builder over seeded rows, so the REAL App.jsx boots with no
// network. Writes are accepted and dropped. Dev-only proof harness.
// Seed (issue 134): a stock book (DOIT) carrying the 9 SpectraLOCK 1 colors
// the shop stocks + Latasil caulk, a Laticrete order book carrying the whole
// range, and a "SpectraLOCK 1" family whose stock rule reads DOIT and whose
// special-order source reads the Laticrete list. The job has one line on a
// stocked color and one on a special-order color.
import { newProject, newArea, newProduct } from "../../src/model.js";
import { normalizeSettings, serializeSettings } from "../../src/catalog.js";

const STOCKED = [["24", "NATURAL GREY"], ["85", "ALMOND"], ["44", "BRIGHT WHITE"], ["45", "RAVEN"], ["60", "DUSTY GREY"], ["89", "SMOKE GREY"], ["93", "FOSSIL"], ["88", "SILVER SHADOW"], ["18", "SAUTERNE"]];
const RANGE = [...STOCKED, ["03", "SILK"], ["10", "ANTIQUE WHITE"], ["17", "MARBLE BEIGE"], ["22", "MIDNIGHT BLACK"], ["25", "RIVER ROCK"], ["30", "SAND BEIGE"], ["35", "MOCHA"], ["39", "MUSHROOM"], ["41", "BLACK"], ["52", "TOASTED ALMOND"], ["53", "TWILIGHT BLUE"], ["57", "HOT COCOA"], ["61", "PARCHMENT"], ["78", "STERLING SILVER"], ["90", "LIGHT PEWTER"], ["91", "SLATE GREY"]];
const item = (book_id, sku, description, extra = {}) => ({ book_id, sku, active: true, disabled: false, updated_at: "2026-09-01T00:00:00Z", data: { description, unit: "EA", ...extra } });
const doitItems = [
  ...STOCKED.map(([n, c]) => item("doit", `DOIT-SL1-${n}`, `1 GAL SPECTRALOCK 1 PRE-MIXED GROUT ${n} ${c}`, { price: 62, cost: 41.2 })),
  ...STOCKED.slice(0, 4).map(([n, c]) => item("doit", `DOIT-LAT-${n}`, `10.3 OZ LATASIL ${n} ${c} - 100% SILICONE CAULK`, { price: 12.25, cost: 6.1 })),
];
const latItems = RANGE.map(([n, c]) => item("lat", `LAT-SL1-${n}`, `SPECTRALOCK 1 PRE-MIXED GROUT ${n} ${c} 1 GAL`, { cost: 43.5, mfg: "LATICRETE" }));

const settings = normalizeSettings(undefined);
for (const co of settings.catalog.companies) for (const g of co.grouts) if (g.name === "SpectraLOCK 1") Object.assign(g, { price: 62, cost: 41.2, unit: "gal", book: "SpectraLOCK 1" });
settings.catalog.bookFamilies = [{
  id: "fam-sl1", name: "SpectraLOCK 1", bookId: "doit",
  rule: { prefix: "1 GAL SPECTRALOCK 1 PRE-MIXED GROUT", suffix: "" },
  baseSkus: { default: "", variant: "" },
  caulk: { bookId: "doit", prefix: "10.3 OZ LATASIL", suffix: "- 100% SILICONE CAULK" },
  order: { bookId: "lat", prefix: "SPECTRALOCK 1 PRE-MIXED GROUT", suffix: "1 GAL" },
  cache: [],
}];
const tile = (name, qty, grout) => ({ ...newProduct(), sku: "TILE-1", bookId: "doit", brandColor: name, L: "12", W: "24", thickness: "0.375", priceSqft: "5.40", costSqft: "3.10", qty: String(qty),
  grout: { ...newProduct().grout, checked: true, product: "SpectraLOCK 1", joint: 0.125, ...grout }, mortar: { checked: true, product: "ProLite", manual: "" } });
const area = { ...newArea(), name: "Master bath", products: [
  tile("Emser Catch — Bone", 180, { color: "Natural Grey", sku: "DOIT-SL1-24", bookId: "doit", caulk: "2", caulkSku: "DOIT-LAT-24", caulkPrice: "12.25", caulkCost: "6.1" }),
  tile("Emser Catch — Slate", 90, { color: "Midnight Black", sku: "LAT-SL1-22", bookId: "lat" }),
] };
const project = { ...newProject(null, "Special-order grout colors"), id: "p1", categories: [area] };
const now = new Date().toISOString();
const TABLES = {
  projects: [{ id: "p1", customer_id: null, project_no: 134, created_at: now, updated_at: now, name: project.name, quick: "false", sales: "", data: project }],
  app_data: [{ data: { profile: { name: "Preview" } } }],
  shared_settings: [{ data: serializeSettings(settings) }],
  price_books: [
    { id: "doit", kind: "stock", name: "DOIT — Vendor SKU Analysis", active: true, data: {}, updated_at: now },
    { id: "lat", kind: "order", name: "Laticrete price list", active: true, data: { brandLabel: "Laticrete", markups: { default: 40 } }, updated_at: now },
  ],
  price_book_items: [...doitItems, ...latItems],
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

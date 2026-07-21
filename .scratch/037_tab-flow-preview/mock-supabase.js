// Preview stand-in for src/lib/supabase.js (tab-flow cleanup 2026-07-21).
// Hands the REAL app a fake signed-in session, an empty directory, and a small
// in-memory stock book so the keyboard flow can be exercised end-to-end with
// no network and no live Supabase project. Wired in only by the vite.config.mjs
// next to it — the production build never sees this file.

const user = { id: "preview-user", email: "preview@floortrack.local" };

// Enough of a stock book to demo the search-pick → SF → extras flow. Shapes
// mirror the stock_items table (normStockItem reads sku/active/data.*).
const STOCK_ROWS = [
  { sku: "1224CARR", active: true, data: { section: "Porcelain Tile", brand: "Anatolia", description: "Carrara Bianco Polished Rectified Porcelain", product: "Carrara Bianco", unit: "CT", size: '12" x 24"', thickness: '3/8"', type: "tile", price: 68.55, priceSqft: 4.39, sfPerUnit: 15.6 } },
  { sku: "0606HEXW", active: true, data: { section: "Mosaics", brand: "Daltile", description: "White Hex Mosaic on Mesh", product: "White Hex", unit: "SF", size: '2" Hex', type: "tile", priceSqft: 8.9 } },
  { sku: "MAXAPEX7", active: true, data: { section: "LVP", brand: "Mannington", description: "Adura Max Apex Sundance Gold Rush", product: "Sundance", unit: "CT", size: '7" x 48"', type: "vinyl", price: 112.4, priceSqft: 4.55, sfPerUnit: 24.7 } },
];

const TABLES = { stock_items: () => STOCK_ROWS };

// Chainable, thenable query builder: every method returns the builder; awaiting
// it resolves { data, error: null } — a maybeSingle() resolves null data.
const builder = (table) => {
  let single = false;
  const p = new Proxy({}, {
    get(_, k) {
      if (k === "then") return (resolve) => resolve({ data: single ? null : (TABLES[table] ? TABLES[table]() : []), error: null });
      if (k === "maybeSingle" || k === "single") return () => { single = true; return p; };
      return () => p;
    },
  });
  return p;
};

export const isConfigured = true;
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: { user } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  from: (table) => builder(table),
  rpc: async () => ({ data: [], error: null }),
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      download: async () => ({ data: new Blob([""]), error: null }),
      remove: async () => ({ error: null }),
    }),
  },
};

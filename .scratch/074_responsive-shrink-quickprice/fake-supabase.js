// A stand-in for src/lib/supabase.js so the REAL App.jsx can be booted in a
// browser with no network and no credentials. Vite aliases lib/supabase.js to
// this file in vite.preview.config.js; nothing here ships.
//
// It implements only the slice of the query-builder surface the app's boot and
// write paths touch: select/eq/or/order/range/maybeSingle + insert/update/
// upsert/delete (writes are no-ops that resolve clean), plus stubs for auth and
// storage. Reads are served from the seeded tables below.
import { SEED } from "./seed.js";

const tables = SEED();

function builder(name) {
  let rows = tables[name] ? [...tables[name]] : [];
  const q = {
    select: () => q,
    eq: (col, val) => { rows = rows.filter((r) => r[col] === val); return q; },
    or: () => q,
    in: (col, vals) => { rows = rows.filter((r) => vals.includes(r[col])); return q; },
    order: () => q,
    limit: (n) => { rows = rows.slice(0, n); return q; },
    range: async (from, to) => ({ data: rows.slice(from, to + 1), error: null }),
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    single: async () => ({ data: rows[0] ?? null, error: null }),
    insert: async () => ({ data: null, error: null }),
    update: () => ({ eq: async () => ({ error: null }) }),
    upsert: async () => ({ error: null }),
    delete: () => ({ eq: async () => ({ error: null }), in: async () => ({ error: null }) }),
    then: (ok, err) => Promise.resolve({ data: rows, error: null }).then(ok, err),
  };
  return q;
}

export const isConfigured = true;
export const supabase = {
  from: (name) => builder(name),
  rpc: async () => ({ data: [], error: null }),
  auth: {
    getSession: async () => ({ data: { session: { user: { id: "u1", email: "marcus@example.com" } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ error: null }),
      download: async () => ({ data: null, error: new Error("no storage in preview") }),
      remove: async () => ({ error: null }),
    }),
  },
};

import { useCallback, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { normBookItem, pricedItem, trimsForFloor } from "./orderbook.js";

// Session cache of a floor's trims (ADR 0012's `fits` relation, read the
// direction the grid needs). A floor is looked up by a small set of exact
// keys, not one SKU: its own row SKU plus, for an ERP stock floor, the
// manufacturer codes extracted from its ERP description (trims.js
// vendorCodeCandidates) — the shop's internal code never appears in a vendor
// book's `fits`, the manufacturer's does. The query spans every active
// registry book (the relation is stated in the vendor's order book whichever
// book the floor was picked from). Fetched when a bookId row's materials
// drawer opens, so the drawer's Trims row can show — or stay hidden — without
// the popup ever opening onto a spinner. The stock-over-order preference is
// applied at render (preferStockTrims), not here.
export function useTrims({ books }) {
  const cacheRef = useRef({});
  const pending = useRef(new Set());
  const [, bump] = useState(0);
  const ck = (keys) => (keys || []).join("\n");

  // The cached priced trim list for a floor's key set, or undefined while unknown.
  const trimsFor = (keys) => (keys?.length ? cacheRef.current[ck(keys)] : undefined);

  const ensureTrims = useCallback((keys) => {
    const ks = [...new Set((keys || []).filter(Boolean))];
    if (!ks.length) return;
    const k = ck(ks);
    if (k in cacheRef.current || pending.current.has(k)) return;
    const active = books.filter((b) => b.active !== false);
    if (!active.length) return;
    pending.current.add(k);
    (async () => {
      try {
        const base = () => supabase.from("price_book_items").select("*")
          .in("book_id", active.map((b) => b.id)).eq("active", true);
        // One exact-containment query per key — jsonb `cs` can't OR safely
        // across quoted values, and the key set is tiny (≤4).
        const perKey = await Promise.all(ks.map(async (key) => {
          const { data: rows, error } = await base().filter("data->fits", "cs", JSON.stringify([key])).limit(80);
          if (error) throw error;
          return trimsForFloor((rows || []).map((r) => normBookItem(r, r.book_id)), key);
        }));
        const markups = (id) => active.find((b) => b.id === id)?.data?.markups;
        const seen = new Set();
        const items = perKey.flat()
          .filter((it) => { const id = `${it.bookId}\n${it.sku}`; if (seen.has(id)) return false; seen.add(id); return true; })
          .map((it) => pricedItem(it, markups(it.bookId)))
          .sort((a, b) => a.sku.localeCompare(b.sku));
        cacheRef.current = { ...cacheRef.current, [k]: items };
        bump((n) => n + 1);
      } catch (x) { /* leave unfetched — retried on the next drawer open */ }
      finally { pending.current.delete(k); }
    })();
  }, [books]);

  // An applied import may add/retire/reprice trims in any book, and entries
  // span books — drop the whole cache (called beside the row-drift cache
  // clear; it refills per drawer open).
  const clearTrims = useCallback(() => {
    if (!Object.keys(cacheRef.current).length) return;
    cacheRef.current = {};
    bump((n) => n + 1);
  }, []);

  return { trimsFor, ensureTrims, clearTrims };
}

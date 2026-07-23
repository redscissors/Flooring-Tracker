import { useCallback, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { normBookItem, pricedItem, trimsForFloor } from "./orderbook.js";

// Session cache of a floor's trims (ADR 0012's `fits` relation, read the
// direction the grid needs), keyed by the floor's SKU. The query spans EVERY
// active registry book — stock and order alike — because the relation is
// stated in the vendor's order book while the floor may have been picked from
// an ERP stock export under the same vendor SKU (the mergeSearch doctrine:
// exact SKU equality across spaces is the same product). Fetched when a
// bookId row's materials drawer opens, so the drawer's Trims row can show —
// or stay hidden — without the popup ever opening onto a spinner. The
// stock-over-order preference is applied at render (preferStockTrims), not
// here, so the cache stays valid as the stock cache finishes loading.
export function useTrims({ books }) {
  const cacheRef = useRef({});
  const pending = useRef(new Set());
  const [, bump] = useState(0);

  // The cached priced trim list for a floor SKU, or undefined while unknown.
  const trimsFor = (sku) => cacheRef.current[sku];

  const ensureTrims = useCallback((sku) => {
    if (!sku || sku in cacheRef.current || pending.current.has(sku)) return;
    const active = books.filter((b) => b.active !== false);
    if (!active.length) return;
    pending.current.add(sku);
    (async () => {
      try {
        const { data: rows, error } = await supabase.from("price_book_items").select("*")
          .in("book_id", active.map((b) => b.id)).eq("active", true)
          .filter("data->fits", "cs", JSON.stringify([sku])).limit(80);
        if (error) throw error;
        const markups = (id) => active.find((b) => b.id === id)?.data?.markups;
        const items = trimsForFloor((rows || []).map((r) => normBookItem(r, r.book_id)), sku)
          .map((it) => pricedItem(it, markups(it.bookId)))
          .sort((a, b) => a.sku.localeCompare(b.sku));
        cacheRef.current = { ...cacheRef.current, [sku]: items };
        bump((n) => n + 1);
      } catch (x) { /* leave unfetched — retried on the next drawer open */ }
      finally { pending.current.delete(sku); }
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

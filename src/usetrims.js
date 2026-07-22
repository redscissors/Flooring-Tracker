import { useCallback, useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { normBookItem, pricedItem, trimsForFloor } from "./orderbook.js";

// Session cache of a book floor's trims (ADR 0012's `fits` relation, read the
// direction the grid needs). Fetched when a bookId row's materials drawer
// opens, so the drawer's Trims row can show — or stay hidden — without the
// popup ever opening onto a spinner. One registry table serves order and
// stock books alike, so a single containment query covers both.
export function useTrims({ books }) {
  const cacheRef = useRef({});
  const pending = useRef(new Set());
  const [, bump] = useState(0);
  const key = (bookId, sku) => `${bookId}\n${sku}`;

  // The cached priced trim list, or undefined while unknown.
  const trimsFor = (bookId, sku) => cacheRef.current[key(bookId, sku)];

  const ensureTrims = useCallback((bookId, sku) => {
    if (!bookId || !sku) return;
    const k = key(bookId, sku);
    if (k in cacheRef.current || pending.current.has(k)) return;
    pending.current.add(k);
    (async () => {
      try {
        const { data: rows, error } = await supabase.from("price_book_items").select("*")
          .eq("book_id", bookId).eq("active", true)
          .filter("data->fits", "cs", JSON.stringify([sku])).limit(80);
        if (error) throw error;
        const markups = books.find((b) => b.id === bookId)?.data?.markups;
        const items = trimsForFloor((rows || []).map((r) => normBookItem(r, bookId)), sku)
          .map((it) => pricedItem(it, markups))
          .sort((a, b) => a.sku.localeCompare(b.sku));
        cacheRef.current = { ...cacheRef.current, [k]: items };
        bump((n) => n + 1);
      } catch (x) { /* leave unfetched — retried on the next drawer open */ }
      finally { pending.current.delete(k); }
    })();
  }, [books]);

  // An applied import may add/retire/reprice trims — drop the book's entries
  // (called beside the row-drift cache clear).
  const clearTrims = useCallback((bookId) => {
    const next = {};
    let changed = false;
    for (const k of Object.keys(cacheRef.current)) {
      if (k.startsWith(`${bookId}\n`)) { changed = true; continue; }
      next[k] = cacheRef.current[k];
    }
    if (changed) { cacheRef.current = next; bump((n) => n + 1); }
  }, []);

  return { trimsFor, ensureTrims, clearTrims };
}

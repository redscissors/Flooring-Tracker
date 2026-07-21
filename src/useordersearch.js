import { useMemo, useRef, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import { normBookItem, pricedItem, orderFloorFirst } from "./orderbook.js";
import { expand } from "./synonyms.js";
import { SKU_SHOW } from "./search.jsx";

export function useOrderSearch({ books, sel, orderItems, setOrderItems }) {
  const orderBooks = useMemo(() => books.filter((b) => b.kind === "order" && b.active), [books]);
  const bookName = (id) => books.find((b) => b.id === id)?.name || "special order";
  // Prefer the fuzzy RPC (supabase/pricebook-fuzzy.sql); flips false for the
  // session the first time the function is absent, so the search keeps working
  // before the migration is run — just via the exact-substring ILIKE fallback
  // below (still synonym-aware, just no typo tolerance).
  const fuzzyRpc = useRef(true);
  // Debounced server-side search across every active order book (§6). Order
  // items aren't eagerly loaded (a vendor book runs to thousands of rows), so
  // the selection-row pickers query price_book_items on demand, price each hit
  // by its book's markup, and stream the results in behind the instant stock
  // matches. null with no order books — the pickers behave exactly as before,
  // stock-only.
  const searchOrder = useMemo(() => {
    if (!orderBooks.length) return null;
    const byId = new Map(orderBooks.map((b) => [b.id, b]));
    const ids = orderBooks.map((b) => b.id);
    const price = (rows) => (rows || []).map((r) => pricedItem(normBookItem(r, r.book_id), byId.get(r.book_id)?.data?.markups));
    const base = () => supabase.from("price_book_items").select("*").in("book_id", ids).eq("active", true).limit(SKU_SHOW * 2);
    // Every group must match (AND across the typed words), matching searchStock's
    // word-by-word rule; within a group any synonym alternate matches (OR).
    // `size` isn't in the generated search_text column, so the ILIKE fallback ORs
    // it in explicitly — that keeps size searchable ("12x24 white") without a
    // SQL re-run (search_text already covers the rest, index-backed).
    const fields = ["sku", "data->>description", "data->>product", "data->>brand", "data->>mfg", "data->>color", "data->>size"];
    return async (q) => {
      const words = q.replace(/[%_,()"\\]/g, " ").trim().split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      const groups = words.map(expand); // Option D: each word -> [itself, ...synonyms]
      if (fuzzyRpc.current) {
        const { data: rows, error } = await supabase.rpc("search_price_book_items", { p_book_ids: ids, p_groups: groups, p_threshold: 0.3, p_limit: SKU_SHOW * 2 });
        // The client-side disabled guard (both paths) also covers installs
        // where the RPC/column migrations haven't been re-run yet.
        if (!error) return orderFloorFirst(price(rows).filter((it) => !it.disabled), q);
        // PGRST202 / 42883 = undefined_function: the fuzzy migration isn't run yet.
        if (error.code !== "PGRST202" && error.code !== "42883") throw error;
        fuzzyRpc.current = false;
      }
      let query = base();
      for (const grp of groups) query = query.or(grp.flatMap((alt) => fields.map((f) => `${f}.ilike.%${alt}%`)).join(","));
      const { data: rows, error } = await query;
      if (error) throw error;
      return orderFloorFirst(price(rows).filter((it) => !it.disabled), q);
    };
  }, [orderBooks]);
  // The distinct (book, SKU) pairs the open project's order rows reference, as
  // a stable JSON signature so the fetch below fires only when that set changes
  // (sel is a fresh object on every edit, not a useful dependency by itself).
  const orderRowKeys = useMemo(() => {
    const seen = new Set();
    const pairs = [];
    for (const a of sel?.categories || []) for (const p of a.products || []) {
      if (!p.bookId || !p.sku) continue;
      const k = JSON.stringify([p.bookId, p.sku]);
      if (seen.has(k)) continue;
      seen.add(k);
      pairs.push([p.bookId, p.sku]);
    }
    pairs.sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
    return JSON.stringify(pairs);
  }, [sel]);
  // Fetch just those SKUs (one query per book, only keys not resolved yet), so
  // the row drift chip can compare against today's cost x markup without ever
  // loading a whole vendor book. Missing SKUs resolve to null and stay cached.
  useEffect(() => {
    const pairs = JSON.parse(orderRowKeys || "[]");
    const want = new Map();
    for (const [bookId, sku] of pairs) {
      if (orderItems[bookId] && sku in orderItems[bookId]) continue;
      if (!want.has(bookId)) want.set(bookId, new Set());
      want.get(bookId).add(sku);
    }
    if (!want.size) return;
    let stale = false;
    (async () => {
      const adds = {};
      for (const [bookId, skus] of want) {
        try {
          const { data: rows, error } = await supabase.from("price_book_items").select("sku, active, data, updated_at").eq("book_id", bookId).in("sku", [...skus]);
          if (error) throw error;
          const m = { ...(adds[bookId] || {}) };
          for (const sku of skus) m[sku] = null;
          for (const r of rows || []) m[r.sku] = normBookItem(r, bookId);
          adds[bookId] = m;
        } catch (x) { /* leave unresolved; retried when the key set next changes */ }
      }
      if (!stale && Object.keys(adds).length) setOrderItems((prev) => {
        const next = { ...prev };
        for (const bid of Object.keys(adds)) next[bid] = { ...(next[bid] || {}), ...adds[bid] };
        return next;
      });
    })();
    return () => { stale = true; };
  }, [orderRowKeys]);

  return { searchOrder, orderRowKeys, bookName };
}

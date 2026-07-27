import { useMemo, useRef, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import { normBookItem, pricedItem, orderFloorFirst } from "./orderbook.js";
import { expand } from "./synonyms.js";
import { SKU_SHOW } from "./search.jsx";

export function useOrderSearch({ books, sel, orderItems, setOrderItems }) {
  const orderBooks = useMemo(() => books.filter((b) => b.kind === "order" && b.active), [books]);
  const bookName = (id) => books.find((b) => b.id === id)?.name || "special order";
  // The fuzzy RPC (supabase/pricebook-fuzzy.sql) and the generated search_text
  // column (supabase/pricebook-search.sql). Each flips false for the session the
  // first time Postgres says it isn't there, so an install that hasn't run the
  // migrations still searches — just without typo tolerance / off an unindexed
  // per-field scan.
  const fuzzyRpc = useRef(true);
  const searchCol = useRef(true);
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
    const rowsOf = async (query) => {
      const { data: rows, error } = await query;
      return { rows, error };
    };
    // The EXACT pass — every typed word literally present. search_text is the
    // generated column pricebook-search.sql adds, and its trigram GIN index
    // makes this substring form index-backed; `size` isn't in it, so it's ORed
    // in explicitly. Without the migration this degrades to the per-field ILIKE
    // (a scan, but the same result set).
    const exactRows = async (groups) => {
      if (searchCol.current) {
        let query = base();
        for (const grp of groups) query = query.or(grp.flatMap((alt) => [`search_text.ilike.%${alt}%`, `data->>size.ilike.%${alt}%`]).join(","));
        const { rows, error } = await rowsOf(query);
        if (!error) return rows;
        if (error.code !== "42703") throw error; // undefined_column: migration not run
        searchCol.current = false;
      }
      let query = base();
      for (const grp of groups) query = query.or(grp.flatMap((alt) => fields.map((f) => `${f}.ilike.%${alt}%`)).join(","));
      const { rows, error } = await rowsOf(query);
      if (error) throw error;
      return rows;
    };
    // The NEAR-MATCH pass — trigram similarity, only ever reached when the
    // exact pass came back empty. It lives entirely in the RPC: with no fuzzy
    // migration there is no near-match tier at all (repeating the exact pass
    // here would just re-return the empty set that got us here).
    const nearRows = async (groups, threshold) => {
      if (!fuzzyRpc.current) return [];
      const { data: rows, error } = await supabase.rpc("search_price_book_items", { p_book_ids: ids, p_groups: groups, p_threshold: threshold, p_limit: SKU_SHOW * 2 });
      if (!error) return rows;
      // PGRST202 / 42883 = undefined_function: the fuzzy migration isn't run yet.
      if (error.code !== "PGRST202" && error.code !== "42883") throw error;
      fuzzyRpc.current = false;
      return [];
    };
    // threshold null/omitted = the exact pass; a number = the near-match pass at
    // that cutoff. The client-side disabled guard (both paths) also covers
    // installs where the column migrations haven't been re-run yet.
    return async (q, threshold = null) => {
      const words = q.replace(/[%_,()"\\]/g, " ").trim().split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      const groups = words.map(expand); // Option D: each word -> [itself, ...synonyms]
      const rows = threshold == null ? await exactRows(groups) : await nearRows(groups, threshold);
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
    // orderItems is a dependency so an import invalidation (App clears the
    // book's entries) re-resolves the open rows' keys; the cached-key guard
    // above keeps the effect from looping on its own writes.
  }, [orderRowKeys, orderItems]);

  return { searchOrder, orderRowKeys, bookName };
}

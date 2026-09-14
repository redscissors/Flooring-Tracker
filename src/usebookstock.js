// src/usebookstock.js
import { useEffect, useMemo, useRef, useState } from "react";

// Stock-kind registry books' items, cached like the ADR 0003 stock cache:
// bounded (the shop's own ERP exports, ~1k rows total), loaded in the
// background after the books metadata arrives (ADR 0026), read by the grout
// family projection, the Settings picker, and link warnings.
//
// `familyBookIds` are the order-kind books a grout family's special-order
// source names (ADR 0027 amendment 2026-09-13). Those load into their OWN map
// (`orderBookStock`) so nothing that reads `bookStock` — the instant stock
// search tier, the family seed picker, the link migration — ever sees a
// vendor list as shop stock; `familyItems` is the union the projection reads.
export function useBookStock({ books, loadBookItems, familyBookIds = [] }) {
  const [bookStock, setBookStock] = useState({});
  const [orderBookStock, setOrderBookStock] = useState({});
  const [bookStockReady, setBookStockReady] = useState(false);
  const loading = useRef(false);
  const familyLoading = useRef(new Set());

  const loadFamilyBook = async (bookId) => {
    if (!bookId || familyLoading.current.has(bookId)) return;
    familyLoading.current.add(bookId);
    try {
      let items = [];
      try { items = await loadBookItems(bookId); } catch { items = []; }
      setOrderBookStock((m) => ({ ...m, [bookId]: items }));
    } finally { familyLoading.current.delete(bookId); }
  };

  const loadAllBookStock = async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const targets = books.filter((b) => b.kind === "stock" && b.active !== false);
      const out = {};
      for (const b of targets) { try { out[b.id] = await loadBookItems(b.id); } catch { out[b.id] = []; } }
      setBookStock(out);
      await Promise.all(familyBookIds.map(loadFamilyBook));
      setBookStockReady(true);
    } finally { loading.current = false; }
  };

  // A source added after boot (Settings just linked a family to a vendor list)
  // loads on its own; one attempt per book, a failure leaves it empty.
  useEffect(() => {
    if (!bookStockReady) return;
    for (const id of familyBookIds) if (!(id in orderBookStock)) loadFamilyBook(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the id list only
  }, [bookStockReady, familyBookIds.join("|")]);

  const refreshBookStock = async (bookId) => {
    const items = await loadBookItems(bookId);
    if (bookId in orderBookStock) setOrderBookStock((m) => ({ ...m, [bookId]: items }));
    else setBookStock((m) => ({ ...m, [bookId]: items }));
    return items;
  };

  const familyItems = useMemo(() => ({ ...orderBookStock, ...bookStock }), [bookStock, orderBookStock]);

  return { bookStock, orderBookStock, familyItems, bookStockReady, loadAllBookStock, refreshBookStock, loadFamilyBook };
}

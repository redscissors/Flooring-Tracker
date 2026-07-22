// src/usebookstock.js
import { useRef, useState } from "react";

// Stock-kind registry books' items, cached like the ADR 0003 stock cache:
// bounded (the shop's own ERP exports, ~1k rows total), loaded in the
// background after the books metadata arrives (ADR 0026), read by the grout
// family projection, the Settings picker, and link warnings.
export function useBookStock({ books, loadBookItems }) {
  const [bookStock, setBookStock] = useState({});
  const [bookStockReady, setBookStockReady] = useState(false);
  const loading = useRef(false);

  const loadAllBookStock = async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const targets = books.filter((b) => b.kind === "stock" && b.active !== false);
      const out = {};
      for (const b of targets) { try { out[b.id] = await loadBookItems(b.id); } catch { out[b.id] = []; } }
      setBookStock(out);
      setBookStockReady(true);
    } finally { loading.current = false; }
  };

  const refreshBookStock = async (bookId) => {
    const items = await loadBookItems(bookId);
    setBookStock((m) => ({ ...m, [bookId]: items }));
    return items;
  };

  return { bookStock, bookStockReady, loadAllBookStock, refreshBookStock };
}

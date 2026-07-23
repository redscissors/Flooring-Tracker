import { useState } from "react";
import { supabase } from "./lib/supabase.js";
import { fetchAllRows } from "./fetchall.js";
import { normBook } from "./bootload.js";
import { normBookItem, bookItemData } from "./orderbook.js";
import { uid } from "./model.js";
import { BOOK_VERSION_KEEP } from "./uiconst.js";

export function useBooks({ user, profile, ping, flashSaved }) {
  // Price book library (ADR 0009): registry books beyond the stock workbook.
  // Metadata loads in the background after first paint; a book's items load
  // lazily when it's opened (a vendor book is ~10x the stock book). Empty
  // until the team has run supabase/pricebooks.sql.
  const [books, setBooks] = useState([]);
  // Current book items for the SKUs on the open project's order rows, nested
  // { [bookId]: { [sku]: normBookItem | null } }. Order items aren't eagerly
  // loaded, so the row drift chip fetches just the handful of SKUs actually on
  // the estimate on demand; a SKU that has left the book resolves to null and
  // stays cached so it isn't refetched.
  const [orderItems, setOrderItems] = useState({});

  // --- price book library (ADR 0009) -----------------------------------------
  //
  // Registry books (stock- and order-kind) live in price_books; their items in
  // price_book_items, one row per (book_id, sku). Same trust + no-delete rules
  // as stock_items. Writes go only through these paths.

  // A book's items, loaded on demand (Settings browse). Not held in app state —
  // the caller keeps them while the book is open.
  const loadBookItems = async (bookId) => {
    const rows = await fetchAllRows(() => supabase.from("price_book_items").select("*").eq("book_id", bookId).order("sku"));
    return rows.map((r) => normBookItem(r, bookId));
  };

  const addBook = async ({ kind, name }) => {
    const id = uid();
    const row = { id, kind, name: name || "", active: true, data: {} };
    setBooks((bs) => [...bs, normBook(row)]);
    try { const { error } = await supabase.from("price_books").insert(row); if (error) throw error; flashSaved(); }
    catch (x) { ping("Couldn't create book — has supabase/pricebooks.sql been run?"); }
    return id;
  };

  // Column fields (name/active) and/or a merge into the data jsonb. Whole-record
  // upsert of that one row, last-write-wins like settings.
  const updateBook = async (id, { name, active, dataPatch } = {}) => {
    const book = books.find((b) => b.id === id);
    if (!book) return;
    const nextData = dataPatch ? { ...book.data, ...dataPatch } : book.data;
    setBooks((bs) => bs.map((b) => b.id === id ? { ...b, ...(name != null ? { name } : {}), ...(active != null ? { active } : {}), data: nextData } : b));
    const cols = {};
    if (name != null) cols.name = name;
    if (active != null) cols.active = active;
    if (dataPatch) cols.data = nextData;
    try { const { error } = await supabase.from("price_books").update(cols).eq("id", id); if (error) throw error; flashSaved(); }
    catch (x) { ping("Save failed"); }
  };

  // Permanently remove a registry book: its items, its import history, then the
  // book row (in that order — price_book_items has a FK to price_books). Unlike
  // every other price-book write this is a hard delete (ADR 0009 delete amendment). Saved
  // selections that referenced the book keep their snapshotted values — only the
  // live drift/freight chips for that book stop resolving. Needs the DELETE
  // policies from supabase/pricebook-delete.sql.
  const delBook = async (id) => {
    setBooks((bs) => bs.filter((b) => b.id !== id));
    try {
      let { error } = await supabase.from("price_book_items").delete().eq("book_id", id);
      if (error) throw error;
      ({ error } = await supabase.from("pricebook_versions").delete().eq("book_id", id));
      if (error) throw error;
      ({ error } = await supabase.from("price_books").delete().eq("id", id));
      if (error) throw error;
      flashSaved();
    } catch (x) { ping("Delete failed — has supabase/pricebook-delete.sql been run?"); }
  };

  // Apply a mapped-import diff: upsert added/changed items, mark missing SKUs
  // inactive (never delete), stamp the book's lastImport. opts.disableSkus (PR B)
  // are the SKUs the user ignored or superseded — they land disabled. Every
  // upsert row carries an explicit `disabled` so the batch's columns are uniform
  // for PostgREST: added take the ignore value; changed/missing preserve their
  // prior disabled unless newly ignored. Ignored SKUs in no bucket (unchanged
  // rows) are disabled through the PR A path. A changed row also keeps the
  // previous item's flagReview — a confirmed/ignored flag survives the
  // re-import just like the disabled column, so it never re-nags.
  const applyBookImport = async (bookId, diff, opts = {}) => {
    const disable = new Set(opts.disableSkus || []);
    const off = (sku, prevDisabled) => (disable.has(sku) ? true : !!prevDisabled);
    const upserts = [
      ...diff.added.map((it) => ({ book_id: bookId, sku: it.sku, active: true, disabled: disable.has(it.sku), data: bookItemData(it) })),
      ...diff.changed.map(({ item, prev }) => ({ book_id: bookId, sku: item.sku, active: true, disabled: off(item.sku, prev?.disabled), data: bookItemData(prev?.flagReview ? { ...item, flagReview: prev.flagReview } : item) })),
      ...diff.missing.map((it) => ({ book_id: bookId, sku: it.sku, active: false, disabled: off(it.sku, it.disabled), data: bookItemData(it) })),
    ];
    for (let i = 0; i < upserts.length; i += 200) {
      const { error } = await supabase.from("price_book_items").upsert(upserts.slice(i, i + 200), { onConflict: "book_id,sku" });
      if (error) throw error;
    }
    const inBuckets = new Set(upserts.map((u) => u.sku));
    const rest = [...disable].filter((s) => !inBuckets.has(s));
    if (rest.length) await setBookItemsDisabled(bookId, rest, true);
    // A disable-only apply (identical book, just toggling SKUs) must NOT reset
    // the book's last-import date/staleness or add an import-history version —
    // no vendor data actually landed. Only a real import stamps/snapshots.
    if (!upserts.length) { flashSaved(); return; }
    const li = { at: Date.now(), by: profile.name || user.email || "", count: diff.added.length + diff.changed.length };
    if (opts.superseded?.length) li.superseded = opts.superseded;
    if (disable.size) li.disabled = disable.size;
    if (opts.forced) li.forced = true; // a forced full re-import, not an ordinary delta import
    const dataPatch = { lastImport: li };
    // Remember what this file looks like so the drop router (PR C) matches the
    // next drop of the same vendor sheet to this book.
    if (opts.fingerprint?.format) dataPatch.importFingerprint = opts.fingerprint;
    if (opts.sources?.length) dataPatch.sources = opts.sources;
    await updateBook(bookId, { dataPatch });
    await snapshotBookVersion(bookId, appliedFromDiff(diff), bookItemData);
  };

  // The active set an apply leaves the book in: added + changed + unchanged
  // (retired SKUs are excluded — they were just marked inactive). Both diff
  // shapes (diffBookItems / diffStock) match, so this serves stock and registry.
  const appliedFromDiff = (diff) => [...diff.added, ...diff.changed.map((c) => c.item), ...(diff.unchanged || [])];

  // Snapshot a book's applied active set as a pricebook_versions row (values as
  // applied — cost/price, never derived sell), then prune unpinned to newest 3.
  // Shared by the registry-book import and the stock-workbook import/rollback.
  // Best-effort: the items are already applied, so a version-write failure must
  // not surface as an import failure. `toData` strips the row's column-backed
  // fields (bookItemData for registry items, stockData for stock items).
  const snapshotBookVersion = async (bookId, appliedItems, toData) => {
    try {
      const snapshot = appliedItems.map((it) => ({ sku: it.sku, data: toData(it) }));
      const { error: ve } = await supabase.from("pricebook_versions").insert({ id: uid(), book_id: bookId, label: "", pinned: false, imported_by: profile.name || user.email || "", item_count: appliedItems.length, snapshot });
      if (ve) throw ve;
      const versions = await loadBookVersions(bookId);
      const drop = versions.filter((v) => !v.pinned).slice(BOOK_VERSION_KEEP).map((v) => v.id);
      if (drop.length) await supabase.from("pricebook_versions").delete().in("id", drop);
    } catch (x) { /* best-effort — the items are already applied */ }
  };

  // Import versions for a book, newest first (metadata only; the snapshot stays
  // on the server until a rollback needs it). Own table, mirrors the customer
  // versions split — never held in app state.
  const loadBookVersions = async (bookId) => {
    const { data: rows, error } = await supabase.from("pricebook_versions").select("id, book_id, label, pinned, imported_at, imported_by, item_count").eq("book_id", bookId).order("imported_at", { ascending: false });
    if (error) throw error;
    return (rows || []).map((r) => ({ id: r.id, bookId: r.book_id, label: r.label || "", pinned: !!r.pinned, importedAt: r.imported_at ? new Date(r.imported_at).getTime() : null, importedBy: r.imported_by || "", itemCount: r.item_count || 0 }));
  };

  const loadBookVersionSnapshot = async (versionId) => {
    const { data: row, error } = await supabase.from("pricebook_versions").select("snapshot").eq("id", versionId).single();
    if (error) throw error;
    return row?.snapshot || [];
  };

  // Toggle a version's keeper flag (the SQL's version UPDATE policy exists only
  // for pinned/label — the client never rewrites a snapshot).
  const pinBookVersion = async (versionId, pinned) => {
    const { error } = await supabase.from("pricebook_versions").update({ pinned }).eq("id", versionId);
    if (error) throw error;
  };

  // Single-row hand-edit of a book item (Settings inline edit). Writes the one
  // (book_id, sku) row's data jsonb, stamping editedBy/editedAt so the next
  // import's diff can warn the manual fix will be overwritten. Sanctioned path
  // — the item UPDATE RLS exists for exactly this; imports still only upsert.
  const updateBookItem = async (bookId, item) => {
    const data = { ...bookItemData(item), editedBy: profile.name || user.email || "", editedAt: Date.now() };
    const { error } = await supabase.from("price_book_items").update({ data }).eq("book_id", bookId).eq("sku", item.sku);
    if (error) { ping("Save failed"); throw error; }
    flashSaved();
    return data;
  };

  // Flag-review verdicts (confirm-fixed / ignore / undo / reset): rewrite the
  // row's data jsonb with the new flagReview map, WITHOUT the editedBy/editedAt
  // stamp — a review is bookkeeping, not a hand-edit, so it must not raise the
  // wizard's "will be overwritten" warning or the edited chip. `state` null
  // clears the codes (undo/reset). Returns the written maps so the caller can
  // merge them into its open list.
  const reviewBookItemFlags = async (bookId, ops) => {
    const stamp = { by: profile.name || user.email || "", at: Date.now() };
    const out = [];
    for (const { item, codes, state } of ops) {
      const review = { ...(item.flagReview || {}) };
      for (const c of codes || []) { if (state) review[c] = { state, ...stamp }; else delete review[c]; }
      const flagReview = Object.keys(review).length ? review : null;
      const { error } = await supabase.from("price_book_items").update({ data: { ...bookItemData(item), flagReview } }).eq("book_id", bookId).eq("sku", item.sku);
      if (error) { ping("Save failed"); throw error; }
      out.push({ sku: item.sku, flagReview });
    }
    flashSaved();
    return out;
  };

  // Enable/disable book items (importer-upgrades spec, PR A): flips ONLY the
  // disabled column, keyed (book_id, sku). Import upserts never mention the
  // column, so the team's choice survives every reimport. Chunked like the
  // imports.
  const setBookItemsDisabled = async (bookId, skus, disabled) => {
    for (let i = 0; i < skus.length; i += 200) {
      const { error } = await supabase.from("price_book_items").update({ disabled }).eq("book_id", bookId).in("sku", skus.slice(i, i + 200));
      if (error) { ping("Save failed — has supabase/pricebook-disabled.sql been run?"); throw error; }
    }
    flashSaved();
  };

  return {
    books, hydrateBooks: setBooks,
    orderItems, setOrderItems,
    loadBookItems, addBook, updateBook, delBook, applyBookImport,
    appliedFromDiff, snapshotBookVersion,
    loadBookVersions, loadBookVersionSnapshot, pinBookVersion,
    updateBookItem, reviewBookItemFlags, setBookItemsDisabled,
  };
}

import { useRef, useState } from "react";
import { supabase } from "./lib/supabase.js";
import { loadStock } from "./bootload.js";
import { parsePriceBook } from "./pricebook.js";
import { readXlsxSheets } from "./fileread.js";
import { stockData, diffStock, syncCatalogPrices } from "./stock.js";
import { STOCK_LOADING_MSG, STOCK_FAILED_MSG, STOCK_BOOK_ID } from "./uiconst.js";

export function useStock({ user, ping, flashSaved, profile, settings, setSettings, appliedFromDiff, snapshotBookVersion }) {
  // Stock price book (ADR 0003): all active+retired items, loaded in the
  // background after first paint (ADR 0026 stage 2) — the SKU picker and drift
  // chips search this in memory. stockReady = the load attempt settled (so no
  // guard holds forever); stockFailed = it settled by FAILING, so the cache is
  // empty for the wrong reason and diff/snapshot writes must stay blocked.
  // Empty until the team has run supabase/stock.sql and imported the workbook.
  const [stock, setStock] = useState([]);
  const [stockReady, setStockReady] = useState(false);
  const [stockFailed, setStockFailed] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const pbRef = useRef(null);

  // Parse a freshly exported price book workbook in the browser and show what
  // an import would change — nothing is written until the preview is applied.
  // Read + preview a shop-workbook file. onDone (from the multi-file drop router)
  // fires whether the preview opens, is empty, or errors, and is carried on the
  // preview so its Apply/Cancel can advance the router's queue. onDone is called
  // with `applied` — true only after a successful Apply, false on cancel / empty /
  // read-error — so the router knows whether the file was really imported.
  const importStockFile = async (file, onDone) => {
    if (!file) return;
    // The diff below compares against the in-memory stock cache; against a
    // still-loading (or failed-to-load) cache it wouldn't error, it would lie
    // (every row "new", no retire marks).
    if (!stockReady || stockFailed) { ping(stockFailed ? STOCK_FAILED_MSG : STOCK_LOADING_MSG); onDone?.(false); return; }
    setImporting(true);
    try {
      const sheets = await readXlsxSheets(file);
      const { items, warnings } = parsePriceBook(sheets);
      if (!items.length) { ping("No stock items found in that file"); onDone?.(false); }
      else {
        const parsed = items.map((it) => ({ ...it, active: true }));
        setImportPreview({ parsed, diff: diffStock(stock, parsed), warnings, sync: syncCatalogPrices(settings.catalog, parsed), onDone });
      }
    } catch (x) { ping("Could not read that file — is it the price book .xlsx?"); onDone?.(false); }
    setImporting(false);
  };
  const importPriceBook = (e) => { const f = e.target.files?.[0]; e.target.value = ""; importStockFile(f); };

  // Upsert by SKU: new + changed items, plus active-off rows for items that
  // dropped out of the book (never deleted — old selections keep resolving).
  // Catalog products whose price the book pins get updated through the normal
  // settings write path.
  // Chunked upsert of a stock diff: new + changed active, dropped rows marked
  // active=false (never deleted). Shared by the workbook import and rollback.
  const upsertStock = async (diff) => {
    const upserts = [
      ...diff.added.map((it) => ({ sku: it.sku, active: true, data: stockData(it) })),
      ...diff.changed.map(({ item }) => ({ sku: item.sku, active: true, data: stockData(item) })),
      ...diff.missing.map((it) => ({ sku: it.sku, active: false, data: stockData(it) })),
    ];
    for (let i = 0; i < upserts.length; i += 200) {
      const { error } = await supabase.from("stock_items").upsert(upserts.slice(i, i + 200), { onConflict: "sku" });
      if (error) throw error;
    }
  };

  const applyImport = async () => {
    const { diff, sync, onDone } = importPreview;
    setImportPreview(null);
    try {
      await upsertStock(diff);
      const applied = appliedFromDiff(diff);
      await snapshotBookVersion(STOCK_BOOK_ID, applied, stockData);
      const ops = { ...(settings.ops || {}), lastImport: { at: Date.now(), by: profile.name || user.email || "", skus: applied.length } };
      setSettings(sync.changes.length ? { catalog: sync.catalog, ops } : { ops });
      setStock(await loadStock(supabase));
      flashSaved();
      ping(`Price book imported — ${diff.added.length} new, ${diff.changed.length} updated, ${diff.missing.length} retired`);
      onDone?.(true);
    } catch (x) { ping("Import failed — has supabase/stock.sql been run?"); onDone?.(false); }
  };

  // Roll the shop workbook back to a version snapshot: replay it through the
  // normal diffStock -> upsert flow (never a blind overwrite), snapshot a fresh
  // version so the rollback is the newest, and bump ops.lastImport so the
  // history list refreshes. No catalog price-sync — a rollback restores the
  // book's own rows, not catalog prices.
  const rollbackStock = async (diff) => {
    // Same hazard as importStockFile, but quiet: a rollback diffed against a
    // still-loading (or failed-to-load) cache would apply without retire marks.
    if (!stockReady || stockFailed) { ping(stockFailed ? STOCK_FAILED_MSG : STOCK_LOADING_MSG); return; }
    try {
      await upsertStock(diff);
      const applied = appliedFromDiff(diff);
      await snapshotBookVersion(STOCK_BOOK_ID, applied, stockData);
      const ops = { ...(settings.ops || {}), lastImport: { at: Date.now(), by: profile.name || user.email || "", skus: applied.length } };
      setSettings({ ops });
      setStock(await loadStock(supabase));
      flashSaved();
    } catch (x) { ping("Rollback failed"); }
  };

  // Same disabled-column flip for the shop workbook's stock_items (keyed by sku,
  // no book_id). Optimistic — the row list reflects it immediately and rolls back
  // on a failed write. Stock imports strip the column (stockData) too, so the
  // team's choice survives every re-import just like the registry books'.
  const setStockItemsDisabled = async (skus, disabled) => {
    const set = new Set(skus);
    setStock((s) => s.map((it) => (set.has(it.sku) ? { ...it, disabled } : it)));
    try {
      for (let i = 0; i < skus.length; i += 200) {
        const { error } = await supabase.from("stock_items").update({ disabled }).in("sku", skus.slice(i, i + 200));
        if (error) throw error;
      }
      flashSaved();
    } catch (x) {
      ping("Save failed — has supabase/pricebook-disabled.sql been run?");
      try { setStock(await loadStock(supabase)); } catch (_) { /* keep optimistic view */ }
    }
  };

  return {
    stock, stockReady, stockFailed,
    hydrateStock: setStock, markStockReady: setStockReady, markStockFailed: setStockFailed,
    importing, importPreview, setImportPreview, pbRef,
    importStockFile, importPriceBook, applyImport, rollbackStock,
    setStockItemsDisabled,
  };
}

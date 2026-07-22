import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronRight, Eye, EyeOff, FileText, Flag, History, Lock, Pencil, Percent, Pin, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { num } from "./catalog.js";
import { normStockItem, diffStock, priceUnitOf, orderUnitOf } from "./stock.js";
import { mappedSkuRe, guessHeaderRow, bestDataSheet, columnsFromHeader, parseMapped, detectVtcEft, detectVendorSkuAnalysis } from "./pricebook.js";
import { computeFingerprint, fileFormat, routeFile, bundleByBook, bookKindFor, sourceSlot, mergeSources, missingSources, stepPayloads, declareManualSource, undeclareManualSource } from "./dropimport.js";
import { entryFileName, captureHandoff, captureHandoffSession, clearHandoffSession, recordKey, poolPendingReview, pendingForSheet, sheetsForBook } from "./vendorfetch.js";
import { parsePdfPages } from "./pdfbook.js";
import { isManningtonCartons, parseManningtonPages } from "./manningtonbook.js";
import { parseOvf } from "./ovfbook.js";
import { parseMirage } from "./miragebook.js";
import { normBookItem, diffBookItems, markupGroups, pricedItem, editedInDiff, bookStaleness, DEFAULT_STALE_DAYS, itemProblems, supersedePairs, itemFlags, flagReviewBySku } from "./orderbook.js";
import { normPricing } from "./pricing.js";
import { BOOK_VERSION_KEEP, STOCK_BOOK_ID } from "./uiconst.js";
import { money } from "./model.js";
import { readXlsxSheets, readPdfPages } from "./fileread.js";
import { Modal } from "./widgets.jsx";
import { InHouseColumn, PasteSignInPopover, StaleChip, FLAG_SEMANTICS, useVendorFetch, VendorFetchPage } from "./vendorpanel.jsx";

// --- Price book library (ADR 0009, Phase 1) ---------------------------------
//
// The Settings "Price book" section grown into a library: the stock workbook
// plus registry books (stock- and order-kind). Order books import via a saved
// column mapping and store a vendor COST; a flat default markup turns that into
// a browse-time selling price (the markup editor and pick snapshot are Phase 2).
// A session-local "hide costs" toggle masks every cost/margin figure for
// over-the-shoulder moments — presentation only, never stored, never printed.

const bookFieldOptions = [
  ["", "— ignore —"], ["sku", "SKU"], ["cost", "Cost"], ["price", "Retail price"], ["description", "Description"],
  ["mfg", "Manufacturer"], ["productLine", "Product line"], ["color", "Color"], ["style", "Style"],
  ["unit", "Unit (U/M)"], ["priceUnit", "Price unit (cost basis)"], ["orderUnit", "Order unit (No Broken)"],
  ["size", "Size"], ["thickness", "Thickness"], ["sfPerUnit", "SF per carton"], ["pcPerUnit", "Pieces per carton"],
  ["coverage", "Coverage"], ["leadTime", "Lead time"], ["msrp", "MSRP / consumer"], ["brand", "Brand"],
  ["section", "Section"], ["note", "Notes"], ["type", "Flooring type"], ["flag", "Status flag"],
];

// guessBookField / guessHeaderRow moved to src/pricebook.js (pure + tested);
// bookFieldOptions / FLAG_SEMANTICS above stay here as UI dropdown lists.

// A routing choice, not a book id: resolved into a real (freshly created) book
// when the user commits to reviewing, so canceling the route step makes nothing.
const NEW_BOOK = "__new__";

// The multi-file drop router (ADR 0009 PR C). Reads each dropped file once,
// routes it to a book (or the shop workbook), lets the user fix unmatched files,
// then steps through each file's normal import preview one at a time. Registry
// files reuse BookImportWizard (pre-read); the shop workbook reuses the App-level
// stock preview. No new write path — each apply is the book's existing one.
// One book's completeness gap at the routing step (ADR 0025): what it is short
// of, a place to drop it, and what happens if you go ahead without it. Exported
// for the preview harness.
function GateGap({ book, have, total, missing, onAdd, inp }) {
  const [over, setOver] = useState(false);
  const pick = useRef(null);
  return (
    // amber-50 is one of the few surfaces the dark theme leaves light, while
    // slate text is remapped to near-white — so everything in here states an
    // amber ink explicitly rather than inheriting, or it vanishes in dark mode.
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-[12.5px] font-medium text-amber-900">{book.name || "Untitled"} — {have} of {total} files ready</span>
        <span className="text-[10.5px] text-amber-700">go ahead without them and their rows retire</span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        {missing.map((s) => (
          <div key={s.id} className="text-[11.5px] text-amber-900 truncate">
            Missing: <span className="font-medium">{s.label || "a file"}</span>
            <span className="text-amber-700/80"> · {s.kind === "manual" ? "added by hand" : "fetched from the portal"}</span>
          </div>
        ))}
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(e.dataTransfer?.files); }}
        onClick={() => pick.current?.click()}
        className={"mt-2 cursor-pointer rounded-md border border-dashed px-3 py-2 text-center text-[11px] " + (over ? "border-amber-500 bg-amber-100 text-amber-800" : "border-amber-300 text-amber-700 hover:bg-amber-100/60")}
      >
        Drop the missing file here, or click to choose
        <input ref={pick} type="file" multiple accept=".xlsx,.xls,.pdf" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => { onAdd(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );
}

export function ImportRouter({ files, preferTarget, targets, sourceKeys, linkedSlots, onFileDone, books, addBook, applyBookImport, updateBook, loadBookItems, importStockFile, onClose, types, typeLabels, inp, lbl, hideCosts }) {
  const [rows, setRows] = useState(null); // [{ file, isPdf, sheets, pages, error, target, candidates, reason }]
  const [phase, setPhase] = useState("route"); // "route" | "run"
  const [qi, setQi] = useState(0); // index into the runnable queue
  const [active, setActive] = useState(null); // { row, book, items } for the current registry step
  const registryBooks = books.filter((b) => b.kind === "order" || b.kind === "stock");

  // Read + route every file once, fault-isolated: a file that won't parse gets an
  // error row and is skipped; the rest still route.
  const readRow = async (file) => {
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    try {
      const parsed = isPdf ? { pages: await readPdfPages(file), isPdf: true } : { sheets: await readXlsxSheets(file) };
      // The filename rides along for formats whose sibling files it alone tells
      // apart (the ERP stock exports — one identical template per supplier).
      const fp = computeFingerprint({ ...parsed, name: file.name });
      let r = routeFile({ ...fp, sheets: parsed.sheets }, registryBooks);
      // Explicit intent outranks any fingerprint match to another book:
      // preferTarget = "Create price book from this sheet"; targets = files
      // fetched for a known linked book (review-when-ready pool).
      const forced = (preferTarget && registryBooks.some((b) => b.id === preferTarget)) ? preferTarget
        : (targets && targets.get(file));
      if (forced && registryBooks.some((b) => b.id === forced)) {
        r = { ...r, target: forced, reason: forced === preferTarget ? "new book from this sheet" : "fetched for this book" };
      }
      // Which of the book's source slots this file fills (ADR 0025): a fetched
      // sheet by its recordKey, a hand-supplied file by its content fingerprint
      // — never by filename, which vendors re-date between releases.
      const slot = sourceSlot({ recordKey: sourceKeys?.get(file), fingerprint: fp, name: file.name });
      // The file's own format tag, kept on the row so bundleByBook can spot a
      // vendor whose files must be parsed together (ADR 0025 rule 7). A fetched
      // file's slot has no fingerprint, so the slot can't answer this.
      return { file, ...parsed, ...r, slot, format: fp.format };
    } catch (x) { return { file, error: "Could not read this file" }; }
  };

  useEffect(() => { let ok = true; (async () => {
    const out = [];
    for (const file of files) out.push(await readRow(file));
    if (ok) setRows(out);
  })(); return () => { ok = false; }; }, []);

  // Files added at the completeness gate — read and routed the same way, then
  // appended, so a gap can be filled without restarting the drop. `to` forces the
  // book whose gate asked for it.
  const addFiles = async (list, to) => {
    const picked = [...(list || [])].filter((f) => /\.(xlsx|xls|pdf)$/i.test(f.name));
    if (!picked.length) return;
    const added = [];
    for (const f of picked) {
      const r = await readRow(f);
      added.push(r.error ? r : { ...r, target: to, reason: "added here to complete this book" });
    }
    setRows((rs) => [...(rs || []), ...added]);
  };

  const setTarget = (i, target) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, target } : r)));
  // "New book from this file" rows count as one bundle EACH (a pseudo-target
  // per row) until startRun materializes their books — grouping them under the
  // shared marker would read seven new-book files as one seven-file bundle.
  const flat = (rows || []).filter((r) => !r.error && r.target && r.target !== "skip")
    .map((r, i) => (r.target === NEW_BOOK ? { ...r, target: `${NEW_BOOK}:${i}` } : r));
  // Several files can name the same book (ADR 0025): a vendor that splits its
  // price list, or a batch download of a book's sheets. Importing them one after
  // another would be silently destructive — each apply diffs against the whole
  // book, so file 2 retires everything file 1 just added. So a book's files are
  // walked as one bundle: each step maps its own file, but the items accumulate
  // and only the LAST step diffs and applies. One import, one retire decision.
  const runnable = bundleByBook(flat);
  const advance = () => setQi((i) => i + 1);
  // Items collected from the earlier files of the current book's bundle.
  const [carry, setCarry] = useState([]);

  // Drive the queue: stock rows go through the App stock preview (a separate
  // modal — we render nothing until it calls back); registry rows load their
  // book's items and render the wizard. Past the end, close the router.
  useEffect(() => {
    if (phase !== "run") return;
    if (qi >= runnable.length) { onClose(); return; }
    // Spread the whole step rather than naming its fields: `joined` was lost in a
    // hand-copied destructure once, which silently reduced a joined vendor's
    // bundle to its first file — and its step says total:1, so it would have
    // applied that partial parse and retired the rest of the book.
    const step = runnable[qi];
    const { row, bundle } = step;
    if (bundle.index === 0) setCarry([]); // first file of a book's bundle
    if (row.target === "stock") { setActive(null); importStockFile(row.file, (applied) => { onFileDone && onFileDone(row.file, applied); advance(); }); return; }
    let ok = true;
    setActive(null);
    loadBookItems(row.target).then((items) => { if (ok) setActive({ ...step, book: books.find((b) => b.id === row.target), items: items || [] }); }).catch(() => ok && advance());
    return () => { ok = false; };
  }, [phase, qi]);

  // Materialize any "new book" choices, then run. Creation waits until here so
  // canceling the route step leaves no empty book rows behind. Each file gets
  // its own book, named by its filename stem — stock-kind for the ERP's own
  // exports, order-kind for vendor lists (bookKindFor).
  const startRun = async () => {
    const made = new Map();
    for (let i = 0; i < (rows || []).length; i++) {
      const r = rows[i];
      if (r.error || r.target !== NEW_BOOK) continue;
      const name = String(r.file?.name || "").replace(/\.[a-z0-9]+$/i, "").trim() || "New book";
      made.set(i, await addBook({ kind: bookKindFor(r.format), name }));
    }
    if (made.size) setRows((cur) => cur.map((r, i) => (made.has(i) ? { ...r, target: made.get(i), reason: "new book from this file" } : r)));
    setQi(0); setPhase("run");
  };

  if (phase === "route") {
    const bookOpts = [["skip", "Skip this file"], ...(addBook ? [[NEW_BOOK, "➕ New book from this file"]] : []), ["stock", "Shop workbook (stock)"], ...registryBooks.map((b) => [b.id, b.name || "Untitled"])];
    // Completeness check (ADR 0025). A book that has been fed several files before
    // says so in its manifest, so an import that is short of one can name it —
    // and either take it here, or go ahead knowing the absent file's rows retire.
    // Books fed by a single file have a one-slot manifest and never appear.
    const gaps = (rows || []).length ? registryBooks.flatMap((b) => {
      const mine = (rows || []).filter((r) => !r.error && r.target === b.id);
      // What the book is made of, from BOTH things that know: the manifest (what
      // imports have recorded, plus any declaration) and the sheets linked to it
      // right now. The link is live and needs no import history, so a book whose
      // three portal sheets are linked is short two of them the moment a pass
      // arrives holding one — which is what reviewing a single pooled sheet used
      // to do silently.
      const manifest = mergeSources(b.data?.sources, linkedSlots ? linkedSlots(b.id) : [], 0);
      // The <2 guard keeps a single-file book from ever nagging. A DECLARED slot
      // is an explicit statement that the book needs more, so it outranks the
      // guard — otherwise the first import, when the manifest holds only the
      // declaration, is exactly the one that fails to ask.
      if (!mine.length || (manifest.length < 2 && !manifest.some((s) => s?.pending))) return [];
      const missing = missingSources(manifest, mine.map((r) => r.slot));
      // What the book expects is what is in hand plus what is short of it — NOT
      // the manifest's length, which counts only files an import has already
      // recorded. A declared slot on a never-imported book made that read "2 of
      // 1". For an established book the two agree.
      return missing.length ? [{ book: b, have: mine.length, total: mine.length + missing.length, missing }] : [];
    }) : [];
    return (
      <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }} onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-1">{/* Counts the rows, not the dropped files — the Add row can grow the pass. */}
            <h3 className="ft-serif text-2xl">Route {(rows || files).length} file{(rows || files).length === 1 ? "" : "s"}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
          <p className="text-xs text-slate-400 mb-3">Files heading for the same book are reviewed together, one book at a time. Unfamiliar files need a book picked.</p>
          {rows == null ? <p className="text-sm text-slate-400 py-6 text-center">Reading files…</p> : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <FileText size={15} className="text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{r.file.name}</div>
                    <div className={`text-[11px] ${r.error ? "text-red-500" : r.target && r.target !== "skip" ? "text-slate-400" : "text-amber-600"}`}>{r.error || r.reason}</div>
                  </div>
                  {r.error ? <span className="text-[11px] text-red-500 shrink-0">Skipped</span> : (
                    // !w-auto: inp carries w-full, which outranks a plain w-auto
                    // in the generated CSS and squeezes the filename to nothing.
                    <select className={`${inp} !w-auto shrink-0 text-xs`} value={r.target || "skip"} onChange={(e) => setTarget(i, e.target.value)}>
                      {bookOpts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
          {gaps.map(({ book, have, total, missing }) => (
            <GateGap key={book.id} book={book} have={have} total={total} missing={missing} onAdd={(list) => addFiles(list, book.id)} inp={inp} />
          ))}

          <div className="flex justify-between items-center pt-4">
            <button onClick={onClose} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
            <button onClick={startRun} disabled={!runnable.length} className={"text-sm rounded-lg text-white px-4 py-2 disabled:opacity-50 " + (gaps.length ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700")}>
              {gaps.length
                ? `Review anyway — ${gaps.reduce((n, g) => n + g.missing.length, 0)} file${gaps.reduce((n, g) => n + g.missing.length, 0) === 1 ? "" : "s"} short →`
                : `Review ${runnable.length} file${runnable.length === 1 ? "" : "s"} →`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Run phase: the stock step is handled by the App stock preview; render nothing
  // until a registry step has its book + items loaded.
  if (!active) return null;
  const multi = active.bundle.total > 1;
  // A joined vendor's files are read together, so the step names all of them
  // rather than counting through them one at a time.
  const stepNote = (
    <div className="text-[11px] text-slate-400 mb-2">
      {active.joined
        ? <>Reviewing {active.files.length} files together for {active.book.name || "this book"} — {active.files.map((f) => f.name).join(", ")}</>
        : <>Reviewing {qi + 1} of {runnable.length} — {active.row.file.name}
          {multi && <> · file {active.bundle.index + 1} of {active.bundle.total} for {active.book.name || "this book"}</>}</>}
    </div>
  );
  return (
    <BookImportWizard
      key={active.book.id + qi}
      book={active.book} existingItems={active.items}
      preParsed={stepPayloads(active)}
      carryItems={carry} bundle={active.bundle}
      onClose={() => {
        // Backing out of one file of a bundle abandons the WHOLE bundle. Skipping
        // just this one would leave the remaining files to apply without its rows,
        // which is precisely the retire-each-other bug — so skip to the next book.
        const rest = active.bundle.total - active.bundle.index;
        for (const f of active.files) onFileDone && onFileDone(f, false);
        setCarry([]);
        setQi((i) => i + rest);
      }}
      onApply={async (diff, opts, bundleItems) => {
        // Not the last file of this book's bundle: bank the items and move on —
        // nothing is written until the whole bundle has been through.
        if (active.bundle.index < active.bundle.total - 1) { setCarry(bundleItems); advance(); return; }
        try {
          // Record what this book was made of, so a later import can tell when a
          // file is missing (ADR 0025). Slots are never dropped — absence is the
          // thing the completeness gate exists to report.
          const sources = mergeSources(active.book.data?.sources, active.rows.map((r) => r.slot).filter(Boolean));
          await applyBookImport(active.book.id, diff, { ...opts, sources });
          for (const f of active.files) onFileDone && onFileDone(f, true);
        } catch (x) { for (const f of active.files) onFileDone && onFileDone(f, false); /* error surfaced by applyBookImport */ }
        advance();
      }}
      saveMapping={(m) => updateBook(active.book.id, { dataPatch: { mapping: m } })}
      types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={hideCosts} stepNote={stepNote}
    />
  );
}

// The shop workbook's item list with the same enable/disable controls the order
// books get in BookDetail — search, an All/Enabled/Disabled filter, a per-row
// toggle, select-all + bulk disable/enable of the selected rows, and a one-click
// "re-enable all disabled" reset. Stock rows carry no cost/markup, so the table
// is trimmed to SKU · description · type · U/M · price. Writes go through
// setStockItemsDisabled (optimistic, disabled-column only), matching the
// registry-book path.
function StockItems({ stock, setStockItemsDisabled, inp, typeLabels }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all"); // all | enabled | disabled
  const [selected, setSelected] = useState(() => new Set());
  const [confirmBulk, setConfirmBulk] = useState(null); // null | { disabled: boolean }
  const [confirmReset, setConfirmReset] = useState(false);
  const items = stock || [];
  const query = q.trim().toLowerCase();
  const filtered = items
    .filter((it) => (show === "disabled" ? it.disabled : show === "enabled" ? !it.disabled : true))
    .filter((it) => !query || `${it.sku} ${it.description} ${it.brand} ${it.color} ${it.product}`.toLowerCase().includes(query));
  const shown = filtered.slice(0, 300);
  const disabledCount = items.filter((it) => it.disabled).length;
  const price = (it) => (it.priceSqft != null ? it.priceSqft : it.price);
  // Bulk enable/disable acts on the SELECTED rows still in the current filter;
  // the select-all box covers all filtered matches, not the 300-row slice.
  const selectedIn = filtered.filter((it) => selected.has(it.sku));
  const allSelected = filtered.length > 0 && selectedIn.length === filtered.length;
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((it) => it.sku)));
  const toggleSelect = (sku) => setSelected((s) => { const n = new Set(s); n.has(sku) ? n.delete(sku) : n.add(sku); return n; });

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 flex-wrap">
        <input className={`${inp} max-w-sm`} placeholder="Search stock items…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
          {[["all", "All"], ["enabled", "Enabled"], ["disabled", disabledCount ? `Disabled (${disabledCount})` : "Disabled"]].map(([v, label]) => (
            <button key={v} onClick={() => setShow(v)} className={`px-2.5 py-1.5 ${show === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
        {selectedIn.length > 0 && (
          <>
            <button onClick={() => setConfirmBulk({ disabled: true })} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Disable selected ({selectedIn.length})</button>
            <button onClick={() => setConfirmBulk({ disabled: false })} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Enable selected ({selectedIn.length})</button>
          </>
        )}
        {disabledCount > 0 && (
          <button onClick={() => setConfirmReset(true)} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50 ml-auto" title="Turn every disabled stock SKU back on">Re-enable all disabled ({disabledCount})</button>
        )}
      </div>
      {confirmBulk && (
        <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          <span className="text-amber-700 flex-1">{confirmBulk.disabled ? "Disable" : "Enable"} the {selectedIn.length} selected stock item{selectedIn.length === 1 ? "" : "s"}? Disabled items stop showing in SKU search for everyone; estimates that already picked them keep their prices.</span>
          <button onClick={() => { setStockItemsDisabled(selectedIn.map((it) => it.sku), confirmBulk.disabled); setConfirmBulk(null); setSelected(new Set()); }} className="rounded-md bg-indigo-600 text-white px-2.5 py-1 font-medium shrink-0">{confirmBulk.disabled ? "Disable" : "Enable"} {selectedIn.length}</button>
          <button onClick={() => setConfirmBulk(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
        </div>
      )}
      {confirmReset && (
        <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          <span className="text-amber-700 flex-1">Re-enable all {disabledCount} disabled stock item{disabledCount === 1 ? "" : "s"}, regardless of the current filter? They'll show in SKU search again for everyone.</span>
          <button onClick={() => { setStockItemsDisabled(items.filter((it) => it.disabled).map((it) => it.sku), false); setConfirmReset(false); setShow("all"); }} className="rounded-md bg-indigo-600 text-white px-2.5 py-1 font-medium shrink-0">Re-enable all {disabledCount}</button>
          <button onClick={() => setConfirmReset(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
        </div>
      )}
      <div className="mt-2 overflow-x-auto border border-slate-100 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-2 py-1.5 w-8"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="Select / deselect all filtered rows" /></th>
              <th className="text-left px-2 py-1.5">SKU</th>
              <th className="text-left px-2 py-1.5">Description</th>
              <th className="text-left px-2 py-1.5">Type</th>
              <th className="text-left px-2 py-1.5">U/M</th>
              <th className="text-right px-2 py-1.5">Price</th>
              <th className="px-2 py-1.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((it) => (
              <tr key={it.sku} className={`border-t border-slate-100 ${!it.active || it.discontinued || it.disabled ? "text-slate-300" : ""}`}>
                <td className="px-2 py-1.5"><input type="checkbox" checked={selected.has(it.sku)} onChange={() => toggleSelect(it.sku)} title="Select for bulk enable / disable" /></td>
                <td className="px-2 py-1.5 font-mono text-xs">{it.sku}</td>
                <td className="px-2 py-1.5">
                  {it.description || it.product || "—"}
                  {it.discontinued && <span className="ml-1.5 text-[9px] uppercase rounded bg-slate-100 text-slate-500 px-1 py-0.5">disc</span>}
                  {it.disabled && <span className="ml-1.5 text-[9px] uppercase rounded bg-slate-100 text-slate-500 px-1 py-0.5">off</span>}
                </td>
                <td className="px-2 py-1.5 text-xs">{it.type ? (typeLabels?.[it.type] || it.type) : "—"}</td>
                <td className="px-2 py-1.5 text-xs">{it.unit || "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{price(it) != null ? money(price(it)) : "—"}</td>
                <td className="px-2 py-1.5 text-right"><button onClick={() => setStockItemsDisabled([it.sku], !it.disabled)} title={it.disabled ? "Enable — offer this SKU in search again" : "Disable — hide this SKU from search (estimates that already picked it keep their prices)"} className="text-slate-300 hover:text-slate-600">{it.disabled ? <Eye size={13} /> : <EyeOff size={13} />}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(filtered.length > shown.length) && <p className="text-[11px] text-slate-400 mt-1">Showing {shown.length} of {filtered.length}.</p>}
    </div>
  );
}

export function PriceBookLibrary({ books, stock, stockReady, addBook, updateBook, delBook, loadBookItems, applyBookImport, loadBookVersions, loadBookVersionSnapshot, pinBookVersion, updateBookItem, setBookItemsDisabled, reviewBookItemFlags, setStockItemsDisabled, rollbackStock, importing, importPriceBook, importStockFile, pbRef, settings, setSettings, gFamilies, inp, lbl, types, typeLabels }) {
  const [vendorPending, setVendorPending] = useState(() => captureHandoff()); // bookmarklet hand-off (ADR 0019/0020)
  const [vendorSession, setVendorSession] = useState(() => captureHandoffSession()); // bare session grab (ADR 0019): unlock only
  const [sel, setSel] = useState("library"); // "library" | "stock" | bookId
  const [adding, setAdding] = useState(false);
  const [newKind, setNewKind] = useState("order");
  const [newName, setNewName] = useState("");
  const [hideCosts, setHideCosts] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false); // "Set up bookmark" toggle inside PasteSignInPopover
  const [dropped, setDropped] = useState(null); // File[] handed to the multi-file drop router
  const [dragOver, setDragOver] = useState(false);
  // Review-when-ready (mockup 2026-07-19): fetched sheets park here instead of
  // opening import review. Session-only — File bytes can't persist, a reload
  // clears the pool and re-fetching is cheap.
  const [pendingReviews, setPendingReviews] = useState([]);
  const poolFetched = (adds) => setPendingReviews((prev) => (adds || []).reduce((acc, a) => poolPendingReview(acc, a), prev));
  // Reviewing one pooled sheet reviews every pooled sheet of the SAME BOOK.
  // A book's import diffs against the whole book, so a pass holding one of its
  // sheets reads the others' rows as absent and retires them. The per-sheet
  // button therefore can't mean "just this file" for a book fed by several —
  // it means "this book, with everything of its own that has arrived".
  const reviewOne = (p) => {
    const bookId = p.sheet.bookId && books.some((b) => b.id === p.sheet.bookId) ? p.sheet.bookId : null;
    const list = bookId ? pendingReviews.filter((q) => q.sheet.bookId === bookId) : [p];
    const files = (list.length ? list : [p]);
    setDropped({
      files: files.map((q) => q.file),
      targets: new Map(files.filter((q) => q.sheet.bookId).map((q) => [q.file, q.sheet.bookId])),
      sourceKeys: new Map(files.map((q) => [q.file, recordKey(q.sheet)])),
    });
  };
  const reviewAll = () => setDropped({
    files: pendingReviews.map((p) => p.file),
    targets: new Map(pendingReviews.filter((p) => p.sheet.bookId).map((p) => [p.file, p.sheet.bookId])),
    sourceKeys: new Map(pendingReviews.map((p) => [p.file, recordKey(p.sheet)])),
  });
  // Applied files leave the pool; a wizard closed with "X" (= later) stays.
  const fileDone = (file, applied) => { if (applied) setPendingReviews((prev) => prev.filter((p) => p.file !== file)); };
  const dropRef = useRef(null);
  // Menu-style portals hand sheets over one bookmark-click at a time; the
  // bookmarklet reuses this tab, so later hand-offs arrive as hash changes —
  // each one opens the price book library.
  useEffect(() => {
    const onHash = () => { const p = captureHandoff(); const s = captureHandoffSession(); if (p) setVendorPending(p); if (s) setVendorSession(s); if (p || s) setSel("library"); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const takeFiles = (list, prefer) => { const fs = [...(list || [])].filter((f) => /\.(xlsx|xls|pdf)$/i.test(f.name)); if (fs.length) setDropped({ files: fs, prefer }); };
  const vf = useVendorFetch({ settings, setSettings, books, vendorPending, vendorSession, onSessionUsed: () => { setVendorSession(null); clearHandoffSession(); }, onPool: poolFetched, addBook });

  // The fetch slots a book's currently-linked sheets would fill. Live knowledge:
  // it does not wait for an import to record anything, which is what lets the
  // gate count a book's portal sheets on its very first pass.
  const bookFetchSlots = (bookId) =>
    sheetsForBook(vf.groups, bookId).map(({ sheet }) => sourceSlot({ recordKey: recordKey(sheet), name: entryFileName(sheet) }));

  const selBook = sel === "stock" ? null : books.find((b) => b.id === sel);
  const stockCount = stock.filter((s) => s.active).length;

  // Staleness (§8.3): flag a book whose last import predates the owner-set
  // threshold. The shop workbook stamps settings.ops.lastImport; registry books
  // stamp book.data.lastImport.
  const staleDays = settings.ops?.staleDays || DEFAULT_STALE_DAYS;
  const stockStale = bookStaleness(settings.ops?.lastImport?.at, staleDays);
  const bookStale = (b) => bookStaleness(b.data?.lastImport?.at, staleDays);
  const setStaleDays = (v) => { const n = Math.round(Number(v)); setSettings({ ops: { ...(settings.ops || {}), staleDays: n > 0 ? n : null } }); };

  const create = async () => {
    const name = newName.trim() || (newKind === "stock" ? "New stock book" : "New vendor book");
    const id = await addBook({ kind: newKind, name });
    setAdding(false); setNewName(""); setSel(id);
  };

  const backBtn = (
    <button onClick={() => setSel("library")} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 -ml-1 mb-2">
      <ChevronRight size={13} className="rotate-180" /> All price books
    </button>
  );
  const sourcePendingOf = (sheet) => pendingForSheet(pendingReviews, sheet);
  const sourceLiveOf = (sheet) => !!vf.sheetSesid(sheet);
  const inHouseCol = <InHouseColumn books={books} groups={vf.groups} stockCount={stockCount} stockStale={stockStale} bookStale={bookStale} onOpen={setSel} />;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="ft-serif text-3xl">Price books</h2>
          <p className="text-xs text-slate-400 truncate hidden sm:block">Every book in one place — grouped by portal sign-in.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-slate-500" title="Books not re-imported within this many days get an amber ‘stale’ flag. Vendors re-issue cost lists roughly quarterly.">
            Flag stale after
            <input type="number" min="1" value={settings.ops?.staleDays || ""} placeholder={String(DEFAULT_STALE_DAYS)} onChange={(e) => setStaleDays(e.target.value)} className={inp + " w-16 text-center"} />
            days
          </label>
          <button onClick={() => setHideCosts((v) => !v)} title="Mask cost & margin figures on screen" className={`flex items-center gap-1.5 text-xs rounded-md border px-2.5 py-1.5 ${hideCosts ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            {hideCosts ? <Lock size={13} /> : <Percent size={13} />} {hideCosts ? "Costs hidden" : "Hide costs"}
          </button>
        </div>
      </div>

      {/* Library landing header (price-books-header-redesign): the drop zone and
          the team-wide tier/markup settings (spec 2026-07-16) sit in three panels
          above a hard rule that separates them from the books board below. A
          project picks its tier on the job header; these set what Builder/Sale
          mean. The signs read the direction: − off retail, + over cost. */}
      {sel === "library" && (() => {
        const pcts = normPricing(settings.pricing);
        const setPct = (k) => (v) => setSettings({ pricing: { ...pcts, [k]: v === "" ? undefined : Number(v) } });
        // Compact twins of `inp` / the ± chips: the panels stack three rows, so
        // the control height sets the header's height. Built standalone rather
        // than appended to `inp` — same-specificity utilities don't override.
        const pctInp = "ft-field w-12 text-center rounded-md border border-slate-200 px-1.5 py-px text-xs leading-5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
        const minus = <span className="inline-grid place-items-center w-4 h-4 shrink-0 rounded text-slate-500 bg-slate-100 text-[12px] font-extrabold leading-none">−</span>;
        const plus = <span className="inline-grid place-items-center w-4 h-4 shrink-0 rounded text-indigo-700 bg-indigo-50 text-[12px] font-extrabold leading-none">+</span>;
        return (
        <>
          <div className="mt-3 flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 md:overflow-visible md:w-[720px] md:max-w-full md:pb-0 md:snap-none items-stretch">
            <div className="snap-center shrink-0 basis-[85%] sm:basis-[46%] md:basis-auto md:w-[132px] md:grow-0 md:shrink-0 rounded-xl border border-slate-200 bg-white p-2 flex flex-col gap-1">
              <span className="ft-eyebrow text-[10px]">Import</span>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); takeFiles(e.dataTransfer?.files); }}
                onClick={() => dropRef.current?.click()}
                className={`flex-1 rounded-lg border border-dashed px-2 text-[11px] cursor-pointer flex flex-col items-center justify-center text-center gap-0.5 ${dragOver ? "border-indigo-400 bg-indigo-50/60 text-indigo-700" : "border-slate-300 text-slate-400 hover:bg-slate-50"}`}
                title="Drop vendor sheets or the shop workbook here — each file routes to its book"
              >
                <Upload size={15} className="shrink-0" />
                <span className="font-semibold text-slate-600 leading-tight">Drop sheets</span>
                <span className="text-slate-400 leading-tight">or <span className="underline text-indigo-600">browse…</span></span>
                <input ref={dropRef} type="file" multiple accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => { takeFiles(e.target.files); e.target.value = ""; }} />
              </div>
            </div>

            <div className="snap-center shrink-0 basis-[85%] sm:basis-[46%] md:basis-0 md:grow md:shrink md:min-w-0 rounded-xl border border-slate-200 bg-white p-2 flex flex-col gap-1">
              <span className="ft-eyebrow text-[10px]">Price tiers</span>
              <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                <label className="flex items-center gap-1.5" title="Builder tier — percent off retail on the printed estimate">
                  {minus}<input type="number" min="0" max="100" step="0.5" value={pcts.builderPct} onChange={(e) => setPct("builderPct")(e.target.value)} className={pctInp} /><span className="font-medium">Builder</span>
                </label>
                <label className="flex items-center gap-1.5" title="Sale tier — percent off retail on the printed estimate">
                  {minus}<input type="number" min="0" max="100" step="0.5" value={pcts.salePct} onChange={(e) => setPct("salePct")(e.target.value)} className={pctInp} /><span className="font-medium">Sale</span>
                </label>
                <div className="flex items-center gap-1.5" title="Employee tier is fixed at cost + 6%; lines without a cost stay retail">
                  {plus}<span className="w-12 text-center rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold leading-[22px]">6%</span><span className="font-medium">Employee</span>
                </div>
              </div>
            </div>

            <div className="snap-center shrink-0 basis-[85%] sm:basis-[46%] md:basis-0 md:grow md:shrink md:min-w-0 rounded-xl border border-slate-200 bg-white p-2 flex flex-col gap-1">
              <span className="ft-eyebrow text-[10px]">Sheoga markup</span>
              <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                <label className="flex items-center gap-1.5" title="Default markup the Sheoga configurator applies to flooring over distributor cost — adjustable per configuration in the popup">
                  {plus}<input type="number" min="0" step="5" value={pcts.sheogaMarkupPct} onChange={(e) => setPct("sheogaMarkupPct")(e.target.value)} className={pctInp} /><span className="font-medium">Flooring</span>
                </label>
                <label className="flex items-center gap-1.5" title="Default markup the Sheoga configurator applies to wood vents & dampers over distributor cost — adjustable per configuration in the popup">
                  {plus}<input type="number" min="0" step="5" value={pcts.sheogaVentMarkupPct} onChange={(e) => setPct("sheogaVentMarkupPct")(e.target.value)} className={pctInp} /><span className="font-medium">Vents &amp; dampers</span>
                </label>
              </div>
            </div>

            <div className="snap-center shrink-0 basis-[85%] sm:basis-[46%] md:basis-0 md:grow md:shrink md:min-w-0 rounded-xl border border-slate-200 bg-white p-2 flex flex-col gap-1">
              <span className="ft-eyebrow text-[10px]">Order entry</span>
              <div className="flex flex-col gap-1 text-[11px] text-slate-600">
                <label className="flex items-center gap-1.5" title="How many characters your ERP's order-description field holds. Special-order lines abbreviate to fit; anything that still won't fit gets a second copy button for the extended-text field. Set 0 to turn fitting off.">
                  <span className="grid place-items-center w-5 h-[22px] text-slate-400 font-bold">¶</span>
                  <input type="number" min="0" max="200" step="1" value={pcts.descLimit} onChange={(e) => setPct("descLimit")(e.target.value)} className={pctInp} />
                  <span className="font-medium">Desc. field</span>
                </label>
                <p className="text-[10px] text-slate-400 leading-snug pl-[26px]">characters · 0 = no limit</p>
              </div>
            </div>
          </div>

          <div className="md:hidden mt-1 px-0.5 text-[11px] text-slate-400">‹ swipe › Import · Price tiers · Sheoga markup · Order entry</div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <PasteSignInPopover vf={vf} setupOpen={setupOpen} setSetupOpen={setSetupOpen} inp={inp} lbl={lbl} />
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs rounded-md border border-dashed border-slate-300 px-2.5 py-1.5 text-slate-500 hover:bg-slate-50"><Plus size={13} /> New book</button>
          </div>

          <div className="mt-4 border-t-2 border-slate-300" />
        </>
        ); })()}

      {sel === "library" ? (
        <VendorFetchPage vf={vf} books={books} pending={pendingReviews} onReview={reviewOne} onOpenBook={setSel} leadColumn={inHouseCol} inp={inp} />
      ) : sel === "stock" ? (
        <>{backBtn}
          <div className="mt-3">
            <p className="text-xs text-slate-400 max-w-xl">
              {stockCount > 0
                ? `${stockCount} stock items loaded${(() => { const t = Math.max(0, ...stock.map((s) => s.updatedAt || 0)); return t ? ` · updated ${new Date(t).toLocaleDateString()}` : ""; })()}. `
                : !stockReady
                  ? "Price book still loading… "
                  : "No stock items yet — run supabase/stock.sql once, then import the workbook. "}
              The shop workbook keeps its hand-built import; a SKU on a product row copies that item's values onto the row, and later price changes never rewrite saved selections.
            </p>
            {settings.ops?.lastImport && <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">Last imported {new Date(settings.ops.lastImport.at).toLocaleDateString()}{settings.ops.lastImport.by ? ` by ${settings.ops.lastImport.by}` : ""}{settings.ops.lastImport.skus ? ` · ${settings.ops.lastImport.skus} SKUs` : ""}{stockStale.stale && <StaleChip days={stockStale.days} />}</p>}
            {gFamilies.length > 0 && <p className="text-xs text-slate-400 mt-1 max-w-xl">Grout &amp; caulk: {gFamilies.length} color families · {gFamilies.reduce((n, f) => n + f.colors.length, 0)} color SKUs.</p>}
            <button onClick={() => pbRef.current?.click()} disabled={importing} className="mt-4 flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600 disabled:opacity-50"><Upload size={14} /> {importing ? "Reading…" : "Import shop workbook (.xlsx)"}</button>
            <input ref={pbRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importPriceBook} className="hidden" />
            <ImportHistory bookId={STOCK_BOOK_ID} refreshKey={settings.ops?.lastImport?.at || 0} currentItems={stock}
              loadVersions={loadBookVersions} loadSnapshot={loadBookVersionSnapshot} pinVersion={pinBookVersion}
              snapshotToItems={(snap) => snap.map((r) => normStockItem({ sku: r.sku, active: true, data: r.data || {} }))}
              computeDiff={diffStock} onRollback={rollbackStock} noun="the shop workbook" />
            {stockCount > 0 && <StockItems stock={stock} setStockItemsDisabled={setStockItemsDisabled} inp={inp} typeLabels={typeLabels} />}
          </div>
        </>
      ) : selBook ? (
        <>{backBtn}<BookDetail key={selBook.id} book={selBook} updateBook={updateBook} delBook={delBook} onDeleted={() => setSel("library")} loadBookItems={loadBookItems} applyBookImport={applyBookImport} loadBookVersions={loadBookVersions} loadBookVersionSnapshot={loadBookVersionSnapshot} pinBookVersion={pinBookVersion} updateBookItem={updateBookItem} setBookItemsDisabled={setBookItemsDisabled} reviewBookItemFlags={reviewBookItemFlags} hideCosts={hideCosts} staleDays={staleDays} source={sheetsForBook(vf.groups, selBook.id)} sourcePendingOf={sourcePendingOf} sourceLiveOf={sourceLiveOf} onRefreshSheet={(s) => vf.run(Array.isArray(s) ? s : [s])} onReviewSheet={reviewOne} inp={inp} lbl={lbl} types={types} typeLabels={typeLabels} /></>
      ) : (
        <>{backBtn}<p className="text-xs text-slate-400 mt-3">This book is gone.</p></>
      )}

      {dropped && <ImportRouter files={dropped.files} preferTarget={dropped.prefer} targets={dropped.targets} sourceKeys={dropped.sourceKeys} linkedSlots={bookFetchSlots} onFileDone={fileDone} books={books} addBook={addBook} applyBookImport={applyBookImport} updateBook={updateBook} loadBookItems={loadBookItems} importStockFile={importStockFile} onClose={() => setDropped(null)} types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={hideCosts} />}

      {pendingReviews.length > 0 && !dropped && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-xl pl-4 pr-2 py-2">
          <span className="text-sm font-semibold whitespace-nowrap">{pendingReviews.length} downloaded — ready to review</span>
          <button onClick={reviewAll} className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 whitespace-nowrap">Review all</button>
          <button onClick={() => setPendingReviews([])} title="Discard the downloaded files without reviewing" className="p-1.5 text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
      )}

      {adding && (
        <Modal title="New price book" onClose={() => setAdding(false)}>
          <label className={lbl}>Type</label>
          <div className="flex gap-2 mb-3">
            {[["order", "Special order", "Vendor cost list — a markup makes the selling price"], ["stock", "Stock", "Shop-priced sheet, like the main workbook"]].map(([k, t, d]) => (
              <button key={k} onClick={() => setNewKind(k)} className={`flex-1 text-left rounded-lg border px-3 py-2 ${newKind === k ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <div className="text-sm font-medium">{t}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{d}</div>
              </button>
            ))}
          </div>
          <label className={lbl}>Name</label>
          <input className={inp} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={newKind === "stock" ? "e.g. Schluter 2026" : "e.g. Virginia Tile SO"} autoFocus onKeyDown={(e) => e.key === "Enter" && create()} />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setAdding(false)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
            <button onClick={create} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Create book</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Import history + rollback for any versioned price book — a registry book
// (BookDetail) or the shop workbook (the stock panel). Owns its version list;
// the parent bumps refreshKey after an import so it re-fetches. Rollback diffs a
// version's snapshot against the current items and hands the diff to onRollback,
// which replays it through that book's normal apply path (never a blind
// overwrite) — the apply writes a fresh version, so the rollback is the newest.
function ImportHistory({ bookId, refreshKey, currentItems, loadVersions, loadSnapshot, pinVersion, snapshotToItems, computeDiff, onRollback, noun = "this book" }) {
  const [versions, setVersions] = useState(null);
  const [rollback, setRollback] = useState(null); // { version, diff } — confirm modal
  const reload = () => loadVersions(bookId).then(setVersions).catch(() => setVersions([]));
  useEffect(() => { let ok = true; loadVersions(bookId).then((v) => ok && setVersions(v)).catch(() => ok && setVersions([])); return () => { ok = false; }; }, [bookId, refreshKey]);

  const togglePin = async (v) => {
    setVersions((vs) => (vs || []).map((x) => x.id === v.id ? { ...x, pinned: !x.pinned } : x));
    try { await pinVersion(v.id, !v.pinned); } catch (x) { reload(); }
  };
  const openRollback = async (v) => {
    try {
      const snap = await loadSnapshot(v.id);
      setRollback({ version: v, diff: computeDiff(currentItems || [], snapshotToItems(snap || [])) });
    } catch (x) { /* transient — user can retry */ }
  };
  const confirmRollback = async () => {
    if (!rollback) return;
    await onRollback(rollback.diff);
    setRollback(null);
  };

  if (versions == null || versions.length === 0) return null;
  return (
    <>
      <div className="mt-6">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-400"><History size={13} /> Import history</div>
        <div className="mt-2 border border-slate-100 rounded-lg divide-y divide-slate-100">
          {versions.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <button onClick={() => togglePin(v)} title={v.pinned ? "Pinned — kept through pruning" : "Pin to keep"} className={v.pinned ? "text-indigo-600" : "text-slate-300 hover:text-slate-500"}><Pin size={14} className={v.pinned ? "fill-current" : ""} /></button>
              <div className="min-w-0">
                <div className="truncate">
                  {v.label || (i === 0 ? "Latest import" : "Import")}
                  {i === 0 && <span className="ml-1.5 text-[9px] uppercase rounded bg-emerald-100 text-emerald-700 px-1 py-0.5">current</span>}
                </div>
                <div className="text-[11px] text-slate-400">{v.importedAt ? new Date(v.importedAt).toLocaleString() : "—"}{v.importedBy ? ` · ${v.importedBy}` : ""} · {v.itemCount} item{v.itemCount === 1 ? "" : "s"}</div>
              </div>
              {i !== 0 && <button onClick={() => openRollback(v)} className="ml-auto flex items-center gap-1 text-xs rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 py-1 text-slate-600"><RotateCcw size={12} /> Roll back</button>}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">The newest {BOOK_VERSION_KEEP} unpinned imports are kept; pin one to keep it indefinitely.</p>
      </div>

      {rollback && (
        <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }} onClick={() => setRollback(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="ft-serif text-xl mb-1">Roll back {noun}?</h3>
            <p className="text-sm text-slate-500">Restores {noun} to the <b>{rollback.version.importedAt ? new Date(rollback.version.importedAt).toLocaleString() : ""}</b> import ({rollback.version.itemCount} item{rollback.version.itemCount === 1 ? "" : "s"}). This is applied as a new import — it becomes the newest version, and nothing older is lost.</p>
            <div className="flex items-center gap-3 flex-wrap mt-3 text-xs">
              <span className="text-emerald-600">{rollback.diff.added.length} restored</span>
              <span className="text-amber-600">{rollback.diff.changed.length} changed back</span>
              <span className="text-slate-400">{rollback.diff.missing.length} retiring · {rollback.diff.unchanged.length} unchanged</span>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRollback(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
              <button onClick={confirmRollback} disabled={rollback.diff.added.length + rollback.diff.changed.length + rollback.diff.missing.length === 0} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">Roll back</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// The sheets feeding this book. A book may have several (a vendor that splits
// its list across flooring / trim / product-chart files), so this renders one
// row per sheet with its own Refresh or Review action, plus a header that acts
// on all of them. Exported for the preview harness.
// The files this book is fed BY HAND, stated up front rather than learned from an
// import (ADR 0025 amendment). A book whose other sheets arrive by fetch has no
// other way to say so: sources are recorded by use, so without this the book
// must first be imported wrongly — short its hand-supplied document — before the
// completeness gate can learn the document was ever part of it.
//
// Declared entries show as promises. Once a real file redeems one, it appears
// here as an ordinary source, listed by the name it was asked for.
export function ManualSourcesCard({ sources, onDeclare, onUndeclare, inp }) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const manual = (sources || []).filter((s) => s?.kind === "manual");
  const add = () => { onDeclare(label); setLabel(""); setAdding(false); };
  return (
    // bg-slate-50/50, not /60: index.css remaps the /50 and bare variants to a
    // dark surface, but not /60 — which stays literally white while slate inks
    // are remapped near-white, leaving the card unreadable in dark mode.
    <div className="mt-3 max-w-xl rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Added by hand</span>
        {!adding && <button onClick={() => setAdding(true)} className="text-[11px] font-medium text-slate-500 hover:text-slate-700">+ Needs another file</button>}
      </div>
      {manual.length === 0 && !adding && (
        <p className="mt-1 text-[11px] text-slate-400">Nothing. Say so here if this book also needs a file you supply yourself — a chart or spec sheet the portal doesn’t serve — and every refresh will ask for it.</p>
      )}
      <div className="mt-1 space-y-1">
        {manual.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-[12px]">
            <FileText size={13} className={s.pending ? "text-slate-300 shrink-0" : "text-slate-400 shrink-0"} />
            <span className="min-w-0 flex-1 truncate">
              {s.pending ? s.label : (s.declaredAs || s.label)}
              {!s.pending && <span className="text-[10.5px] text-slate-400"> · {s.label}</span>}
            </span>
            {s.pending
              ? <span className="shrink-0 text-[10.5px] text-slate-400">asked for at every import</span>
              : <span className="shrink-0 text-[10.5px] text-slate-400">last seen {s.lastSeen ? new Date(s.lastSeen).toLocaleDateString() : "—"}</span>}
            {s.pending && <button onClick={() => onUndeclare(s.id)} className="shrink-0 text-[10.5px] text-slate-400 hover:text-red-600">remove</button>}
          </div>
        ))}
      </div>
      {adding && (
        <div className="mt-2 flex items-center gap-2">
          <input autoFocus className={`${inp} text-xs`} placeholder="What is it? e.g. Product Chart" value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button onClick={add} className="shrink-0 rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-indigo-700">Add</button>
          <button onClick={() => { setAdding(false); setLabel(""); }} className="shrink-0 text-[11px] text-slate-400 hover:text-slate-600">Cancel</button>
        </div>
      )}
    </div>
  );
}

function SourceSheetStrip({ sources, pendingSources, stale: st, lastImportAt, pendingOf, liveOf, onRefresh, onReview }) {
  if (!sources?.length) return null;
  return (
    <div className={`mt-3 max-w-xl rounded-lg border ${st.stale ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50/60"}`}>
      {sources.length > 1 && (
        <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">{sources.length} source sheets</span>
          {pendingSources.length > 0
            ? <span className="text-[10.5px] text-indigo-600 font-medium">{pendingSources.length} of {sources.length} ready to review</span>
            : <button onClick={() => onRefresh(sources.map((s) => s.sheet))} className={"flex items-center gap-1.5 text-[11px] font-medium " + (sources.some((s) => liveOf(s.sheet)) ? "ft-live" : "text-slate-500")}><RotateCcw size={11} /> Refresh all</button>}
        </div>
      )}
      <div className="divide-y divide-slate-200/70">
        {sources.map(({ group, sheet }) => {
          const pending = pendingOf(sheet), live = liveOf(sheet);
          return (
            <div key={recordKey(sheet)} className="flex items-center gap-2.5 flex-wrap px-3 py-2">
              <FileText size={15} className={st.stale ? "text-amber-500 shrink-0" : "text-slate-400 shrink-0"} />
              <div className="min-w-0 flex-1">
                {/* The stale surface (amber-50) is left light by the dark theme while
                    slate inks are remapped to near-white, so a stale row must state an
                    amber ink or its filename and dates disappear. */}
                <div className={"text-[12.5px] font-medium truncate " + (st.stale ? "text-amber-900" : "")}>{entryFileName(sheet)}</div>
                <div className={"text-[10.5px] truncate " + (st.stale ? "text-amber-700" : "text-slate-400")}>
                  from {group.name}
                  {sheet.lastFetched ? ` · fetched ${new Date(sheet.lastFetched).toLocaleDateString()}` : ""}
                  {lastImportAt ? ` · imported ${new Date(lastImportAt).toLocaleDateString()}` : ""}
                  {st.stale ? ` · ${st.days} days ago — stale` : ""}
                </div>
              </div>
              {pending ? (
                <button onClick={() => onReview(pending)} className="shrink-0 rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-indigo-700">Review changes</button>
              ) : (
                <button onClick={() => onRefresh(sheet)} title={live ? "Ready — fetch the latest sheet, then review at your pace" : "Fetch the latest sheet (needs a live sign-in — the board says how to unlock)"} className={"shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-white " + (live ? "ft-live" : "text-slate-600")}><RotateCcw size={12} /> Refresh</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookDetail({ book, updateBook, delBook, onDeleted, loadBookItems, applyBookImport, loadBookVersions, loadBookVersionSnapshot, pinBookVersion, updateBookItem, setBookItemsDisabled, reviewBookItemFlags, hideCosts, staleDays, inp, lbl, types, typeLabels, source, sourcePendingOf, sourceLiveOf, onRefreshSheet, onReviewSheet }) {
  const [items, setItems] = useState(null); // null = loading
  const [q, setQ] = useState("");
  const [show, setShow] = useState("all"); // all | enabled | disabled
  const [flaggedOnly, setFlaggedOnly] = useState(false); // composes with `show`
  const [selected, setSelected] = useState(() => new Set()); // SKUs ticked for bulk enable/disable
  const [confirmBulk, setConfirmBulk] = useState(null); // null | { disabled: boolean }
  const [confirmReset, setConfirmReset] = useState(false); // re-enable EVERY disabled item
  const [confirmResetReview, setConfirmResetReview] = useState(false); // clear EVERY confirmed flag
  const [wizard, setWizard] = useState(false);
  const [name, setName] = useState(book.name);
  const [editItem, setEditItem] = useState(null); // the item being hand-edited
  const [vSeq, setVSeq] = useState(0); // bump to refresh the import-history list
  const [confirmDel, setConfirmDel] = useState(false);

  const reload = () => { setItems(null); loadBookItems(book.id).then(setItems).catch(() => setItems([])); };
  useEffect(() => { let ok = true; loadBookItems(book.id).then((x) => ok && setItems(x)).catch(() => ok && setItems([])); return () => { ok = false; }; }, [book.id]);

  const markups = book.data?.markups || null;
  const li = book.data?.lastImport;
  const st = bookStaleness(li?.at, staleDays);
  // A book may be fed by several sheets (flooring + trim + product chart…).
  const sources = source || [];
  const pendingSources = sources.filter(({ sheet }) => sourcePendingOf(sheet));
  const isOrder = book.kind === "order";
  const cost = (n) => (hideCosts ? "•••" : n == null ? "—" : money(n));
  const activeItems = (items || []).filter((it) => it.active);
  // For the flag chips: lets a disabled row see its N-successor (supersede).
  const skuSet = useMemo(() => new Set((items || []).map((it) => it.sku)), [items]);
  const query = q.trim().toLowerCase();
  // hazard/advisory flags per row — the "needs a glance" set (info/muted chips
  // are provenance, not problems). Drives the Flagged filter, its open count,
  // and the per-row review actions.
  const flagsBySku = useMemo(() => {
    const m = new Map();
    for (const it of items || []) {
      const fl = itemFlags(it, skuSet).filter((f) => f.tone === "hazard" || f.tone === "advisory");
      if (fl.length) m.set(it.sku, fl);
    }
    return m;
  }, [items, skuSet]);
  const openFlagged = [...flagsBySku.values()].filter((fl) => fl.some((f) => !f.resolved)).length;
  const confirmedCount = (items || []).filter((it) => it.flagReview && Object.values(it.flagReview).some((e) => e.state === "confirmed")).length;
  // The select-all box and Flagged filter act on ALL filtered matches, not the
  // 300-row display slice.
  const filtered = (items || [])
    .filter((it) => (show === "disabled" ? it.disabled : show === "enabled" ? !it.disabled : true))
    .filter((it) => !flaggedOnly || flagsBySku.has(it.sku))
    .filter((it) => !query || `${it.sku} ${it.description} ${it.mfg} ${it.color}`.toLowerCase().includes(query));
  const shown = filtered.slice(0, 300);
  const disabledCount = (items || []).filter((it) => it.disabled).length;
  // Bulk enable/disable acts on the SELECTED rows still in the current filter.
  const selectedIn = filtered.filter((it) => selected.has(it.sku));
  const allSelected = filtered.length > 0 && selectedIn.length === filtered.length;
  const toggleSelectAll = () => setSelected(allSelected ? new Set() : new Set(filtered.map((it) => it.sku)));
  const toggleSelect = (sku) => setSelected((s) => { const n = new Set(s); n.has(sku) ? n.delete(sku) : n.add(sku); return n; });

  // Apply an import/rollback diff and refresh the table + history. applyBookImport
  // itself writes the version, so a rollback lands as the newest one.
  const applyDiff = async (diff) => {
    try { await applyBookImport(book.id, diff); reload(); setVSeq((s) => s + 1); }
    catch (x) { /* surfaced by applyBookImport */ }
  };
  const onApply = async (diff, opts) => {
    try {
      // Adding a file registers it as one of the book's sources, so the next
      // import knows to ask for it (ADR 0025). A file only reachable by hand —
      // Mirage's product chart — can never get into the manifest any other way,
      // since slots are recorded from imports and a whole-book import of it
      // would retire everything the other files supplied.
      const sources = opts.slot ? mergeSources(book.data?.sources, [opts.slot]) : undefined;
      await applyBookImport(book.id, diff, sources ? { ...opts, sources } : opts);
      setWizard(false); reload(); setVSeq((s) => s + 1);
    } catch (x) { /* surfaced by applyBookImport */ }
  };

  // Persist a hand-edit and merge the stamped result back into the open list
  // (re-normalized so it renders like a freshly loaded row).
  const saveItemEdit = async (edited) => {
    try {
      const data = await updateBookItem(book.id, edited);
      const merged = normBookItem({ sku: edited.sku, active: edited.active, data }, book.id);
      setItems((its) => (its || []).map((x) => x.sku === edited.sku ? merged : x));
      setEditItem(null);
    } catch (x) { /* surfaced by updateBookItem */ }
  };

  // Optimistic toggle; rolls the list back if the write fails (e.g. the
  // disabled-column migration hasn't been run).
  const setDisabled = async (skus, disabled) => {
    const set = new Set(skus);
    const prev = items;
    setItems((its) => (its || []).map((x) => (set.has(x.sku) ? { ...x, disabled } : x)));
    try { await setBookItemsDisabled(book.id, skus, disabled); }
    catch (x) { setItems(prev); }
  };

  // Confirm-fixed / ignore / undo / reset a row's flags. The write returns the
  // stamped flagReview maps, merged back so chips restyle immediately.
  const applyReview = async (ops) => {
    try {
      const out = await reviewBookItemFlags(book.id, ops);
      const bySku = new Map(out.map((o) => [o.sku, o.flagReview]));
      setItems((its) => (its || []).map((x) => (bySku.has(x.sku) ? { ...x, flagReview: bySku.get(x.sku) } : x)));
      setConfirmResetReview(false);
    } catch (x) { /* surfaced by reviewBookItemFlags */ }
  };
  // Clear the "confirmed" verdicts book-wide (ignored ones keep their state) —
  // any problem that still derives flags again.
  const resetConfirmed = () => applyReview((items || [])
    .filter((it) => it.flagReview && Object.values(it.flagReview).some((e) => e.state === "confirmed"))
    .map((it) => ({ item: it, codes: Object.keys(it.flagReview).filter((c) => it.flagReview[c].state === "confirmed"), state: null })));

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input className="ft-field rounded-md border border-slate-200 px-2 py-1 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() !== book.name && updateBook(book.id, { name: name.trim() })} />
        <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-slate-100 text-slate-500">{isOrder ? "Special order" : "Stock"}</span>
        <label className="flex items-center gap-1 text-xs text-slate-500 ml-auto">
          <input type="checkbox" checked={book.active} onChange={(e) => updateBook(book.id, { active: e.target.checked })} /> Active
        </label>
        <button onClick={() => setConfirmDel(true)} title="Delete this book" className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
      </div>

      {confirmDel && (
        <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs">
          <span className="text-red-600 flex-1">
            Delete "{book.name || "Untitled"}" for everyone{items && items.length ? <> — its {items.length} item{items.length === 1 ? "" : "s"} and import history</> : " and its import history"}? This can't be undone. Estimates that already used it keep the prices they saved.
          </span>
          <button onClick={() => { delBook(book.id); onDeleted?.(); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete book</button>
          <button onClick={() => setConfirmDel(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
        </div>
      )}

      <SourceSheetStrip sources={sources} pendingSources={pendingSources} stale={st} lastImportAt={li?.at} pendingOf={sourcePendingOf} liveOf={sourceLiveOf} onRefresh={onRefreshSheet} onReview={onReviewSheet} />
      <ManualSourcesCard
        sources={book.data?.sources}
        inp={inp}
        onDeclare={(label) => updateBook(book.id, { dataPatch: { sources: declareManualSource(book.data?.sources, label) } })}
        onUndeclare={(id) => updateBook(book.id, { dataPatch: { sources: undeclareManualSource(book.data?.sources, id) } })}
      />

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => setWizard("replace")} title="Import a file as this book's full contents — anything missing from it retires" className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600"><Upload size={14} /> Import…</button>
        <button onClick={() => setWizard("add")} title="Add another file to this book — its rows join, nothing retires" className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600"><Plus size={14} /> Add a file…</button>
        <span className="text-xs text-slate-400">
          {items == null ? "Loading items…" : `${activeItems.length} active item${activeItems.length === 1 ? "" : "s"}`}
          {li ? ` · imported ${new Date(li.at).toLocaleDateString()}${li.by ? ` by ${li.by}` : ""}` : " · never imported"}
        </span>
        {st.stale && <StaleChip days={st.days} />}
      </div>

      {isOrder && items && items.length > 0 && (
        <MarkupEditor book={book} items={items} onSave={(m) => updateBook(book.id, { dataPatch: { markups: m } })} inp={inp} lbl={lbl} />
      )}

      {items && items.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <input className={`${inp} max-w-sm`} placeholder="Search this book…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
              {[["all", "All"], ["enabled", "Enabled"], ["disabled", disabledCount ? `Disabled (${disabledCount})` : "Disabled"]].map(([v, label]) => (
                <button key={v} onClick={() => setShow(v)} className={`px-2.5 py-1.5 ${show === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{label}</button>
              ))}
            </div>
            {(flagsBySku.size > 0 || flaggedOnly) && (
              <button onClick={() => setFlaggedOnly((v) => !v)} title="Only rows with review flags — combines with All / Enabled / Disabled. Flagged rows get Confirm fixed / Ignore buttons; either verdict keeps the row quiet through re-imports." className={`flex items-center gap-1 text-xs rounded-md border px-2.5 py-1.5 ${flaggedOnly ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                <Flag size={12} /> Flagged{openFlagged ? ` (${openFlagged})` : ""}
              </button>
            )}
            {selectedIn.length > 0 && (
              <>
                <button onClick={() => setConfirmBulk({ disabled: true })} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Disable selected ({selectedIn.length})</button>
                <button onClick={() => setConfirmBulk({ disabled: false })} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Enable selected ({selectedIn.length})</button>
              </>
            )}
            {(disabledCount > 0 || confirmedCount > 0) && (
              <span className="flex items-center gap-2 ml-auto">
                {confirmedCount > 0 && (
                  <button onClick={() => setConfirmResetReview(true)} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50" title="Clear every confirmed-fixed verdict in this book — any problem that still shows flags again">Reset confirmed flags ({confirmedCount})</button>
                )}
                {disabledCount > 0 && (
                  <button onClick={() => setConfirmReset(true)} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50" title="Turn every disabled SKU in this book back on">Re-enable all disabled ({disabledCount})</button>
                )}
              </span>
            )}
          </div>
          {confirmReset && (
            <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <span className="text-amber-700 flex-1">Re-enable all {disabledCount} disabled item{disabledCount === 1 ? "" : "s"} in this book, regardless of the current filter? They'll show in SKU search again for everyone.</span>
              <button onClick={() => { setDisabled((items || []).filter((it) => it.disabled).map((it) => it.sku), false); setConfirmReset(false); setShow("all"); }} className="rounded-md bg-indigo-600 text-white px-2.5 py-1 font-medium shrink-0">Re-enable all {disabledCount}</button>
              <button onClick={() => setConfirmReset(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
          )}
          {confirmBulk && (
            <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <span className="text-amber-700 flex-1">
                {confirmBulk.disabled ? "Disable" : "Enable"} the {selectedIn.length} selected item{selectedIn.length === 1 ? "" : "s"}? Disabled items stop showing in SKU search for everyone; estimates that already picked them keep their prices.
              </span>
              <button onClick={() => { setDisabled(selectedIn.map((it) => it.sku), confirmBulk.disabled); setConfirmBulk(null); setSelected(new Set()); }} className="rounded-md bg-indigo-600 text-white px-2.5 py-1 font-medium shrink-0">{confirmBulk.disabled ? "Disable" : "Enable"} {selectedIn.length}</button>
              <button onClick={() => setConfirmBulk(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
          )}
          {confirmResetReview && (
            <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <span className="text-amber-700 flex-1">Reset the confirmed-fixed verdict on {confirmedCount} item{confirmedCount === 1 ? "" : "s"}? Any problem that still shows will flag again — and re-warn on the next import — until it's re-confirmed. Ignored flags keep their state.</span>
              <button onClick={resetConfirmed} className="rounded-md bg-indigo-600 text-white px-2.5 py-1 font-medium shrink-0">Reset {confirmedCount}</button>
              <button onClick={() => setConfirmResetReview(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
          )}
          <div className="mt-2 overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-1.5 w-8"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} title="Select / deselect all filtered rows" /></th>
                  <th className="text-left px-2 py-1.5">SKU</th>
                  <th className="text-left px-2 py-1.5">Description</th>
                  {isOrder && <th className="text-left px-2 py-1.5">Mfg</th>}
                  <th className="text-left px-2 py-1.5">U/M</th>
                  <th className="text-left px-2 py-1.5">Lead</th>
                  {isOrder && <th className="text-right px-2 py-1.5">Cost</th>}
                  <th className="text-right px-2 py-1.5">{isOrder ? "Sell" : "Price"}</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((it) => {
                  const priced = isOrder ? pricedItem(it, markups) : it;
                  const sell = priced.priceSqft != null ? priced.priceSqft : priced.price;
                  const openCodes = (flagsBySku.get(it.sku) || []).filter((f) => !f.resolved).map((f) => f.code);
                  const reviewedCodes = Object.keys(it.flagReview || {});
                  return (
                    <tr key={it.sku} className={`border-t border-slate-100 ${!it.active || it.discontinued || it.disabled ? "text-slate-300" : ""}`}>
                      <td className="px-2 py-1.5"><input type="checkbox" checked={selected.has(it.sku)} onChange={() => toggleSelect(it.sku)} title="Select for bulk enable / disable" /></td>
                      <td className="px-2 py-1.5 font-mono text-xs">{it.sku}</td>
                      <td className="px-2 py-1.5">
                        {it.description || "—"}
                        {it.freightFlag && <span className="ml-1.5 text-[9px] uppercase rounded bg-amber-100 text-amber-700 px-1 py-0.5">freight</span>}
                        {it.discontinued && <span className="ml-1.5 text-[9px] uppercase rounded bg-slate-100 text-slate-500 px-1 py-0.5">disc</span>}
                        {it.disabled && <span className="ml-1.5 text-[9px] uppercase rounded bg-slate-100 text-slate-500 px-1 py-0.5">off</span>}
                        {it.editedAt && <span title={`Hand-edited${it.editedBy ? ` by ${it.editedBy}` : ""} ${new Date(it.editedAt).toLocaleDateString()} — a re-import overwrites this`} className="ml-1.5 text-[9px] uppercase rounded bg-indigo-100 text-indigo-700 px-1 py-0.5">edited</span>}
                        {/* Why this row deserves a glance — derived fresh each render
                            (itemFlags), so fixing an item clears its chip and old
                            imports get chips retroactively. Hover for the reason.
                            Reviewed flags hide from the normal table (that's the
                            point) and show restyled in the Flagged view. */}
                        {itemFlags(it, skuSet).map((f) => {
                          if (f.resolved && !flaggedOnly) return null;
                          const rev = it.flagReview?.[f.code];
                          const title = f.resolved ? `${f.msg} ${f.resolved === "confirmed" ? "Confirmed fixed" : "Ignored"}${rev?.by ? ` by ${rev.by}` : ""}${rev?.at ? ` ${new Date(rev.at).toLocaleDateString()}` : ""} — won't re-flag on re-import.` : f.msg;
                          const tone = f.resolved === "confirmed" ? "bg-emerald-50 text-emerald-600" : f.resolved === "ignored" ? "bg-slate-100 text-slate-400" : f.tone === "hazard" ? "bg-amber-100 text-amber-700" : f.tone === "advisory" ? "bg-amber-50 text-amber-600" : f.tone === "info" ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-500";
                          return <span key={f.code} title={title} className={`ml-1.5 text-[9px] uppercase rounded px-1 py-0.5 cursor-help ${tone}`}>{f.label}{f.resolved === "confirmed" ? " ✓" : ""}</span>;
                        })}
                      </td>
                      {isOrder && <td className="px-2 py-1.5 text-xs">{it.mfg || "—"}</td>}
                      <td className="px-2 py-1.5 text-xs">{it.unit || "—"}</td>
                      <td className="px-2 py-1.5 text-xs">{it.leadTime || "—"}</td>
                      {isOrder && <td className="px-2 py-1.5 text-right text-xs tabular-nums">{cost(it.cost)}</td>}
                      <td className="px-2 py-1.5 text-right tabular-nums">{sell != null ? money(sell) : "—"}</td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        {flaggedOnly && (openCodes.length ? (
                          <>
                            <button onClick={() => applyReview([{ item: it, codes: openCodes, state: "confirmed" }])} title="Confirmed fixed — this problem stops flagging and won't re-warn on re-imports" className="text-[11px] rounded border border-emerald-300 text-emerald-700 px-1.5 py-0.5 mr-1 hover:bg-emerald-50">Confirm fixed</button>
                            <button onClick={() => applyReview([{ item: it, codes: openCodes, state: "ignored" }])} title="Ignore — hide this flag; it won't re-warn on re-imports" className="text-[11px] rounded border border-slate-200 text-slate-500 px-1.5 py-0.5 mr-1 hover:bg-slate-50">Ignore</button>
                          </>
                        ) : reviewedCodes.length > 0 && (
                          <button onClick={() => applyReview([{ item: it, codes: reviewedCodes, state: null }])} title="Undo — flag this row again" className="text-[11px] rounded border border-slate-200 text-slate-500 px-1.5 py-0.5 mr-1 hover:bg-slate-50">Undo</button>
                        ))}
                        <button onClick={() => setDisabled([it.sku], !it.disabled)} title={it.disabled ? "Enable — offer this SKU in search again" : "Disable — hide this SKU from search (estimates that already picked it keep their prices)"} className="text-slate-300 hover:text-slate-600 mr-2 align-middle">{it.disabled ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                        <button onClick={() => setEditItem(it)} title="Edit this item" className="text-slate-300 hover:text-slate-600 align-middle"><Pencil size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(filtered.length > shown.length) && <p className="text-[11px] text-slate-400 mt-1">Showing {shown.length} of {filtered.length}.</p>}
        </>
      )}

      {items && items.length === 0 && (
        <p className="text-sm text-slate-400 mt-6">This book is empty. Click <span className="text-slate-600">Import…</span> to map a vendor sheet's columns and load its items.</p>
      )}

      <ImportHistory bookId={book.id} refreshKey={vSeq} currentItems={items}
        loadVersions={loadBookVersions} loadSnapshot={loadBookVersionSnapshot} pinVersion={pinBookVersion}
        snapshotToItems={(snap) => snap.map((r) => normBookItem({ sku: r.sku, active: true, data: r.data || {} }, book.id))}
        computeDiff={diffBookItems} onRollback={applyDiff} noun="this book" />

      {editItem && <BookItemEditModal item={editItem} isOrder={isOrder} onClose={() => setEditItem(null)} onSave={saveItemEdit} inp={inp} lbl={lbl} />}

      {wizard && <BookImportWizard book={book} existingItems={items || []} addMode={wizard === "add"} onClose={() => setWizard(false)} onApply={onApply} saveMapping={(m) => updateBook(book.id, { dataPatch: { mapping: m } })} types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={hideCosts} />}
    </div>
  );
}

// A single hand-edit of a book item (Phase 4b). Edits the fields a shop most
// often needs to correct between vendor imports — the diff/warning contract
// (editedInDiff) then flags the row so the next import doesn't silently clobber
// the fix. Sell is not editable on order books: it derives from cost × markup.
function BookItemEditModal({ item, isOrder, onClose, onSave, inp, lbl }) {
  const [d, setD] = useState({
    description: item.description || "",
    mfg: item.mfg || "",
    unit: item.unit || "",
    leadTime: item.leadTime || "",
    cost: item.cost != null ? String(item.cost) : "",
    price: item.price != null ? String(item.price) : "",
    discontinued: !!item.discontinued,
  });
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const numField = (v) => { const n = parseFloat(String(v).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };
  const save = () => {
    const patch = { ...item, description: d.description.trim(), mfg: d.mfg.trim(), unit: d.unit.trim(), leadTime: d.leadTime.trim(), discontinued: d.discontinued };
    if (isOrder) patch.cost = d.cost.trim() === "" ? null : numField(d.cost);
    else patch.price = d.price.trim() === "" ? null : numField(d.price);
    onSave(patch);
  };
  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1"><h3 className="ft-serif text-xl">Edit item</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        <p className="font-mono text-xs text-slate-400 mb-3">{item.sku}</p>
        <div className="space-y-3">
          <div><label className={lbl}>Description</label><input className={inp} value={d.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="flex gap-3">
            {isOrder && <div className="flex-1"><label className={lbl}>Manufacturer</label><input className={inp} value={d.mfg} onChange={(e) => set("mfg", e.target.value)} /></div>}
            <div className="w-24"><label className={lbl}>U/M</label><input className={inp} value={d.unit} onChange={(e) => set("unit", e.target.value)} /></div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1"><label className={lbl}>{isOrder ? "Cost" : "Price"}</label><input className={inp} inputMode="decimal" value={isOrder ? d.cost : d.price} onChange={(e) => set(isOrder ? "cost" : "price", e.target.value)} /></div>
            <div className="flex-1"><label className={lbl}>Lead time</label><input className={inp} value={d.leadTime} onChange={(e) => set("leadTime", e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={d.discontinued} onChange={(e) => set("discontinued", e.target.checked)} /> Discontinued</label>
        </div>
        {isOrder && <p className="text-[11px] text-slate-400 mt-3">Selling price stays cost × markup — edit the markup on the book to move sell.</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
          <button onClick={save} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Save edit</button>
        </div>
      </div>
    </div>
  );
}

// The markup editor (Phase 2): a book default plus per-group overrides keyed on
// a chosen column (mfg, product line…). Selling price = cost × (1 + markup),
// computed at browse/pick time — editing a markup moves future picks only, never
// a saved estimate. The group axis is chosen here (no re-import needed) from the
// columns the book actually populates, and only the groups the sheet has are
// priceable (markupGroups), so there's no free-form matcher to get wrong.
const GROUP_LABEL = { mfg: "manufacturer", productLine: "product line", section: "section", brand: "brand" };
const GROUP_AXES = [["mfg", "Manufacturer"], ["productLine", "Product line"], ["section", "Section"], ["brand", "Brand"]];
function MarkupEditor({ book, items, onSave, inp, lbl }) {
  const markups = book.data?.markups || {};
  const [groupBy, setGroupBy] = useState(markups.groupBy || book.data?.mapping?.groupBy || "");
  const [def, setDef] = useState(markups.default != null ? String(markups.default) : "");
  const [byGroup, setByGroup] = useState(markups.byGroup || {});
  const [trim, setTrim] = useState(markups.trim != null ? String(markups.trim) : "");
  // Books carrying trim/molding lines (Mannington, ADR 0012) can mark trims up at
  // their own rate; the field is hidden on books that have no trims.
  const hasTrims = (items || []).some((it) => it.trim);
  // Only offer a group axis the book's items actually fill (Mannington carries a
  // product line but no mfg), so the dropdown never lists a dead choice.
  const axes = GROUP_AXES.filter(([f]) => (items || []).some((it) => String(it[f] ?? "").trim()));

  const commit = (nextDef, nextBy, nextTrim = trim, nextGroupBy = groupBy) => onSave({
    ...(nextGroupBy ? { groupBy: nextGroupBy } : {}),
    default: num(nextDef),
    byGroup: nextBy,
    ...(String(nextTrim).trim() !== "" ? { trim: num(nextTrim) } : {}),
  });
  const setGroup = (key, val) => {
    const next = { ...byGroup };
    if (val === "" || val == null) delete next[key]; else next[key] = num(val);
    setByGroup(next); commit(def, next);
  };
  // Switching the axis retires the old overrides — they were keyed on the prior
  // column's values and mean nothing under the new one.
  const changeGroupBy = (val) => { setGroupBy(val); setByGroup({}); commit(def, {}, trim, val); };
  const groups = groupBy ? markupGroups(items, { groupBy, default: num(def), byGroup }) : [];

  return (
    <div className="mt-4 border border-slate-100 rounded-lg p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Percent size={14} className="text-slate-400" />
        <span className="text-sm font-medium">Markup</span>
        <span className="text-[11px] text-slate-400">selling price = cost × (1 + markup)</span>
      </div>
      <div className="flex items-end gap-3 mt-2 flex-wrap">
        <div>
          <label className={lbl}>Default %</label>
          <input type="number" className={`${inp} w-24`} value={def} onChange={(e) => setDef(e.target.value)} onBlur={() => commit(def, byGroup)} placeholder="0" />
        </div>
        <span className="text-[11px] text-slate-400 pb-2">$10 cost → {money(10 * (1 + num(def) / 100))} sell</span>
        {hasTrims && (
          <div className="ml-auto text-right">
            <label className={lbl}>Trim %</label>
            <input type="number" className={`${inp} w-24`} value={trim} onChange={(e) => setTrim(e.target.value)} onBlur={() => commit(def, byGroup, trim)} placeholder={String(num(def))} />
            <p className="text-[10px] text-slate-400 mt-0.5">reducers, T-molds, stair-noses… (blank = default)</p>
          </div>
        )}
      </div>
      {axes.length > 0 ? (
        <div className="mt-3">
          <div>
            <label className={lbl}>Group markups by</label>
            <select className={`${inp} w-auto`} value={axes.some(([f]) => f === groupBy) ? groupBy : ""} onChange={(e) => changeGroupBy(e.target.value)}>
              <option value="">— one markup for all —</option>
              {axes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </div>
          {groupBy && groups.length > 0 && (
            <div className="mt-3">
              <label className={lbl}>Per-{GROUP_LABEL[groupBy] || groupBy} overrides <span className="normal-case tracking-normal text-slate-400">(blank = default)</span></label>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 max-w-xl">
                {groups.map((g) => (
                  <div key={g.key} className="flex items-center gap-2">
                    <span className="text-xs flex-1 truncate">{g.key} <span className="text-slate-300">({g.count})</span></span>
                    <input type="number" className="ft-field w-16 rounded border border-slate-200 px-1.5 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-indigo-500" value={g.overridden ? String(byGroup[g.key]) : ""} placeholder={String(num(def))} onChange={(e) => setGroup(g.key, e.target.value)} />
                    <span className="text-[10px] text-slate-400">%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 mt-2">This book has no product-line or manufacturer column to price by — only the default (and trim) markup applies.</p>
      )}
    </div>
  );
}

// Upload a vendor .xlsx, pick the data sheet, map its columns (headerless ones
// too), set the SKU pattern and a status-flag legend, watch the parse preview
// live, then apply the diff. The mapping is saved on the book so re-imports are
// one click. The parse is entirely client-side; nothing writes until Apply.
// What "Add a file" is about to do. Adding a file the book already knows is
// almost certainly meant as a replacement, so that case says so and points at
// Import… rather than quietly refreshing and leaving dropped rows behind.
// The amber surface stays light under the dark theme while slate inks are
// remapped to near-white, so it states an amber ink instead of inheriting.
// Exported for the preview harness.
function AddFileNotice({ knownSlot }) {
  return (
    <div className={"mb-2 rounded-lg border px-3 py-2 text-[11.5px] " + (knownSlot ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 text-slate-500")}>
      {knownSlot ? (
        <>
          <span className="font-medium">This file is already one of this book's sources</span> — last seen as “{knownSlot.label}”.
          Adding it refreshes the rows it contains but retires nothing, so anything dropped from the file stays in the book.
          To make it the book's full contents instead, close this and use <span className="font-medium">Import…</span>.
        </>
      ) : (
        <>Adding a file to this book: its rows join the existing ones and <span className="font-medium">nothing is retired</span>. The book will remember it, so a later import can tell when it's missing.</>
      )}
    </div>
  );
}

export function BookImportWizard({ book, existingItems, onClose, onApply, saveMapping, types, typeLabels, inp, lbl, hideCosts, preParsed, stepNote, carryItems = [], bundle = null, addMode = false }) {
  const saved = book.data?.mapping || null;
  const [sheets, setSheets] = useState(null); // [{ name, rows }]
  const [sheetName, setSheetName] = useState(saved?.sheet || "");
  const [headerRow, setHeaderRow] = useState(saved?.headerRow ?? -1);
  const [columns, setColumns] = useState(saved?.columns || {});
  const [skuPattern, setSkuPattern] = useState(saved?.skuPattern || mappedSkuRe().source);
  const [flags, setFlags] = useState(saved?.flags || {});
  const [groupBy, setGroupBy] = useState(saved?.groupBy || (book.kind === "order" ? "mfg" : ""));
  const [defaultType, setDefaultType] = useState(saved?.defaultType || "");
  // SF-per-carton lives inside the description text on the ERP stock exports
  // (no SF/CT column) — set by their detector, carried on the saved mapping.
  const [sfDesc, setSfDesc] = useState(!!saved?.sfFromDescription);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState("");
  const [srcName, setSrcName] = useState(""); // the chosen file name — a source slot label
  const [fmt, setFmt] = useState("generic"); // detected file format, stamped as the book's import fingerprint
  // What the source parser itself wants said — which files it did and didn't
  // find, and what it dropped. ADR 0025's rule is that a partial import is loud,
  // so these sit with the mapping warnings rather than being swallowed.
  const [srcWarn, setSrcWarn] = useState([]);
  const [ignored, setIgnored] = useState(() => new Set());   // SKUs the user chose to ignore (→ disabled)
  const [keepOld, setKeepOld] = useState(() => new Set());   // superseded oldSkus the user opted to KEEP active
  const [keepArea, setKeepArea] = useState(() => new Set()); // reclassified trims the user opted to KEEP as sqft
  const toggleSet = (setter) => (key) => setter((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleIgnored = toggleSet(setIgnored);
  const toggleKeepOld = toggleSet(setKeepOld);
  const toggleKeepArea = toggleSet(setKeepArea);

  const sheet = sheets?.find((s) => s.name === sheetName) || null;
  const rows = sheet?.rows || [];
  const maxCol = Math.min(30, rows.reduce((m, r) => Math.max(m, r?.length || 0), 0));

  // Turn a chosen file — or sheets/pages the multi-file drop router already
  // parsed — into the wizard's sheet list + auto-mapping, and remember the
  // detected format for the book's import fingerprint.
  const ingest = async ({ file, sheets: preSheets, pages: prePages, isPdf, payloads, format }) => {
    setReading(true); setErr("");
    if (file?.name) setSrcName(file.name);
    try {
      // A vendor whose documents must be JOINED rather than concatenated gets
      // every file at once (ADR 0025 rule 7). Like parseOvf below, the parser
      // resolves the whole set to one canonical sheet + mapping, so nothing
      // downstream knows it came from four files. It returns null when the set
      // isn't its own, and then we fall through to the single-file path.
      if (payloads?.length) {
        const joined = parseMirage(payloads, book.name || "Mirage price book");
        if (joined) {
          setFmt(format || "mirage-chart");
          setSheets([{ name: joined.name, rows: joined.rows }]);
          setSrcWarn(joined.warnings || []);
          applyDetected({ sheet: joined.name, ...joined.mapping });
          setReading(false);
          return;
        }
        return ingest({ ...payloads[0], file });
      }
      // Text-PDF vendor price lists: pdfbook aligns every page's own header onto
      // one canonical sheet, then we apply its suggested mapping. Mannington's
      // account list leads each row with Pattern, not the item code, so its fixed
      // grid gets a dedicated parser (ADR 0012); every other text PDF stays on
      // parsePdfPages. Everything downstream — sheet picker, mapping controls,
      // diff preview — is unchanged.
      if (isPdf || prePages) {
        const pages = prePages || (await readPdfPages(file));
        setFmt(fileFormat({ pages, isPdf: true }));
        const parsePdf = isManningtonCartons(pages) ? parseManningtonPages : parsePdfPages;
        const { name, rows, mapping } = parsePdf(pages, (file?.name || book.name || "book").replace(/\.pdf$/i, ""));
        setSheets([{ name, rows }]);
        applyDetected({ sheet: name, ...mapping });
        setReading(false);
        return;
      }
      const parsed = preSheets || (await readXlsxSheets(file));
      setFmt(fileFormat({ sheets: parsed }));
      // An OVF workbook (banded Hallmark wood / Tarkett LVT, or a sundries
      // section-table, issue 025) can't be column-mapped raw — its dedicated
      // parser flattens it to one canonical sheet, like Mannington's PDF above.
      const ovf = parseOvf(parsed, (file?.name || book.name || "book").replace(/\.xlsx?$/i, ""));
      if (ovf) {
        setSheets([{ name: ovf.name, rows: ovf.rows }]);
        applyDetected({ sheet: ovf.name, ...ovf.mapping });
        setReading(false);
        return;
      }
      setSheets(parsed);
      // A saved mapping wins; else recognize the VTC "EFT" template (fills the
      // whole mapping in one step); else pick the best data sheet by header
      // quality and guess its columns.
      if (saved?.sheet && parsed.find((s) => s.name === saved.sheet)) { applySheet(parsed.find((s) => s.name === saved.sheet)); }
      else {
        const detected = detectVtcEft(parsed) || detectVendorSkuAnalysis(parsed);
        if (detected) applyDetected(detected);
        else applySheet(bestDataSheet(parsed));
      }
    } catch (x) { setErr("Could not read that file — is it an .xlsx / .xls, or a text-based .pdf?"); }
    setReading(false);
  };
  const onFile = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) ingest({ file: f, isPdf: /\.pdf$/i.test(f.name) || f.type === "application/pdf" }); };
  // The router hands in an already-parsed file; ingest it once on mount so the
  // wizard opens straight on the preview (no chooser flash, no second read).
  useEffect(() => { if (preParsed && !sheets) ingest(preParsed); }, []);

  // A recognized vendor template (detectVtcEft) fills every mapping control at
  // once, so a known sheet is one upload with nothing to hand-map.
  const applyDetected = (m) => {
    setSheetName(m.sheet);
    setHeaderRow(m.headerRow ?? -1);
    setColumns(m.columns || {});
    if (m.skuPattern) setSkuPattern(m.skuPattern);
    if (m.flags) setFlags(m.flags);
    if (m.groupBy) setGroupBy(m.groupBy);
    if (m.defaultType) setDefaultType(m.defaultType);
    setSfDesc(!!m.sfFromDescription);
  };

  // Choosing a sheet (auto or manual): if we have no saved mapping, guess the
  // header row and the columns from it.
  const applySheet = (s) => {
    if (!s) return;
    setSheetName(s.name);
    if (saved?.sheet === s.name && saved.columns) { setHeaderRow(saved.headerRow ?? -1); setColumns(saved.columns); return; }
    const hr = guessHeaderRow(s.rows);
    setHeaderRow(hr);
    setColumns(hr >= 0 ? columnsFromHeader(s.rows[hr] || []) : {});
  };

  const setCol = (i, field) => setColumns((c) => {
    const next = { ...c };
    if (field) { for (const k of Object.keys(next)) if (next[k] === field && field !== "flag") delete next[k]; next[i] = field; }
    else delete next[i];
    return next;
  });

  const mapping = { sheet: sheetName, headerRow: headerRow >= 0 ? headerRow : undefined, columns, skuPattern, flags, groupBy: groupBy || undefined, defaultType: defaultType || undefined, sfFromDescription: sfDesc || undefined };
  // Flag verdicts already on the book's rows (confirmed / ignored) mute those
  // codes in the parse warnings and the problem list below — a reviewed row
  // must not re-nag on every re-import of the same file.
  const review = flagReviewBySku(existingItems);
  const { items: parsedItems, warnings: mapWarn } = sheet ? parseMapped(rows, mapping, review) : { items: [], warnings: [] };
  // The source parser's own warnings lead: "the chart is missing" outranks any
  // per-row mapping complaint, because it changes what the import MEANS.
  const warnings = srcWarn.length ? [...srcWarn, ...mapWarn] : mapWarn;
  // Rows the classifier reclassified to per-piece trims (ADR 0013 amendment),
  // listed for review below; un-ticking one keeps it a square-foot line.
  const reclassified = parsedItems.filter((it) => it.trimSignal);
  const items = keepArea.size ? parsedItems.map((it) => (keepArea.has(it.sku) ? { ...it, trim: false, type: mapping.defaultType || null, trimSignal: "" } : it)) : parsedItems;
  // When several files feed one book (ADR 0025), the diff is against everything
  // the bundle has produced so far, not just this file — otherwise each file
  // would read the previous file's rows as "missing" and retire them. A later
  // file wins a SKU collision, so the sheets are layered in the order routed.
  const carried = addMode ? existingItems : carryItems;
  const bundleItems = carried.length ? [...new Map([...carried, ...items].map((it) => [it.sku, it])).values()] : items;
  const diff = sheet ? diffBookItems(existingItems, bundleItems) : { added: [], changed: [], missing: [], unchanged: [] };
  const editedOverwritten = sheet ? editedInDiff(existingItems, bundleItems) : [];
  const flagCol = Object.entries(columns).find(([, f]) => f === "flag")?.[0];
  const flagValues = flagCol != null ? [...new Set(rows.slice((headerRow >= 0 ? headerRow : -1) + 1).map((r) => String(r?.[flagCol] ?? "").trim()).filter((v) => v && v.length <= 4))].slice(0, 12) : [];

  // The sheet's own header labels, shown above each mapping dropdown so a column
  // is identified without reading sample rows. Blank cells (VTC's status-flag and
  // description columns) show "— no header —" so their emptiness is explicit.
  const headerCells = headerRow >= 0 ? (rows[headerRow] || []) : [];
  const headerLabel = (i) => String(headerCells[i] ?? "").replace(/\s+/g, " ").trim();

  const preview = items.slice(0, 8);

  // Per-row pricing/unit hazards and N-suffix supersede pairs for the review
  // sections. Derived each render like `diff` — nothing is stored on an item.
  // Rows already disabled in the book are NOT re-surfaced for ignoring: they stay
  // disabled (applyImport's `off()` preserves it) and re-prompting to ignore them
  // every import was exactly the nag we're removing. Re-enable from the book table.
  const alreadyDisabled = new Set((existingItems || []).filter((it) => it.disabled).map((it) => it.sku));
  const problemsRaw = sheet ? items.map((it) => ({ it, probs: itemProblems(it) })).filter((x) => x.probs.length) : [];
  const problemsAll = problemsRaw.map(({ it, probs }) => ({ it, probs: probs.filter((p) => !review.get(it.sku)?.[p.code]) })).filter((x) => x.probs.length);
  const keptReviewed = problemsRaw.length - problemsAll.length;
  const problems = problemsAll.filter((x) => !alreadyDisabled.has(x.it.sku));
  const keptDisabled = problemsAll.length - problems.length;
  const quietNote = [
    keptDisabled > 0 ? `${keptDisabled} previously-disabled row${keptDisabled === 1 ? "" : "s"} stayed off automatically` : "",
    keptReviewed > 0 ? `${keptReviewed} reviewed row${keptReviewed === 1 ? "" : "s"} (confirmed or ignored earlier) stayed quiet` : "",
  ].filter(Boolean).join("; ");
  const supersedes = sheet ? supersedePairs(existingItems, items) : [];
  const supersedeOld = supersedes.filter((p) => !keepOld.has(p.oldSku)).map((p) => p.oldSku);
  const disableSkus = [...new Set([...ignored, ...supersedeOld])];
  const appliedSupersede = supersedes.filter((p) => !keepOld.has(p.oldSku)).map((p) => ({ oldSku: p.oldSku, newSku: p.newSku }));
  // Stamp the book with what this file looks like so the drop router matches the
  // next drop of the same vendor sheet (format tag + header signature + the EFT
  // brand-title line, which is what tells Virginia Tile's sibling files apart).
  const fingerprint = sheet ? (({ headerSig, titleSig }) => ({ format: fmt, headerSig, titleSig }))(computeFingerprint({ sheets: sheets || [], name: srcName })) : null;
  // Adding a file names it as one of the book's sources. Matched on content, not
  // filename — re-adding next quarter's re-dated copy is the same slot, not a new
  // one (ADR 0025).
  const addSlot = addMode && sheet ? sourceSlot({ fingerprint, name: srcName }) : null;
  const knownSlot = addSlot ? (book.data?.sources || []).find((s) => s.id === addSlot.id) : null;
  const importCount = diff.added.length + diff.changed.length + diff.missing.length;
  // Disabling SKUs is a valid apply even when the re-import is otherwise a no-op
  // (identical book → every row unchanged) — so the button also opens on pending
  // disables, and reads them alone when there's no import to report.
  // A book's bundle only writes on its last file; before that the button banks
  // this file's rows and moves to the next one.
  const lastOfBundle = !bundle || bundle.index >= bundle.total - 1;
  const applyLabel = !lastOfBundle
    ? `Next file — ${bundle.index + 2} of ${bundle.total}`
    : addMode
    ? `Add — ${diff.added.length} new · ${diff.changed.length} updated`
    : importCount === 0 && disableSkus.length
    ? `Apply — ${disableSkus.length} disabled`
    : `Apply — ${diff.added.length} new · ${diff.changed.length} changed · ${diff.missing.length} retiring${disableSkus.length ? ` · ${disableSkus.length} disabled` : ""}`;

  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="ft-serif text-2xl">Import — {book.name || "book"}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
        {stepNote}
        {addMode && <AddFileNotice knownSlot={knownSlot} />}

        {!sheets ? (
          <div className="py-8 text-center">
            <label className="inline-flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-4 py-2 text-slate-600 cursor-pointer">
              <Upload size={15} /> {reading ? "Reading…" : "Choose vendor sheet (.xlsx / .xls / .pdf)"}
              <input type="file" accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFile} className="hidden" />
            </label>
            {err && <p className="text-xs text-red-500 mt-3">{err}</p>}
            <p className="text-[11px] text-slate-400 mt-3 max-w-md mx-auto">Nothing is saved until you apply. The file is parsed here in your browser.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={lbl}>Data sheet</label>
                <select className={`${inp} w-auto`} value={sheetName} onChange={(e) => applySheet(sheets.find((s) => s.name === e.target.value))}>
                  {sheets.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.rows?.length || 0})</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Header row</label>
                <input type="number" className={`${inp} w-20`} value={headerRow < 0 ? "" : headerRow + 1} placeholder="none" onChange={(e) => setHeaderRow(e.target.value === "" ? -1 : Math.max(0, Number(e.target.value) - 1))} />
              </div>
              <div>
                <label className={lbl}>SKU pattern</label>
                <input className={`${inp} w-56 font-mono text-xs`} value={skuPattern} onChange={(e) => setSkuPattern(e.target.value)} />
              </div>
              {book.kind === "order" && (
                <div>
                  <label className={lbl}>Markup group</label>
                  <select className={`${inp} w-auto`} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                    {[["", "— none —"], ["mfg", "Manufacturer"], ["productLine", "Product line"], ["section", "Section"], ["brand", "Brand"]].map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={lbl}>Default type</label>
                <select className={`${inp} w-auto`} value={defaultType} onChange={(e) => setDefaultType(e.target.value)}>
                  <option value="">Misc / accessory</option>
                  {types.filter((t) => t !== "misc").map((t) => <option key={t} value={t}>{typeLabels[t] || t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={lbl}>Map columns — a row is imported only when its SKU cell matches the pattern</label>
              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="text-xs">
                  <thead>
                    <tr>{Array.from({ length: maxCol }, (_, i) => (
                      <th key={i} className="px-1.5 py-1 border-b border-slate-100 align-top">
                        <div className={`text-[10px] mb-1 max-w-[120px] truncate ${headerLabel(i) ? "text-slate-500 font-medium" : "text-slate-300 italic"}`} title={headerLabel(i) || "no header"}>{headerLabel(i) || "— no header —"}</div>
                        <select className="ft-field rounded border border-slate-200 px-1 py-0.5 text-[11px] max-w-[120px]" value={columns[i] || ""} onChange={(e) => setCol(i, e.target.value)}>
                          {bookFieldOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                        </select>
                      </th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {rows.slice((headerRow >= 0 ? headerRow : -1) + 1, (headerRow >= 0 ? headerRow : -1) + 6).map((r, ri) => (
                      <tr key={ri}>{Array.from({ length: maxCol }, (_, i) => (
                        <td key={i} className={`px-1.5 py-1 border-b border-slate-50 whitespace-nowrap max-w-[120px] truncate ${columns[i] === "sku" ? "bg-indigo-50" : ""}`}>{String(r?.[i] ?? "")}</td>
                      ))}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {flagValues.length > 0 && (
              <div>
                <label className={lbl}>Status flag legend</label>
                <div className="flex flex-wrap gap-2">
                  {flagValues.map((v) => (
                    <div key={v} className="flex items-center gap-1 border border-slate-200 rounded px-2 py-1">
                      <span className="font-mono text-xs">{v}</span>
                      <select className="ft-field text-[11px] border-0 focus:ring-0" value={flags[v] || ""} onChange={(e) => setFlags((f) => { const n = { ...f }; if (e.target.value) n[v] = e.target.value; else delete n[v]; return n; })}>
                        {FLAG_SEMANTICS.map(([val, t]) => <option key={val} value={val}>{t}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium">{items.length} item{items.length === 1 ? "" : "s"} parsed</span>
                <span className="text-xs text-emerald-600">{diff.added.length} new</span>
                <span className="text-xs text-amber-600">{diff.changed.length} changed</span>
                <span className="text-xs text-slate-400">{diff.missing.length} retiring · {diff.unchanged.length} unchanged</span>
              </div>
              {editedOverwritten.length > 0 && (
                <p className="mt-1.5 text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-1 inline-block" title={editedOverwritten.map((i) => i.sku).join(", ")}>
                  <Pencil size={11} className="inline -mt-0.5 mr-1" />{editedOverwritten.length} item{editedOverwritten.length === 1 ? " you" : "s you"} hand-edited will be overwritten by this import.
                </p>
              )}
              {warnings.length > 0 && <ul className="mt-1 text-[11px] text-amber-600 list-disc pl-4 max-h-36 overflow-y-auto">{warnings.slice(0, 12).map((w, i) => <li key={i}>{w}</li>)}{warnings.length > 12 && <li className="list-none text-slate-400">…and {warnings.length - 12} more</li>}</ul>}
              {preview.length > 0 && (
                <div className="mt-2 overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-[10px] uppercase text-slate-400"><tr>
                      <th className="text-left px-2 py-1">SKU</th><th className="text-left px-2 py-1">Description</th>
                      {book.kind === "order" && <th className="text-left px-2 py-1">Mfg</th>}
                      <th className="text-left px-2 py-1">Type</th><th className="text-left px-2 py-1">Size</th><th className="text-left px-2 py-1">U/M</th><th className="text-right px-2 py-1">{book.kind === "order" ? "Cost" : "Price"}</th>
                    </tr></thead>
                    <tbody>{preview.map((it) => (
                      <tr key={it.sku} className="border-t border-slate-100">
                        <td className="px-2 py-1 font-mono">{it.sku}</td><td className="px-2 py-1 truncate max-w-xs">{it.description}{it.freightFlag && <span className="ml-1 text-[9px] text-amber-600">◇frt</span>}</td>
                        {book.kind === "order" && <td className="px-2 py-1">{it.mfg}</td>}
                        <td className={`px-2 py-1 whitespace-nowrap ${it.type ? "text-slate-600" : "text-amber-600"}`}>{it.type ? (typeLabels[it.type] || it.type) : "Misc"}</td>
                        <td className="px-2 py-1 whitespace-nowrap ft-mono">{it.size || "—"}{it.thickness ? <span className="text-slate-400"> · {it.thickness}</span> : ""}</td>
                        <td className="px-2 py-1 whitespace-nowrap">{orderUnitOf(it) && orderUnitOf(it) !== priceUnitOf(it) ? `${priceUnitOf(it)} → ${orderUnitOf(it)}` : priceUnitOf(it)}</td><td className="px-2 py-1 text-right tabular-nums">{hideCosts ? "•••" : it.cost != null ? money(it.cost) : it.price != null ? money(it.price) : "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </div>

            {problems.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-amber-800">{problems.length} problem row{problems.length === 1 ? "" : "s"} — these will misprice unless fixed at the source</span>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setIgnored(new Set(problems.map((p) => p.it.sku)))} className="rounded-md border border-amber-300 px-2 py-1 text-amber-700 hover:bg-amber-100">Ignore all</button>
                    <button onClick={() => setIgnored(new Set())} className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-white">Include all</button>
                  </div>
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-amber-100 border-t border-amber-100">
                  {problems.map(({ it, probs }) => {
                    const off = ignored.has(it.sku);
                    return (
                      <div key={it.sku} className="py-1.5 flex items-center gap-2 text-xs">
                        <span className="font-mono text-slate-500 shrink-0">{it.sku}</span>
                        <span className="truncate flex-1 min-w-0">{it.description || "—"}<span className="text-amber-700"> · {probs[0].msg}</span></span>
                        <button onClick={() => toggleIgnored(it.sku)} className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${off ? "bg-slate-200 text-slate-600" : "bg-white border border-amber-300 text-amber-700"}`}>{off ? "Ignored" : "Include"}</button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-amber-700">Ignored rows still import, but disabled — hidden from SKU search. Turn any back on later from the book table.{quietNote ? ` ${quietNote}.` : ""}</p>
              </div>
            )}
            {problems.length === 0 && quietNote && (
              <p className="text-[11px] text-slate-400">{quietNote} — manage either from the book table.</p>
            )}

            {supersedes.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="text-sm font-medium">{supersedes.length} superseded SKU{supersedes.length === 1 ? "" : "s"} — a new “N” code replaces an older one</span>
                <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
                  {supersedes.map((p) => (
                    <label key={`${p.oldSku}>${p.newSku}`} className="py-1.5 flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={!keepOld.has(p.oldSku)} onChange={() => toggleKeepOld(p.oldSku)} title="Disable the old SKU" />
                      <span className="flex-1 min-w-0 truncate">
                        <span className="font-mono text-slate-400 line-through">{p.oldSku}</span>{p.oldDesc ? ` ${p.oldDesc}` : ""}
                        <span className="mx-1 text-slate-300">→</span>
                        <span className="font-mono text-slate-600">{p.newSku}</span>{p.newDesc ? ` ${p.newDesc}` : ""}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">Checked = disable the old SKU (kept for saved estimates, just hidden from new search). Uncheck to keep it active.</p>
              </div>
            )}

            {reclassified.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="text-sm font-medium">{reclassified.length} trim{reclassified.length === 1 ? "" : "s"} will quote per piece — the sheet prices them by the square foot off coverage that isn't real</span>
                <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
                  {reclassified.map((it) => (
                    <label key={it.sku} className="py-1.5 flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={!keepArea.has(it.sku)} onChange={() => toggleKeepArea(it.sku)} title="Quote per piece" />
                      <span className="font-mono text-slate-500 shrink-0">{it.sku}</span>
                      <span className="truncate flex-1 min-w-0">{it.description || "—"}</span>
                      <span className="shrink-0 rounded px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px]" title={{ lexicon: "Named as a trim (bullnose, gradino, end cap…)", inversion: "Its derived $/sqft cost lands below its own per-piece cost", notional: "Its SF/CT is a bare metric constant that contradicts its size" }[it.trimSignal] || it.trimSignal}>{it.trimSignal}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">Checked = sells per piece (enter pieces on the job; carton-sold SKUs round up to whole cartons). Uncheck to keep one a square-foot line.</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-1">
              <button onClick={() => saveMapping(mapping)} className="text-sm text-slate-500 hover:text-slate-700 underline">Save mapping only</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
                <button onClick={() => { saveMapping(mapping); onApply(diff, { disableSkus, superseded: appliedSupersede, fingerprint, slot: addSlot }, bundleItems); }} disabled={lastOfBundle && importCount + disableSkus.length === 0} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">{applyLabel}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

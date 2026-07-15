# Price Book Single Drop Area (PR C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One drop area at the top of the Price book library (`PriceBookLibrary`) that accepts a mix of `.xlsx`/`.xls`/`.pdf`, detects each file's target book (stock workbook, VTC EFT, Mannington PDF, or a book's saved mapping), shows a routing screen where unmatched files get a book dropdown, then steps through each file's normal per-book import preview one at a time — reusing the existing `BookImportWizard` (with its PR B problems/supersede review) for registry books and the existing stock-import preview for the shop workbook.

**Architecture:** A pure detection/routing layer (`src/dropimport.js` + a `detectStockWorkbook` in `pricebook.js`) computes a per-file fingerprint and matches it to a book. A new `ImportRouter` component inside `PriceBookLibrary` reads the dropped files once, routes them, renders the routing UI, and drives a sequential queue. `BookImportWizard` is refactored to accept a **pre-read** file (sheets/pages already parsed) so the router can hand it work without a second read. Registry applies go through the existing `applyBookImport(bookId, diff, opts)` (now stamping a fingerprint from `opts.fingerprint`); the stock file routes through a small `importStockFile(file, onDone)` wrapper around today's `importPriceBook`.

**Tech Stack:** React 18 (single App.jsx, hooks only), Supabase JS v2, xlsx + pdfjs-dist (both lazy-loaded), node:test.

**Spec:** `docs/superpowers/specs/2026-07-14-pricebook-importer-upgrades-design.md` (PR C — single drop area).

## Global Constraints

- **Never mutate the live Supabase project** — **no SQL is required for PR C** (it reuses PR A's `disabled` column and existing tables). `npm run dev` and the preview hit the live project; look but don't Apply against real data during preview proof unless the owner OKs it.
- **Never push to `main`** — lands via PR from branch `claude/pricebook-single-drop` (already created off post-#109 main).
- **No UI change merges without preview proof** — the owner must drop real files (the session can't drive the OS file picker / drag-drop); screenshot the routing screen with a VTC `.xlsx` + a Mannington `.pdf` + the stock workbook in one drop.
- **Reuse, don't fork:** registry files reuse `BookImportWizard` unchanged except the pre-read entry point; the stock file reuses `importPriceBook` / the App-level stock preview modal unchanged except an `onDone` hook. No new write semantics — every apply is an existing per-book path + version snapshot.
- **Out of scope** (spec): scheduled/auto imports, "create new book from a dropped file", suffix conventions beyond the PR B trailing-N. The per-book "Import…" button inside `BookDetail` stays as-is.
- Snapshot doctrine unchanged: nothing new is stored on an item; the only new persisted field is a book's `data.importFingerprint` (format tag + header signature, used only to route future drops).
- Comments rare (house style). Reuse existing slate/indigo/amber utility classes.
- Tests: `npm test`. Build: `npm run build`. Both must pass at every commit.

---

### Task 1: Detection + routing helpers (pure, tested)

**Files:**
- Modify: `src/pricebook.js` (add + export `detectStockWorkbook`)
- Create: `src/dropimport.js` (fingerprint + routing)
- Test: add a `detectStockWorkbook` case to `src/pricebook.test.js`; create `src/dropimport.test.js`

**Interfaces produced (Task 4 consumes):**
- `detectStockWorkbook(sheets): boolean` — the shop workbook by its sheet-name signature.
- `fileFormat({ sheets, pages, isPdf }): "stock" | "vtc-eft" | "mannington" | "generic"`.
- `computeFingerprint({ sheets, pages, isPdf }): { format, headerSig }` — `headerSig` is a stable normalized string of the detected header (`""` when none); stamped on a book at import and recomputed for a dropped file.
- `mappingMatchesFile(mapping, sheets): boolean` — a book's saved `data.mapping` parses ≥1 SKU row out of this file.
- `routeFile(info, books): { target, candidates, reason }` where `info = { format, headerSig, sheets }`, `target` is a `bookId` \| `"stock"` \| `null`, `candidates` is the ambiguous book-id list, `reason` is a short human string.

**Design notes:**
- Detection priority (spec): stock signature → VTC EFT → Mannington PDF → saved-mapping match. `fileFormat` returns the strongest format tag; `routeFile` turns it into a target.
- Matching a registry format to a book uses two signals so **pre-PR-C books (no fingerprint yet) still match:** (a) `book.data.importFingerprint.format === format`, and (b) `mappingMatchesFile(book.data.mapping, sheets)`. Union, dedup. Exactly one candidate → confident `target`; zero or several → `target: null` (routing UI shows a dropdown). Stock is always deterministic (needs no stored fingerprint).
- `headerSig` is stored for completeness and future accelerating, but format + saved-mapping-parse are the workhorses — keep matching off fragile header-string equality.

- [ ] **Step 1: `detectStockWorkbook` in `pricebook.js`** (add near `parsePriceBook`, export it)

```js
// The shop workbook is recognized by its hand-built sheet names — the special
// parsers key off these exact names (parsePriceBook), and no vendor file carries
// them. Two or more distinctive names present ⇒ it's the stock workbook. Used by
// the multi-file drop router (PR C) to route a dropped workbook to the stock
// import instead of a registry book.
export const STOCK_SHEET_NAMES = ["Grout & Caulk", "Mann Aduramax", "Tile Seats, Curbs, Trims", "Hardwood", "Vinyl", "Tile", "Index"];
export function detectStockWorkbook(sheets) {
  const names = new Set((sheets || []).map((s) => s.name));
  return STOCK_SHEET_NAMES.filter((n) => names.has(n)).length >= 2;
}
```

Add `detectStockWorkbook` to the pricebook.test.js import and assert: a workbook with `Grout & Caulk` + `Tile` + `Index` → `true`; a single-sheet VTC-style sheet → `false`.

- [ ] **Step 2: Create `src/dropimport.js`**

```js
// Multi-file drop routing (ADR 0009 importer upgrades, PR C). Pure detection +
// routing over already-parsed files: each dropped file is read once by the
// component, then fingerprinted and matched to a book here. No I/O — the caller
// hands in parsed sheets (xlsx) or pages (pdf).

import { detectVtcEft, detectStockWorkbook, parseMapped } from "./pricebook.js";
import { isManningtonCartons } from "./manningtonbook.js";

export function fileFormat({ sheets, pages, isPdf }) {
  if (isPdf) return isManningtonCartons(pages || []) ? "mannington" : "generic";
  if (detectStockWorkbook(sheets || [])) return "stock";
  if (detectVtcEft(sheets || [])) return "vtc-eft";
  return "generic";
}

// A short, order-independent signature of the file's header, so a book can
// remember "what a file it imports looks like" and match the next drop even
// before a saved mapping exists. VTC files fingerprint off their detected header
// row; other files off the best data sheet's first non-empty row.
export function computeFingerprint({ sheets, pages, isPdf }) {
  const format = fileFormat({ sheets, pages, isPdf });
  let header = [];
  if (!isPdf) {
    const eft = detectVtcEft(sheets || []);
    if (eft) header = (sheets.find((s) => s.name === eft.sheet)?.rows?.[eft.headerRow]) || [];
    else header = (sheets || []).map((s) => (s.rows || []).find((r) => (r || []).some((c) => c != null && String(c).trim())))?.find(Boolean) || [];
  }
  const headerSig = header.map((c) => String(c ?? "").toLowerCase().replace(/\s+/g, "")).filter(Boolean).sort().join("|");
  return { format, headerSig };
}

// Does a book's saved mapping actually parse this file? Cheap "would the existing
// mapping work" probe — the strongest signal for books imported before PR C
// stamped fingerprints. PDFs get a canonical sheet name derived from the file
// name, so their saved sheet name rarely matches a fresh drop; guard on presence.
export function mappingMatchesFile(mapping, sheets) {
  if (!mapping?.sheet) return false;
  const rows = (sheets || []).find((s) => s.name === mapping.sheet)?.rows;
  if (!rows) return false;
  try { return parseMapped(rows, mapping).items.length > 0; }
  catch { return false; }
}

// Route one parsed file to a target book. Stock is deterministic; registry
// formats match a book by stored fingerprint format OR a saved mapping that
// parses the file. Exactly one candidate ⇒ confident; else the UI asks.
export function routeFile({ format, headerSig, sheets }, books) {
  if (format === "stock") return { target: "stock", candidates: [], reason: "Shop workbook (sheet names matched)" };
  const cand = new Set();
  for (const b of books || []) {
    const fp = b.data?.importFingerprint;
    if (format !== "generic" && fp?.format === format) cand.add(b.id);
    else if (fp?.headerSig && headerSig && fp.headerSig === headerSig) cand.add(b.id);
    else if (mappingMatchesFile(b.data?.mapping, sheets)) cand.add(b.id);
  }
  const candidates = [...cand];
  if (candidates.length === 1) {
    const b = (books || []).find((x) => x.id === candidates[0]);
    return { target: candidates[0], candidates, reason: labelFor(format, b) };
  }
  return { target: null, candidates, reason: candidates.length ? "More than one book could take this file" : reasonFor(format) };
}

const labelFor = (format, b) =>
  format === "vtc-eft" ? `Virginia Tile EFT → ${b?.name || "book"}`
  : format === "mannington" ? `Mannington cartons → ${b?.name || "book"}`
  : `Matches ${b?.name || "book"}'s saved layout`;
const reasonFor = (format) =>
  format === "vtc-eft" ? "Virginia Tile EFT — pick which book"
  : format === "mannington" ? "Mannington cartons — pick which book"
  : "Unrecognized layout — pick a book";
```

- [ ] **Step 3: `src/dropimport.test.js`** — cover the routing matrix with hand-built fixtures:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileFormat, mappingMatchesFile, routeFile } from "./dropimport.js";

const stockSheets = [{ name: "Grout & Caulk", rows: [] }, { name: "Tile", rows: [] }, { name: "Index", rows: [] }];
const vtcSheets = [{ name: "EFT", rows: [["Item Code", "VTC Mfg", "Description", "Dealer Price"], ["ABC123", "Marazzi", "Oak", 3.29]] }];

test("fileFormat: stock signature, VTC EFT, generic xlsx, Mannington vs generic pdf", () => {
  assert.equal(fileFormat({ sheets: stockSheets }), "stock");
  assert.equal(fileFormat({ sheets: vtcSheets }), "vtc-eft");
  assert.equal(fileFormat({ sheets: [{ name: "S", rows: [["Name", "Price"], ["Oak", 5]] }] }), "generic");
});

test("routeFile: stock is deterministic", () => {
  assert.equal(routeFile({ format: "stock", headerSig: "", sheets: stockSheets }, []).target, "stock");
});

test("routeFile: one VTC book by fingerprint ⇒ confident; two ⇒ ask", () => {
  const b1 = { id: "b1", name: "VTC Core", data: { importFingerprint: { format: "vtc-eft" } } };
  const b2 = { id: "b2", name: "VTC SO", data: { importFingerprint: { format: "vtc-eft" } } };
  assert.equal(routeFile({ format: "vtc-eft", headerSig: "", sheets: vtcSheets }, [b1]).target, "b1");
  assert.equal(routeFile({ format: "vtc-eft", headerSig: "", sheets: vtcSheets }, [b1, b2]).target, null);
  assert.deepEqual(routeFile({ format: "vtc-eft", headerSig: "", sheets: vtcSheets }, [b1, b2]).candidates.sort(), ["b1", "b2"]);
});

test("routeFile: pre-fingerprint book matched by its saved mapping", () => {
  const mapping = { sheet: "EFT", headerRow: 0, columns: { 0: "sku", 1: "mfg", 2: "description", 3: "cost" }, skuPattern: "^[A-Z0-9]{6,20}$" };
  const b = { id: "b1", name: "VTC Core", data: { mapping } };
  assert.equal(mappingMatchesFile(mapping, vtcSheets), true);
  assert.equal(routeFile({ format: "vtc-eft", headerSig: "", sheets: vtcSheets }, [b]).target, "b1");
});

test("routeFile: nothing matches ⇒ null target, empty candidates", () => {
  const r = routeFile({ format: "generic", headerSig: "x", sheets: [{ name: "S", rows: [["Name"], ["Oak"]] }] }, []);
  assert.equal(r.target, null);
  assert.deepEqual(r.candidates, []);
});
```

(Confirm the `skuPattern`/`columns` shape against `parseMapped` in `pricebook.js` while wiring the test — adjust the fixture columns so `parseMapped` yields ≥1 item. The VTC header/`Item Code` etc. must also trip `detectVtcEft`: it needs `item code`, `vtc mfg`, and `dealer price` cells.)

- [ ] **Step 4: Run tests** — `npm test`. Expected: new pricebook + dropimport tests pass; 250 prior tests stay green.

- [ ] **Step 5: Commit**

```bash
git add src/pricebook.js src/pricebook.test.js src/dropimport.js src/dropimport.test.js
git commit -m "Add stock-workbook detection + multi-file drop routing helpers"
```

---

### Task 2: `BookImportWizard` accepts a pre-read file + emits a fingerprint

**Files:**
- Modify: `src/App.jsx` (`BookImportWizard` ~3954; import line ~8)

**Interfaces:**
- New optional prop `preParsed?: { sheets?, pages?, isPdf? }`. When present, the wizard skips its file chooser and ingests it on mount (the router already read the file once). When absent, behavior is identical to today (manual chooser).
- New optional prop `onClose` already exists; add `autoClose` semantics only through the router (no change to the manual path).
- `onApply(diff, opts)` gains `opts.fingerprint` (`{ format, headerSig }` from `computeFingerprint`) so the apply can stamp the book. Manual-path callers already pass `onApply`; the extra opts key is additive.

- [ ] **Step 1: Import the helpers** (App.jsx line ~8, from `./pricebook.js`)

Add `detectStockWorkbook`? No — only `computeFingerprint` is needed in the wizard, from `./dropimport.js`. Add a new import line near the other book imports:

```js
import { computeFingerprint } from "./dropimport.js";
```

- [ ] **Step 2: Extract an `ingest` core from `onFile`**

Refactor the wizard's `onFile` (~3976) so the parsing branches live in an `ingest({ file, sheets, pages, isPdf })` helper that both the chooser and the pre-read path call:

```js
  // Turn a file (or already-parsed sheets/pages from the multi-drop router) into
  // the wizard's sheet list + auto-mapping. Reads the file itself only when the
  // router hasn't already.
  const ingest = async ({ file, sheets: preSheets, pages: prePages, isPdf }) => {
    setReading(true); setErr("");
    try {
      if (isPdf || prePages) {
        const pages = prePages || (await readPdfPages(file));   // extract readPdfPages from today's inline PDF block
        const parsePdf = isManningtonCartons(pages) ? parseManningtonPages : parsePdfPages;
        const { name, rows, mapping } = parsePdf(pages, (file?.name || "book").replace(/\.pdf$/i, ""));
        setSheets([{ name, rows }]); applyDetected({ sheet: name, ...mapping });
        setReading(false); return;
      }
      const parsed = preSheets || (await readXlsxSheets(file));  // extract readXlsxSheets similarly
      setSheets(parsed);
      if (saved?.sheet && parsed.find((s) => s.name === saved.sheet)) applySheet(parsed.find((s) => s.name === saved.sheet));
      else { const detected = detectVtcEft(parsed); if (detected) applyDetected(detected); else applySheet(bestDataSheet(parsed)); }
    } catch (x) { setErr("Could not read that file — is it an .xlsx / .xls, or a text-based .pdf?"); }
    setReading(false);
  };
  const onFile = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) ingest({ file: f, isPdf: /\.pdf$/i.test(f.name) || f.type === "application/pdf" }); };
```

Pull the two readers out as module-level helpers (they already exist inline in `onFile`) so both the wizard and the router share them:

```js
async function readXlsxSheets(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) }));
}
async function readPdfPages(file) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vh = page.getViewport({ scale: 1 }).height;
    const content = await page.getTextContent();
    pages.push(content.items.filter((i) => i.str && i.str.trim()).map((i) => ({ str: i.str, x: i.transform[4], y: vh - i.transform[5], w: i.width })));
  }
  return pages;
}
```

(These are exact lifts of the current inline logic — verify the PDF pipe still recognizes Mannington by keeping the `isManningtonCartons(pages)` branch identical.)

- [ ] **Step 3: Auto-ingest a pre-read file on mount**

Add, after the state declarations:

```js
  useEffect(() => { if (preParsed && !sheets) ingest(preParsed); }, []);   // router hands in already-parsed sheets/pages
```

And when `preParsed` is present, hide the chooser: the `!sheets` branch already shows the chooser; while `reading` it shows "Reading…". A pre-read mount goes straight to `reading → preview`, so no chooser flashes.

- [ ] **Step 4: Stamp the fingerprint at apply**

At the Apply button (~4255), compute the fingerprint from the current sheets and pass it:

```js
  const fingerprint = sheet ? computeFingerprint({ sheets, isPdf: sheets?.length === 1 && !!sheets[0]?.fromPdf }) : null;
```

Simplify: the wizard already knows if it came from PDF (the PDF branch sets a single synthetic sheet). Track it with a `const [isPdf, setIsPdf] = useState(false)` set inside `ingest`, and compute `computeFingerprint({ sheets, pages: pdfPages, isPdf })`. Keep the parsed `pages` in a ref if needed for the fingerprint; simplest is to store `format` directly: in `ingest`, after parsing, `setFmt(fileFormat({ sheets/pages, isPdf }))` and build the fingerprint as `{ format: fmt, headerSig: computeFingerprint(...).headerSig }`. Pick whichever is cleanest when implementing; the only requirement is `opts.fingerprint = { format, headerSig }` reaches `onApply`.

Update the Apply onClick:

```jsx
onClick={() => { saveMapping(mapping); onApply(diff, { disableSkus, superseded: appliedSupersede, fingerprint }); }}
```

- [ ] **Step 5: Verify** — `npm test` (still 250+ green; no wizard unit tests) and `npm run build` (no errors). Manually confirm the manual per-book Import… path is unchanged (chooser still appears for a book opened in BookDetail).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "BookImportWizard: accept a pre-read file and emit an import fingerprint"
```

---

### Task 3: `applyBookImport` stamps the fingerprint; `importStockFile` wrapper

**Files:**
- Modify: `src/App.jsx` (`applyBookImport` ~1324; `importPriceBook` ~1178 → add `importStockFile`; `importPreview` state + the App-level stock preview modal ~3134 for the `onDone` hook)

**Interfaces:**
- `applyBookImport(bookId, diff, opts)` writes `data.importFingerprint` when `opts.fingerprint` is set (folded into the same `lastImport` dataPatch write — one round-trip). Disable-only applies (`!upserts.length`) still early-return without stamping.
- `importStockFile(file, onDone)` — reads+parses a File through today's `importPriceBook` logic and opens the existing stock preview; `onDone` is called by both Apply and Cancel so the router's queue can advance. Passed to `PriceBookLibrary` as a prop.

- [ ] **Step 1: Stamp the fingerprint in `applyBookImport`**

In the real-import branch (after the `if (!upserts.length)` early return), extend the `dataPatch`:

```js
    const dataPatch = { lastImport: li };
    if (opts.fingerprint?.format) dataPatch.importFingerprint = opts.fingerprint;
    await updateBook(bookId, { dataPatch });
```

- [ ] **Step 2: Refactor `importPriceBook` to share a core + add `importStockFile`**

Extract the read/parse/preview from `importPriceBook(e)` into `importStockFile(file, onDone)`; keep `importPriceBook(e)` as the thin event adapter (for the existing per-panel "Import shop workbook" button, which passes no `onDone`):

```js
  const importStockFile = async (file, onDone) => {
    if (!file) return;
    setImporting(true);
    try {
      const sheets = await readXlsxSheets(file);
      const { items, warnings } = parsePriceBook(sheets);
      if (!items.length) { ping("No stock items found in that file"); onDone?.(); }
      else {
        const parsed = items.map((it) => ({ ...it, active: true }));
        setImportPreview({ parsed, diff: diffStock(stock, parsed), warnings, sync: syncCatalogPrices(settings.catalog, parsed), onDone });
      }
    } catch (x) { ping("Could not read that file — is it the price book .xlsx?"); onDone?.(); }
    setImporting(false);
  };
  const importPriceBook = (e) => { const f = e.target.files?.[0]; e.target.value = ""; importStockFile(f); };
```

(`readXlsxSheets` is the module-level helper from Task 2. `importPriceBook`'s current body inlines the same XLSX read — replace it with the shared helper.)

- [ ] **Step 3: Fire `onDone` from the stock preview's Apply and Cancel**

In `applyImport` (~1217), after success/failure, call `importPreview.onDone?.()`. Because `applyImport` reads `importPreview` then nulls it, capture `onDone` first:

```js
  const applyImport = async () => {
    const { diff, sync, onDone } = importPreview;
    setImportPreview(null);
    try { /* …unchanged… */ } catch (x) { ping("Import failed — has supabase/stock.sql been run?"); }
    onDone?.();
  };
```

And in the App-level stock preview modal (~3134), the Cancel/close control must also call `onDone` before clearing: change its `onClose`/Cancel from `setImportPreview(null)` to `() => { importPreview.onDone?.(); setImportPreview(null); }`. (Grep the modal block for every `setImportPreview(null)` and route them through a local `closePreview` that fires `onDone` once.)

- [ ] **Step 4: Thread `importStockFile` to `PriceBookLibrary`**

Add `importStockFile={importStockFile}` to the `<PriceBookLibrary … />` render (~4713) and to the `PriceBookLibrary({ … })` param list (~3435). (The router uses it; the existing stock panel keeps using `importPriceBook`/`pbRef`.)

- [ ] **Step 5: Verify** — `npm test` + `npm run build`. Confirm the standalone "Import shop workbook" button still opens the stock preview and Apply/Cancel still work.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "applyBookImport stamps import fingerprint; add importStockFile(file,onDone) wrapper"
```

---

### Task 4: The drop area + `ImportRouter` (routing screen + sequential queue)

**Files:**
- Modify: `src/App.jsx` (`PriceBookLibrary` ~3435 — add the drop zone + `ImportRouter`; import `computeFingerprint`, `routeFile`, `fileFormat` from `./dropimport.js`, `readXlsxSheets`/`readPdfPages` are module-level)

**Interfaces:**
- `PriceBookLibrary` gains `importStockFile` (Task 3) and already has `books`, `applyBookImport`, `updateBook`, `loadBookItems`, `types`, `typeLabels`, `inp`, `lbl`, `hideCosts`.
- `ImportRouter` is a child component: reads each dropped file once → `{ file, isPdf, sheets, pages, error }`, computes `routeFile`, renders the routing table, then drives the queue. Registry steps render `BookImportWizard` with `preParsed`; the stock step calls `importStockFile(file, advance)`.

**Design notes:**
- The drop zone sits at the top of the library's right pane (above the per-book/stock content), always visible. Drag-over highlight + click-to-browse (a hidden multi-file `<input type="file" multiple>`). Accept `.xlsx,.xls,.pdf`.
- Single-file drop = a one-item queue (spec) — same routing screen, then straight into that file's preview.
- Reading is per-file and fault-isolated: a file that throws on read shows its error row and is skipped; the rest proceed (spec error handling).
- Queue advance: an index into the routed, non-skipped files. Registry file → load its book's items (`loadBookItems`) then render its wizard; on wizard close **or** apply, advance. Stock file → `importStockFile(file, advance)`. When the index passes the end, close the router.

- [ ] **Step 1: Drop zone UI + file intake in `PriceBookLibrary`**

Add state and a dashed drop zone rendered at the top of the right pane (before the `sel === "stock" ? …` block, inside the `flex-1 overflow-y-auto p-6` container, under the header row):

```jsx
  const [dropped, setDropped] = useState(null);   // File[] handed to the router, or null
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef(null);
  const onDrop = (e) => { e.preventDefault(); setDragOver(false); const fs = [...(e.dataTransfer?.files || [])].filter((f) => /\.(xlsx|xls|pdf)$/i.test(f.name)); if (fs.length) setDropped(fs); };
```

```jsx
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm ${dragOver ? "border-indigo-400 bg-indigo-50/60" : "border-slate-200 text-slate-500"}`}
        >
          <Upload size={18} className="inline mr-1.5 -mt-0.5 text-slate-400" />
          Drop vendor sheets or the shop workbook here — <button onClick={() => dropRef.current?.click()} className="underline text-indigo-600">browse…</button>
          <div className="text-[11px] text-slate-400 mt-1">.xlsx · .xls · .pdf — one or many. Each file routes to its book; unknown files ask.</div>
          <input ref={dropRef} type="file" accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple className="hidden" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ""; if (fs.length) setDropped(fs); }} />
        </div>
        {dropped && <ImportRouter files={dropped} books={books} applyBookImport={applyBookImport} updateBook={updateBook} loadBookItems={loadBookItems} importStockFile={importStockFile} onClose={() => setDropped(null)} types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={hideCosts} />}
```

- [ ] **Step 2: `ImportRouter` component** (new function beside `PriceBookLibrary`)

```jsx
// The multi-file drop router (PR C). Reads each dropped file once, routes it to a
// book (or the stock workbook), lets the user fix unmatched files, then steps
// through each file's normal import preview one at a time. Registry files reuse
// BookImportWizard (pre-read); the stock file reuses the App stock preview.
function ImportRouter({ files, books, applyBookImport, updateBook, loadBookItems, importStockFile, onClose, types, typeLabels, inp, lbl, hideCosts }) {
  const [rows, setRows] = useState(null);   // [{ file, isPdf, sheets, pages, error, target }]
  const [phase, setPhase] = useState("route"); // "route" | "run"
  const [qi, setQi] = useState(0);          // index into the runnable queue
  const [active, setActive] = useState(null); // { row, book, items } for the current registry step

  // Read + route every file once.
  useEffect(() => { let ok = true; (async () => {
    const out = [];
    for (const file of files) {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
      try {
        const parsed = isPdf ? { pages: await readPdfPages(file), isPdf: true } : { sheets: await readXlsxSheets(file) };
        const fp = computeFingerprint(parsed);
        const r = routeFile({ ...fp, sheets: parsed.sheets }, books.filter((b) => b.kind === "order" || b.kind === "stock"));
        out.push({ file, ...parsed, ...r });   // target, candidates, reason
      } catch (x) { out.push({ file, error: "Could not read this file" }); }
    }
    if (ok) setRows(out);
  })(); return () => { ok = false; }; }, []);

  const setTarget = (i, target) => setRows((rs) => rs.map((r, j) => j === i ? { ...r, target } : r));
  const runnable = (rows || []).filter((r) => !r.error && r.target && r.target !== "skip");

  // Advance the queue: stock rows go through the App stock preview; registry rows
  // load their book's items and render the wizard. When the queue empties, close.
  const advance = () => setQi((i) => i + 1);
  useEffect(() => {
    if (phase !== "run") return;
    if (qi >= runnable.length) { onClose(); return; }
    const row = runnable[qi];
    if (row.target === "stock") { setActive(null); importStockFile(row.file, advance); return; }
    let ok = true;
    loadBookItems(row.target).then((items) => { if (ok) setActive({ row, book: books.find((b) => b.id === row.target), items: items || [] }); });
    return () => { ok = false; };
  }, [phase, qi]);

  // Routing screen.
  if (phase === "route") {
    const bookOpts = [["skip", "Skip this file"], ["stock", "Shop workbook (stock)"], ...books.filter((b) => b.kind === "order" || b.kind === "stock").map((b) => [b.id, b.name || "Untitled"])];
    return (
      <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[60]" style={{ background: "rgba(20,15,10,.5)" }} onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 border border-slate-200" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3"><h3 className="ft-serif text-2xl">Route {files.length} file{files.length === 1 ? "" : "s"}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button></div>
          {rows == null ? <p className="text-sm text-slate-400 py-6 text-center">Reading files…</p> : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <FileText size={15} className="text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{r.file.name}</div>
                    <div className={`text-[11px] ${r.error ? "text-red-500" : r.target ? "text-slate-400" : "text-amber-600"}`}>{r.error || r.reason}</div>
                  </div>
                  {r.error ? <span className="text-[11px] text-red-500 shrink-0">Skipped</span> : (
                    <select className={`${inp} w-auto text-xs`} value={r.target || "skip"} onChange={(e) => setTarget(i, e.target.value)}>
                      {bookOpts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-between items-center pt-4">
            <button onClick={onClose} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
            <button onClick={() => { setQi(0); setPhase("run"); }} disabled={!runnable.length} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">Review {runnable.length} file{runnable.length === 1 ? "" : "s"} →</button>
          </div>
        </div>
      </div>
    );
  }

  // Run phase: the stock step is handled entirely by the App stock preview (a
  // separate modal); we render nothing until a registry step has its book+items.
  if (!active) return null;
  const stepNote = <div className="text-[11px] text-slate-400 mb-2">Reviewing {qi + 1} of {runnable.length} — {active.row.file.name}</div>;
  return (
    <BookImportWizard
      book={active.book} existingItems={active.items}
      preParsed={active.row.isPdf ? { pages: active.row.pages, isPdf: true } : { sheets: active.row.sheets }}
      onClose={advance}
      onApply={async (diff, opts) => { try { await applyBookImport(active.book.id, diff, opts); } catch (x) {} advance(); }}
      saveMapping={(m) => updateBook(active.book.id, { dataPatch: { mapping: m } })}
      types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={hideCosts} stepNote={stepNote}
    />
  );
}
```

- [ ] **Step 3: Show the "Reviewing N of M" note in the wizard**

Add an optional `stepNote` prop to `BookImportWizard` and render it just under the modal title (only when present). Small, non-invasive:

```jsx
  {stepNote}
```

placed right after the header `<div className="flex items-center justify-between mb-3">…</div>`.

- [ ] **Step 4: Icon imports**

Ensure `FileText` (and any other new lucide icon used) is imported at the top of App.jsx alongside the existing lucide imports. `Upload`, `X` are already imported.

- [ ] **Step 5: Verify build + tests** — `npm test` (250+ green) and `npm run build` (no errors). Fix any missing-import / prop-name mismatches surfaced by the build.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "Price book library: single multi-file drop area with routing + per-file queue"
```

---

### Task 5: Preview proof, docs, memory, PR

**Files:**
- Modify: `CLAUDE.md` (source-layout: note `dropimport.js`); memory
- No code

- [ ] **Step 1: Document `dropimport.js` in CLAUDE.md**

In the `src/` source-layout list, add a line for `dropimport.js` — "multi-file drop routing (ADR 0009 PR C): fingerprint + `routeFile` map each dropped file to its book (stock workbook by sheet signature, VTC/Mannington by format, others by saved mapping)". Also add a one-liner to the price-book library prose noting the library's drop area routes a mixed drop and reuses each book's normal preview.

- [ ] **Step 2: Preview proof (owner-driven drop)**

Start the dev server (`preview_start` name "dev"); ask the owner to sign in and open Settings → Price book. The session can't drive the OS file picker or drag-drop, so:
- Ask the owner to drop a VTC EFT `.xlsx` + a Mannington cartons `.pdf` + the shop stock workbook `.xlsx` in one drop.
- Screenshot the **routing screen**: three rows, each showing the detected target (VTC → its book, Mannington → its book or an amber "pick a book", stock → Shop workbook). Confirm an unmatched file shows the book dropdown.
- Advance into the queue; screenshot the first file's preview showing the "Reviewing 1 of 3" note and the PR B Problems/Superseded sections. **Do not Apply** against live data (read-only proof) unless the owner explicitly wants to.
- `read_console_messages` — no errors.

- [ ] **Step 3: Push + open the PR**

```bash
git push -u origin claude/pricebook-single-drop
gh pr create --title "Single multi-file drop area for the price book library (importer upgrades PR C)" --body-file <path>
```

PR body: what/why (link spec), the routing model (stock signature → VTC → Mannington → saved mapping; fingerprints improve matching with use), the owner decisions baked in (unmatched files ask; no create-from-file; stock workbook included), **no SQL required**, the routing + queue screenshots, and confirmation that 250+ tests pass and the build is clean.

- [ ] **Step 4: Update memory + report**

Update `importer-upgrades.md`: PR C open with its number, one-line of what shipped, the `dropimport.js` module + fingerprint note. Report to the owner: PR link, that it needs no SQL, what to verify after merge (drop several vendor files at once → each routes and imports through its own preview; an unknown file prompts a book pick).

---

## Self-review notes

- Spec coverage: drop zone + click-browse on `PriceBookLibrary` ✔; per-file detection stock/VTC/Mannington/saved-mapping in priority order (`fileFormat`/`routeFile`) ✔; routing screen with per-file book dropdown for unmatched/ambiguous ✔; "Reviewing N of M" sequential queue reusing each book's normal preview + PR B review ✔; stock workbook included via sheet signature → existing stock preview ✔; every apply is an existing per-book write + version snapshot (no new write semantics) ✔; fingerprint stamped per successful registry import to improve future matching ✔; single-file drop = one-item queue ✔; per-book Import… button untouched ✔.
- Error handling: unreadable file shows its row error + is skipped, queue proceeds ✔; fuzzy-RPC/`disabled` untouched (reuses PR A/B) ✔.
- No new write path: registry via `applyBookImport(bookId, diff, opts)` (fingerprint folded into the existing lastImport write); stock via `importStockFile` → existing `applyImport`. Disable-only early-return preserved.
- Reuse integrity: `BookImportWizard` manual path unchanged (chooser still appears in BookDetail); `readXlsxSheets`/`readPdfPages` are exact lifts so PDF/Mannington detection is byte-identical; stock preview modal reused with only an additive `onDone`.
- Purity/tests: detection + routing are pure and unit-tested (`dropimport.test.js`, a `detectStockWorkbook` case); App.jsx glue verified in the preview step. Verify the VTC fixture trips both `detectVtcEft` (needs item code/vtc mfg/dealer price) and `parseMapped` (≥1 item) while wiring Task 1's tests.
- Risk to watch: the stock step is driven by the App-level preview modal, not the wizard — its Cancel/Apply must both fire `onDone` or the queue stalls (Task 3 Step 3 routes every `setImportPreview(null)` through the onDone-firing close).

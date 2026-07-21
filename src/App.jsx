import { Fragment, lazy, Suspense, useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { Search, Plus, Trash2, Settings, Save, Printer, ClipboardList, FileText, X, History, Check, Paperclip, Menu, LogOut, ChevronRight, ChevronDown, ChevronUp, Hand, ListTodo, Phone, Mail, MapPin, Building2, StickyNote, MoreHorizontal, Lock, AlertTriangle, Copy, Zap, Folder, Clock, LayoutGrid } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { LIST_SELECT, lightRow, SHARED_SETTINGS_ID, loadProjects, loadPeople, loadBuilders, loadStock, loadTodos, loadLabels, loadBooks, loadSettingsRow, resolveSharedSettings } from "./bootload.js";
import { bootTrace, traceRows } from "./boottrace.js";
import { normLabel } from "./labels.js";
import { num, ceilQty, wasteFor, withProjWaste, normalizeSettings, withDerived, serializeSettings, groutExact, mortarExact, getGrout, getMortar, groutBaseList, cartonExact, getCarton, getPieceCarton, underlayExact, getUnderlay, getUnderlayInstall, materialWarnings, offeredGrouts, offeredMortars, offeredUnderlayments, resolveMaterialDefault, offeredAttached, offeredCategories, getAttached, attachedList } from "./catalog.js";
import { stockData, findStock, stockPatch, stockDrift, diffStock, syncCatalogPrices, stockCompanionBase, stockBaseVariant, groutFamilies, groutSnapshotPatch } from "./stock.js";
import { parsePriceBook } from "./pricebook.js";
import { normBookItem, pricedItem, orderPatch, orderDrift, specialOrderMargin, orderFloorFirst, rowCostSqft } from "./orderbook.js";
import { OrderEntryPanel } from "./orderentry.jsx";
import { normPrintPricing, tierView, tierUnitPrice, employeeNoCost, tierTag, normPricing } from "./pricing.js";
import { matchName } from "./names.js";
import { expand } from "./synonyms.js";
import { seedFromQuery as sheogaSeed } from "./sheoga.js";
import { STOCK_LOADING_MSG, STOCK_FAILED_MSG, skuSearchable, TYPES, TLBL, underlayLabel, TYPE_ACCENT, ROW_WASH, TOTAL_WASH, JOINTS, THICK, colorsFor, ATT_BUCKET, TIER_COLOR, tierBadgeText, AUTO_KEEP, QUICK_SWEEP_DAYS, STOCK_BOOK_ID } from "./uiconst.js";
import { uid, money, sf1, miscQty, blobToDataURL, dataURLToBlob, wasteNote, wasteMeta, newProduct, newArea, areaLabel, rowBlank, catSig, newProject, newPerson, newBuilder, normA, normC, personData } from "./model.js";
import { lineTotal, printProduct, orderLineCost, printAreaFloor, PRINT_COLS, PRINT_COLS_UNIT, PRINT_COLS_NONE, KSHORT, ESTIMATE_PRINT_LAYOUT, u1, printMatList, orderEntryRow } from "./print.js";
import { readXlsxSheets } from "./fileread.js";
import { LazyBoundary, FitSelect, BuilderCombo, MetaChip, SalespersonPop, SegBar, WasteBar, FilesPop, ThemeSwitch, MarginLine, Modal } from "./widgets.jsx";
import { SkuPicker, SKU_SHOW } from "./search.jsx";
import { TypeSelect, GRID_COLS, GridPriceCell, GridSizeInput, GridProductBox, GridOmniSearch } from "./grid.jsx";
import { MobileSheet, MobileProductRow, MobileRowSheet } from "./mobile.jsx";
import { TeamTodos } from "./TeamTodos.jsx";
import { useToast } from "./usetoast.js";
import { useBooks } from "./usebooks.js";
// Heavy secondary surfaces ship as their own chunks (ADR 0026 rule 5) so
// feature work on them stops growing the boot download. Both are conditional
// overlays; a null Suspense fallback reads as normal open latency.
const SheogaConfigurator = lazy(() => import("./SheogaConfigurator.jsx"));
const AppsWorkspace = lazy(() => import("./AppsWorkspace.jsx").then((m) => ({ default: m.AppsWorkspace })));
const SettingsWorkspace = lazy(() => import("./SettingsWorkspace.jsx"));

import NedMark from "./NedMark.jsx";
import NedLogo from "./NedLogo.jsx";
import keimLogo from "./assets/keim-logo-ink.png";

const PRINT_DASH = <span style={{ color: "var(--ft-faint)" }}>—</span>;

// ---- Kiln #14a grid input model ----------------------------------------
// The area editing surface is a spreadsheet grid (same 9 columns as the
// printed sheet, plus a slim utility column) over the exact same product
// state — every write still goes through updProduct/updArea.
const gridCell = { borderRight: "1px solid var(--ft-row-line)", minWidth: 0, display: "flex", alignItems: "center" };

// Below 768px each product row renders as two wrapping decks instead of the
// 9-column grid: Size + Product/Color on the first line, then self-labeled
// fields (SKU / Cov. / SF / Price / Order) that reflow when the screen runs
// out of width — a shared column header can't stay aligned once fields wrap,
// so each one carries its own label instead. Same state, same handlers as
// the desktop grid below — layout only.

// Enter in any grid cell moves to the same column one product row down
// (spreadsheet-style); on the last row it grows the area by one product.
function gridEnterNav(e, addRow) {
  if (e.key !== "Enter" || e.defaultPrevented || e.target.tagName === "SELECT") return;
  const col = e.target.getAttribute?.("data-c");
  const card = e.target.closest?.("[data-prod-card]");
  if (!col || !card) return;
  const cards = [...e.currentTarget.querySelectorAll("[data-prod-card]")];
  const i = cards.indexOf(card);
  const next = cards[i + 1]?.querySelector(`[data-c="${col}"]`);
  if (next) { e.preventDefault(); next.focus(); next.select?.(); }
  else if (i === cards.length - 1) { e.preventDefault(); addRow(); }
}

// Version metadata as held in memory — snapshots stay on the server until a
// restore actually needs one.
const vMeta = (r) => ({ id: r.id, label: r.label || "Version", auto: !!r.auto, savedAt: r.saved_at ? new Date(r.saved_at).getTime() : Date.now() });
const normProfile = (p) => ({ name: "", phone: "", email: "", ...(p || {}) });

export default function App({ user, onSignOut }) {
  const [data, setData] = useState(() => ({ projects: [], people: [], builders: [], settings: normalizeSettings() }));
  const [loading, setLoading] = useState(true);
  // selId = the open Project (drives the estimate pane). selCustId = the open
  // Customer (person) when no project is selected (drives the customer view).
  const [selId, setSelId] = useState(null);
  const [selCustId, setSelCustId] = useState(null);
  // Which customers are expanded in the sidebar tree.
  const [openCust, setOpenCust] = useState({});
  // Sidebar folder state: the "Customers" library folder, each age bucket
  // inside it, and the merged "Estimates & drafts" folder. All start collapsed
  // so only the pinned recents show until the user opens a folder.
  const [openLib, setOpenLib] = useState(false);
  const [openBuckets, setOpenBuckets] = useState({});
  const [openDrafts, setOpenDrafts] = useState(false);
  // The "New customer" modal: null when closed, else the draft name string.
  const [newCust, setNewCust] = useState(null);
  const [custModal, setCustModal] = useState(null); // customer id whose details box is open
  // "File under customer" (promote) flow: project id being filed, plus the
  // customer search/create term. null when the modal is closed (ADR 0022).
  const [promoteId, setPromoteId] = useState(null);
  const [promoteQ, setPromoteQ] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showSettings, setShowSettings] = useState(false);
  // Per-user profile (name/phone/email), printed on the estimate header.
  const [profile, setProfile] = useState(normProfile());
  // The rest of this user's app_data blob, kept so profile saves don't clobber
  // anything else stored there.
  const appBlobRef = useRef({});
  const [showVersions, setShowVersions] = useState(false);
  // Stock price book (ADR 0003): all active+retired items, loaded in the
  // background after first paint (ADR 0026 stage 2) — the SKU picker and drift
  // chips search this in memory. stockReady = the load attempt settled (so no
  // guard holds forever); stockFailed = it settled by FAILING, so the cache is
  // empty for the wrong reason and diff/snapshot writes must stay blocked.
  // Empty until the team has run supabase/stock.sql and imported the workbook.
  const [stock, setStock] = useState([]);
  const [stockReady, setStockReady] = useState(false);
  const [stockFailed, setStockFailed] = useState(false);
  // Grout color families from the book's Grout & Caulk sheet (ADR 0007) — read
  // at edit time only (color dropdowns, Settings linking), never at calc time.
  const gFamilies = useMemo(() => groutFamilies(stock), [stock]);
  // Team to-do / issue list (issue 006): shared rows, loaded in the background
  // after first paint for the sidebar badge and refreshed on every open.
  const [todos, setTodos] = useState([]);
  const [showTodos, setShowTodos] = useState(false);
  // Apps → Label Generator: saved showroom labels, shared team-wide (issue
  // label-generator-integration). Own table, loaded when the Apps hub opens
  // (ADR 0026) — nothing at boot reads it.
  const [labels, setLabels] = useState([]);
  const [showApps, setShowApps] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const pbRef = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const { toast, saveOk, ping, flashSaved } = useToast();
  const {
    books, hydrateBooks, orderItems, setOrderItems,
    loadBookItems, addBook, updateBook, delBook, applyBookImport,
    appliedFromDiff, snapshotBookVersion,
    loadBookVersions, loadBookVersionSnapshot, pinBookVersion,
    updateBookItem, reviewBookItemFlags, setBookItemsDisabled,
  } = useBooks({ user, profile, ping, flashSaved });
  // Which print layout the buttons chose; null (e.g. browser-menu Ctrl+P) prints the estimate.
  const [printMode, setPrintMode] = useState(null);
  useEffect(() => { if (!printMode) return; window.print(); setPrintMode(null); }, [printMode]);
  const [focusArea, setFocusArea] = useState(null);
  const [focusName, setFocusName] = useState(false);
  // Keyboard-flow focus targets (product id): after Add product, land on the
  // new row's type; after a SKU pick, land on the Sq Ft box (so the footage
  // still gets keyed) then Tab carries on to the materials; when that line
  // expands via Enter, land on its first checkbox.
  const [focusProd, setFocusProd] = useState(null);
  const [focusQty, setFocusQty] = useState(null);
  const [focusProdBox, setFocusProdBox] = useState(null); // after a row goes manual, land in its product box
  // Empty rows render as a price-book search; these hold the transient search
  // text and which rows the user has committed to manual entry this session.
  // Neither is persisted — a blank row simply re-opens as search on reload.
  const [manualRows, setManualRows] = useState({});
  const [omniQ, setOmniQ] = useState({});
  // Sheoga vendor configurator popup (issue 023), tied to the product row it
  // was opened from: { aid, pid, seed } — seed is the { mode, cfg } it opens on.
  const [sheogaPop, setSheogaPop] = useState(null);
  // Appearance: "system" | "light" | "dark", per-device (localStorage, not
  // Supabase). index.html applies the saved class pre-paint; this keeps <html>
  // in sync when the user changes it. "system" clears both classes and lets the
  // prefers-color-scheme block in index.css decide.
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("ft-theme") || "system"; } catch { return "system"; } });
  const themedOnce = useRef(false);
  useEffect(() => {
    try { localStorage.setItem("ft-theme", theme); } catch {}
    const el = document.documentElement;
    el.classList.remove("ned-dark", "ned-light");
    if (theme === "dark") el.classList.add("ned-dark");
    else if (theme === "light") el.classList.add("ned-light");
    // Crossfade the whole palette on a user toggle (but not the first paint):
    // .ft-theming briefly enables a color transition on everything, removed
    // once the fade is done so it never slows ordinary interaction.
    if (!themedOnce.current) { themedOnce.current = true; return; }
    el.classList.add("ft-theming");
    const t = setTimeout(() => el.classList.remove("ft-theming"), 600);
    return () => clearTimeout(t);
  }, [theme]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isWide, setIsWide] = useState(() => typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(min-width: 768px)").matches : true);
  const [namingVersion, setNamingVersion] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [custChip, setCustChip] = useState(null); // which contact chip is expanded (customer view)
  const [viewTab, setViewTab] = useState("edit"); // project detail: "edit" | "preview" (on-screen estimate paper)
  const [projSheet, setProjSheet] = useState(false); // mobile shell: project bottom sheet
  const [activeAreaId, setActiveAreaId] = useState(null); // mobile add bar: the + Product target area
  const [rowSheet, setRowSheet] = useState(null); // mobile rows: {aid, pid} with its editor sheet open
  const mobilePressAt = useRef(0); // rowSheet tap vs long-press-drag disambiguation
  // Internal materials-margin reveal (ADR 0011): ephemeral, default hidden, never
  // persisted, never printed. Resets when switching projects (customer-safe).
  const [showMargin, setShowMargin] = useState(false);
  // Copy-for-order-entry panel (special-order + stock, formatted for pasting
  // into the vendor order program). Ephemeral, read-only, never printed.
  const [showOrderCopy, setShowOrderCopy] = useState(false);
  useEffect(() => { setViewTab("edit"); setShowMargin(false); setShowOrderCopy(false); }, [selId]);
  // Active card drag: { pid, fromAid, to: { aid, index, y } | null }. The card
  // follows the pointer imperatively (no re-render per move); state only changes
  // when the drop target changes, to redraw the insertion bar / area highlight.
  const [drag, setDrag] = useState(null);
  const [insOpen, setInsOpen] = useState({});
  // Which product's materials drawer is open — view state only, never
  // persisted, and only one at a time: it opens as a modal that floats over the
  // rows below rather than pushing them down. A full-screen backdrop under the
  // drawer blocks every other field and folds the drawer when clicked (anywhere
  // outside the drawer or its note). Collapsed rows show fine-print summaries of
  // the checked materials. See the matExpanded overlay in the grid below.
  const [matOpen, setMatOpen] = useState({});
  const [confirmProd, setConfirmProd] = useState(null); // { aid, pid }
  const [confirmArea, setConfirmArea] = useState(null); // area id
  const mainRef = useRef(null);
  const fileRef = useRef(null);
  const attRef = useRef(null);
  const areaRefs = useRef({});
  const typeRefs = useRef({});
  const qtyRefs = useRef({});
  const prodRefs = useRef({});
  const nameRef = useRef(null);
  const addAreaRef = useRef(null);
  // Auto-version bookkeeping: { id, json } — the open customer's categories as
  // of open / last snapshot. dataRef mirrors state so the deselect effect and
  // sign-out handler compare against the latest edits, not a stale closure.
  const baselineRef = useRef(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const prevSelRef = useRef(null);

  // FLIP: slide the flooring-type labels (and product cards) to their new spots
  // when a render reorders them. Offset coords (not getBoundingClientRect) so
  // CSS transforms don't skew the distances; WAAPI so we don't clobber classes.
  // Chips measure relative to their card, otherwise a card that moves would
  // double-animate the chips inside it. A just-dropped card animates from where
  // the pointer released it (dropAnim) instead of from its old layout slot.
  const flipPos = useRef(new Map());
  const dropAnim = useRef(null);
  useLayoutEffect(() => {
    const prev = flipPos.current;
    const next = new Map();
    document.querySelectorAll("[data-flip]").forEach((el) => {
      const id = el.getAttribute("data-flip");
      const card = el.closest("[data-prod-card]");
      const base = card && card !== el ? { left: card.offsetLeft, top: card.offsetTop } : { left: 0, top: 0 };
      const pos = { left: el.offsetLeft - base.left, top: el.offsetTop - base.top };
      next.set(id, pos);
      if (el.dataset.dragging) return;
      const drop = dropAnim.current;
      if (drop && drop.id === id) {
        dropAnim.current = null;
        const r = el.getBoundingClientRect();
        el.animate([
          { transform: `translate(${drop.rect.left - r.left}px, ${drop.rect.top - r.top}px) scale(1.03)`, boxShadow: "0 14px 34px rgba(40,30,20,.22)" },
          { transform: "translate(0,0) scale(1)", boxShadow: "0 0 0 rgba(40,30,20,0)" },
        ], { duration: 280, easing: "cubic-bezier(.2,.8,.2,1)" });
        return;
      }
      const old = prev.get(id);
      if (old) {
        const dx = old.left - pos.left, dy = old.top - pos.top;
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0,0)" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
      }
    });
    flipPos.current = next;
  });

  useEffect(() => {
    (async () => {
      const trace = bootTrace();
      let coreOk = true;
      try {
        // Stage 1 (ADR 0026) — everything the first screen draws, one parallel
        // round trip. The legacy per-user blob is still read: to pick up any
        // customers awaiting migration, and as the seed fallback for the
        // shared settings (resolved after both land, below).
        const [blobRes, settingsRow, projectRows, people, builders] = await Promise.all([
          trace.span("app_data", () => supabase.from("app_data").select("data").eq("user_id", user.id).maybeSingle()),
          trace.span("shared_settings", () => loadSettingsRow(supabase)),
          trace.span("projects", () => loadProjects(supabase)),
          trace.span("people", () => loadPeople(supabase)),
          trace.span("builders", () => loadBuilders(supabase)),
        ]);
        const { data: row, error } = blobRes;
        if (error) throw error;
        // Customers and settings have both moved out of this blob (migrated
        // below / seeded into shared_settings), so drop them from the copy that
        // profile saves write back.
        appBlobRef.current = (({ customers, settings, ...rest }) => rest)(row?.data || {});
        setProfile(normProfile(row?.data?.profile));
        const settings = await resolveSharedSettings(supabase, settingsRow, row?.data?.settings);

        // One-time migration: move any customers still embedded in the blob into
        // the customers table (and relocate their attachment files), then strip
        // them from the blob. Idempotent — safe to run on every load. It inserts
        // projects rows, and the parallel list load above ran before those
        // existed — so re-fetch.
        let projects = projectRows;
        const legacy = row?.data?.customers;
        if (Array.isArray(legacy) && legacy.length) {
          await migrateLegacyCustomers(legacy.map(normC));
          projects = await trace.span("projects (post-migration)", () => loadProjects(supabase));
        }

        // Client-side 30-day sweep (ADR 0022): an unpromoted quick draft
        // (quick + still customer-less) untouched for QUICK_SWEEP_DAYS is
        // discarded on load. Best-effort deletes — a missed one just retries
        // next load; any orphaned attachment blobs are acceptable for throwaway
        // drafts. Swept rows are dropped from state so they never render.
        const sweepMs = QUICK_SWEEP_DAYS * 86400000;
        const now = Date.now();
        const swept = projects.filter((p) => p.quick && p.customerId == null && now - (p.updatedAt || p.createdAt || now) > sweepMs);
        const kept = swept.length ? projects.filter((p) => !swept.some((s) => s.id === p.id)) : projects;
        setData({ projects: kept, people, builders, settings });
        for (const p of swept) supabase.from("projects").delete().eq("id", p.id).then(() => {}, () => {});
      } catch (e) { coreOk = false; ping("Could not load your data — check connection"); }
      setLoading(false);
      trace.paint();

      // A failed core load must LOOK failed — populating the caches over an
      // app running on default settings and an empty project list would read
      // as "that ping was noise" and invite quoting against default rates.
      if (!coreOk) { setStockFailed(true); setStockReady(true); return; }

      // Stage 2 (ADR 0026) — bounded shared caches; nothing here blocks first
      // paint, and each cache applies the moment its OWN fetch lands (no
      // barrier: a slow price_books query must not hold the stock cache — or a
      // stale todos snapshot — hostage). Best-effort per load: an install that
      // hasn't run that table's SQL file just doesn't get the feature
      // (stock.sql → SKU picker, todos.sql → team list, pricebooks.sql →
      // registry affordances). Labels load when the Apps hub opens, not here.
      await Promise.allSettled([
        trace.span("stock", () => loadStock(supabase))
          .then((rows) => setStock(rows), () => setStockFailed(true))
          .finally(() => setStockReady(true)),
        trace.span("todos", () => loadTodos(supabase)).then(setTodos, () => { }),
        trace.span("books", () => loadBooks(supabase)).then(hydrateBooks, () => { }),
      ]);
      trace.done();
      // Production-readable trace so the ADR 0026 stage-2 trigger is observable
      // without a dev build; the console table stays dev-only.
      try { localStorage.setItem("ft-boot-trace", JSON.stringify(trace.report())); } catch (x) { }
      if (import.meta.env.DEV) console.table(traceRows(trace.report()));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Lazy-load one customer's full record on open, merging it into the light row.
  // Version metadata (never snapshots) loads alongside; snapshots are fetched
  // one at a time on restore.
  const loadDetail = async (id) => {
    const existing = data.projects.find((c) => c.id === id);
    if (!existing || existing._full) return;
    try {
      const [{ data: row, error }, { data: vRows, error: vErr }] = await Promise.all([
        supabase.from("projects").select("data").eq("id", id).maybeSingle(),
        supabase.from("versions").select("id, label, auto, saved_at").eq("customer_id", id).order("saved_at", { ascending: false }),
      ]);
      if (error) throw error;
      if (vErr) throw vErr;
      const full = normC(row?.data || {});
      let versions = (vRows || []).map(vMeta);
      // Safety net for a client deployed before the schema migration ran: lift
      // any versions still embedded in this blob into the table (idempotent);
      // custData strips them from the blob on the next content write.
      if (full.versions.length) {
        try {
          await supabase.from("versions").upsert(full.versions.map((v) => ({
            id: v.id || uid(), customer_id: id, label: v.label || "Version", auto: false,
            saved_at: new Date(v.savedAt || Date.now()).toISOString(), snapshot: v.snapshot || [],
          })), { onConflict: "id", ignoreDuplicates: true });
          const have = new Set(versions.map((v) => v.id));
          versions = [...versions, ...full.versions.filter((v) => !have.has(v.id)).map((v) => vMeta({ id: v.id, label: v.label, auto: false, saved_at: v.savedAt ? new Date(v.savedAt).toISOString() : null }))].sort((a, b) => b.savedAt - a.savedAt);
        } catch (x) { /* best-effort */ }
      }
      setData((prev) => ({
        ...prev,
        projects: prev.projects.map((c) => c.id === id
          ? { ...c, ...full, customerId: c.customerId, versions, id: c.id, createdAt: c.createdAt, _full: true }
          : c),
      }));
      baselineRef.current = { id, json: catSig(full.categories) };
    } catch (e) { ping("Could not open customer — check connection"); }
  };

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

  const migrateLegacyCustomers = async (legacy) => {
    for (const c of legacy) {
      // Move attachment files from <user_id>/<file_id> to <customer_id>/<file_id>.
      for (const m of (c.attachments || [])) {
        try {
          const { data: blob } = await supabase.storage.from(ATT_BUCKET).download(`${user.id}/${m.id}`);
          if (!blob) continue;
          await supabase.storage.from(ATT_BUCKET).upload(`${c.id}/${m.id}`, blob, { contentType: m.type, upsert: true });
          await supabase.storage.from(ATT_BUCKET).remove([`${user.id}/${m.id}`]);
        } catch (x) { /* best-effort */ }
      }
      const { ownerId, visibility, archived, customerId, ...rest } = c;
      // Late legacy-blob migration lands as an unassigned project (customer_id
      // null); the owner links it to a customer from the sidebar.
      await supabase.from("projects").upsert(
        { id: c.id, owner_id: user.id, data: rest, created_at: new Date(c.createdAt || Date.now()).toISOString() },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }
    // Drop the migrated array from the blob, keeping what still lives there
    // (the user's profile).
    await supabase.from("app_data").upsert({ user_id: user.id, data: appBlobRef.current }, { onConflict: "user_id" });
  };
  useEffect(() => { if (focusArea && areaRefs.current[focusArea]) { const el = areaRefs.current[focusArea]; el.focus(); el.select?.(); el.scrollIntoView?.({ behavior: "smooth", block: "center" }); setFocusArea(null); } }, [focusArea, data]);
  useEffect(() => { if (focusProd && typeRefs.current[focusProd]) { const el = typeRefs.current[focusProd]; el.focus(); el.scrollIntoView?.({ behavior: "smooth", block: "center" }); setFocusProd(null); } }, [focusProd, data]);
  useEffect(() => { if (focusQty && qtyRefs.current[focusQty]) { const el = qtyRefs.current[focusQty]; el.focus(); el.select?.(); el.scrollIntoView?.({ behavior: "smooth", block: "center" }); setFocusQty(null); } }, [focusQty, data]);
  useEffect(() => { if (focusProdBox && prodRefs.current[focusProdBox]) { const el = prodRefs.current[focusProdBox]; el.focus(); el.select?.(); setFocusProdBox(null); } }, [focusProdBox, data]);
  useEffect(() => { if (focusName && nameRef.current) { nameRef.current.focus(); nameRef.current.select?.(); const t = setTimeout(() => setFocusName(false), 1500); return () => clearTimeout(t); } }, [focusName]);
  useEffect(() => { const mq = window.matchMedia("(min-width: 768px)"); const on = () => setIsWide(mq.matches); on(); mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on); return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); }; }, []);

  // Server-side search (debounced): ask the backend which customers match and
  // merge any rows the client doesn't hold into the light list. The visible
  // filter stays a client-side substring test over loaded rows — instant while
  // typing, complete once the server responds — so search no longer depends on
  // every row having been loaded up front.
  useEffect(() => {
    const q = search.trim();
    if (!q) return;
    let stale = false;
    const t = setTimeout(async () => {
      try {
        // Strip characters that would break PostgREST's or=() syntax.
        const pat = "%" + q.replace(/[%_,()"\\]/g, " ").trim() + "%";
        const ors = ["name", "address", "phone", "email"].map((f) => `data->>${f}.ilike.${pat}`).join(",");
        const { data: rows, error } = await supabase.from("projects").select(LIST_SELECT).or(ors);
        if (error) throw error;
        if (stale) return;
        const found = (rows || []).map(lightRow);
        setData((prev) => {
          const have = new Set(prev.projects.map((c) => c.id));
          const fresh = found.filter((r) => !have.has(r.id));
          return fresh.length ? { ...prev, projects: [...prev.projects, ...fresh] } : prev;
        });
      } catch (e) { /* loaded rows still cover the search */ }
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [search]);

  // Strip the in-memory-only fields before writing to jsonb (versions live in
  // their own table; _full is load state; updatedAt mirrors the updated_at
  // column; ownerId/visibility/archived are legacy fields old records may carry).
  // customerId is the projects.customer_id column, not part of the data blob.
  const custData = ({ ownerId, visibility, archived, versions, _full, updatedAt, customerId, ...rest }) => rest;

  // Settings live in one shared record (ADR 0002) — last-write-wins across the
  // whole team, the same as a Public customer's data.
  const setSettings = (patch) => {
    const next = { ...data, settings: withDerived({ ...data.settings, ...patch }) };
    setData(next);
    (async () => { try { const { error } = await supabase.from("shared_settings").upsert({ id: SHARED_SETTINGS_ID, data: serializeSettings(next.settings) }, { onConflict: "id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };
  const saveProfile = (patch) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    appBlobRef.current = { ...appBlobRef.current, profile: next };
    (async () => { try { const { error } = await supabase.from("app_data").upsert({ user_id: user.id, data: appBlobRef.current }, { onConflict: "user_id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Couldn't save your info"); } })();
  };
  const settings = data.settings;
  const sel = data.projects.find((c) => c.id === selId) || null;
  const selCust = data.people.find((c) => c.id === selCustId) || null;
  const builderNameOf = (id) => data.builders.find((b) => b.id === id)?.name || "";
  const projectsOf = (customerId) => data.projects.filter((p) => p.customerId === customerId);
  const fmtAgo = (ts) => {
    if (!ts) return "";
    const d = Math.floor((Date.now() - ts) / 86400000);
    if (d <= 0) return "today";
    if (d === 1) return "yesterday";
    if (d < 7) return `${d} days ago`;
    if (d < 14) return "1 week ago";
    if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
    if (d < 60) return "1 month ago";
    if (d < 365) return `${Math.floor(d / 30)} months ago`;
    return new Date(ts).toLocaleDateString();
  };

  // Keep one trailing "adder" row (a fresh search row) at the end of every area
  // of the open project — the inline New-row affordance. An adder is a blank row
  // not yet handed to manual entry (same `searchMode` test the grid uses), so a
  // row that's blank-but-manual (e.g. a type was picked) still needs a new adder
  // after it. Local-only: the blank is ephemeral scaffolding — it persists to
  // the DB on the next real edit and is stripped from the estimate/exports
  // (rowBlank) and the version baseline (catSig), so it never shows up as data.
  // The guard reaches a fixed point (a fresh adder satisfies it), so no loop.
  const isAdderRow = (p) => rowBlank(p) && !manualRows[p.id];
  useEffect(() => {
    if (!sel || !sel._full) return;
    const needs = sel.categories.some((a) => !a.products.length || !isAdderRow(a.products[a.products.length - 1]));
    if (!needs) return;
    setData((prev) => ({
      ...prev,
      projects: prev.projects.map((c) => c.id !== sel.id ? c : {
        ...c,
        categories: c.categories.map((a) => (a.products.length && isAdderRow(a.products[a.products.length - 1])) ? a : { ...a, products: [...a.products, newProduct()] }),
      }),
    }));
  }, [sel?.id, sel?._full, sel?.categories, manualRows]);

  // Every project-content mutation goes through here: optimistic state update +
  // an UPDATE of that one row's data blob. customer_id is a column, moved via
  // linkProject — never through here.
  const updateProject = (id, patch) => {
    const next = { ...data, projects: data.projects.map((c) => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c) };
    setData(next);
    const cust = next.projects.find((c) => c.id === id);
    (async () => { try { const { error } = await supabase.from("projects").update({ data: custData(cust) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };

  const addProject = (customerId = null, name = "New Project", opts = {}) => {
    const c = { ...newProject(customerId, name, { ...opts, waste: settings.waste }), salesperson: { name: profile.name || "", phone: profile.phone || "", email: profile.email || "" }, updatedAt: Date.now(), _full: true };
    setData((prev) => ({ ...prev, projects: [c, ...prev.projects] }));
    baselineRef.current = { id: c.id, json: catSig(c.categories) };
    setSelId(c.id); setSelCustId(customerId); setSidebarOpen(false);
    // Quick prices land straight in product search (the seeded area's blank
    // adder row); named projects focus the name field as before.
    if (opts.quick) setFocusProd(c.categories[0]?.products[0]?.id); else setFocusName(true);
    (async () => { try { const { error } = await supabase.from("projects").insert({ id: c.id, owner_id: user.id, customer_id: customerId, data: custData(c), created_at: new Date(c.createdAt).toISOString() }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
    return c;
  };
  const startQuickPrice = () => addProject(null, "Quick price", { quick: true, seedArea: true });
  const pickProject = (id) => { const p = data.projects.find((c) => c.id === id); setSelId(id); if (p) setSelCustId(p.customerId || null); setSidebarOpen(false); loadDetail(id); };
  // Return to the landing screen from anywhere (the ned logo / mobile mark).
  // The open project is a real, autosaved row, so leaving never loses it — it
  // just deselects. The one exception: an untouched quick-price draft (all
  // rows still blank) is worthless, so discard it rather than let it linger the
  // 30 days until the sweep. Only ever deletes a `quick` + fully-blank draft.
  const goHome = () => {
    const cur = sel;
    setSelId(null); setSelCustId(null);
    if (cur && cur._full && cur.quick && cur.categories.every((a) => (a.products || []).every(rowBlank))) delProject(cur.id);
  };
  const delProject = async (id) => {
    const cust = data.projects.find((c) => c.id === id);
    if (cust) { for (const m of (cust.attachments || [])) { try { await supabase.storage.from(ATT_BUCKET).remove([attPath(id, m.id)]); } catch (x) { } } }
    setData((prev) => ({ ...prev, projects: prev.projects.filter((c) => c.id !== id) }));
    if (selId === id) setSelId(null);
    setConfirm(null);
    try { const { error } = await supabase.from("projects").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };
  // Move a project to a different customer (or unassign with null).
  // Dormant sanctioned write path (CLAUDE.md conventions); moves into useDirectory in phase 2.
  // eslint-disable-next-line no-unused-vars
  const linkProject = (id, customerId) => {
    setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === id ? { ...c, customerId: customerId || null, updatedAt: Date.now() } : c) }));
    (async () => { try { const { error } = await supabase.from("projects").update({ customer_id: customerId || null }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  // Promote a quick-price draft (or any unassigned job) into a normal job under
  // a customer (ADR 0022): set the customer_id column AND clear the quick flag
  // in the data blob in one write, so the pair never races (linkProject and
  // updateProject each own only their own field). custData needs the FULL
  // record — guard on _full so a light row is never serialized (that would wipe
  // its categories); promotion is only ever offered on the open project, which
  // is always full.
  const promoteProject = (id, customerId) => {
    const cur = data.projects.find((c) => c.id === id);
    if (!cur || !customerId) return;
    setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === id ? { ...c, customerId, quick: false, updatedAt: Date.now() } : c) }));
    (async () => {
      try {
        const upd = cur._full ? { customer_id: customerId, data: custData({ ...cur, customerId, quick: false }) } : { customer_id: customerId };
        const { error } = await supabase.from("projects").update(upd).eq("id", id);
        if (error) throw error; flashSaved();
      } catch (e) { ping("Save failed — check connection"); }
    })();
    setSelCustId(customerId);
    setPromoteId(null); setPromoteQ("");
  };
  // Create a customer and file the draft under it. The customer INSERT is
  // awaited before promoteProject's customer_id UPDATE so the FK
  // (projects.customer_id -> customers.id) is always satisfied — same ordering
  // as addBuilderFor. Optimistic add up front so the name shows instantly.
  const promoteToNewCustomer = async (id, name) => {
    const c = { ...newPerson(String(name || "").trim()), updatedAt: Date.now() };
    if (!c.name) return;
    setData((prev) => ({ ...prev, people: [c, ...prev.people] }));
    try {
      const { error } = await supabase.from("customers").insert({ id: c.id, owner_id: user.id, builder_id: null, data: personData(c), created_at: new Date(c.createdAt).toISOString() });
      if (error) throw error;
    } catch (x) { ping("Save failed — export a backup"); return; }
    promoteProject(id, c.id);
  };

  // --- Customers (people): the person/account that owns projects (ADR 0005). ---
  const addPerson = (name = "") => {
    const c = { ...newPerson(name), updatedAt: Date.now() };
    setData((prev) => ({ ...prev, people: [c, ...prev.people] }));
    setSidebarOpen(false);
    (async () => { try { const { error } = await supabase.from("customers").insert({ id: c.id, owner_id: user.id, builder_id: null, data: personData(c), created_at: new Date(c.createdAt).toISOString() }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/migrate-hierarchy.sql?"); } })();
    return c;
  };
  const updatePerson = (id, patch) => {
    // Functional update: setting a builder right after adding one (BuilderCombo)
    // must not clobber the freshly-added builder from a stale closure.
    setData((prev) => ({ ...prev, people: prev.people.map((c) => c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c) }));
    const merged = { ...(data.people.find((x) => x.id === id) || {}), ...patch };
    const upd = {};
    if ("builderId" in patch) upd.builder_id = patch.builderId || null;
    if (Object.keys(patch).some((k) => k !== "builderId")) upd.data = personData(merged);
    (async () => { try { const { error } = await supabase.from("customers").update(upd).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
  };
  const delPerson = async (id) => {
    // Projects survive — the FK nulls their customer_id (on delete set null), so
    // they resurface under "Unassigned" rather than being deleted.
    setData((prev) => ({ ...prev, people: prev.people.filter((c) => c.id !== id), projects: prev.projects.map((p) => p.customerId === id ? { ...p, customerId: null } : p) }));
    if (selCustId === id) setSelCustId(null);
    setConfirm(null);
    try { const { error } = await supabase.from("customers").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };

  // --- Builders: a canonical name list customers link to by id. ---
  // Create a new builder and assign it to a customer in one flow. The builder
  // INSERT is awaited before the customer's builder_id UPDATE so the FK
  // (customers.builder_id -> builders.id) is always satisfied.
  const addBuilderFor = async (personId, name) => {
    const b = newBuilder(String(name || "").trim());
    setData((prev) => ({ ...prev, builders: [...prev.builders, b], people: prev.people.map((c) => c.id === personId ? { ...c, builderId: b.id, updatedAt: Date.now() } : c) }));
    try {
      const { error: be } = await supabase.from("builders").insert({ id: b.id, owner_id: user.id, name: b.name });
      if (be) throw be;
      const { error: ce } = await supabase.from("customers").update({ builder_id: b.id }).eq("id", personId);
      if (ce) throw ce;
      flashSaved();
    } catch (e) { ping("Save failed — run supabase/migrate-hierarchy.sql?"); }
    return b;
  };
  const addArea = () => { const a = newArea(); updateProject(sel.id, { categories: [...sel.categories, a] }); setFocusArea(a.id); };
  const tabTo = (ref) => (e) => { if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); ref.current?.focus(); ref.current?.select?.(); } };
  const updArea = (aid, patch) => updateProject(sel.id, { categories: sel.categories.map((a) => a.id === aid ? { ...a, ...patch } : a) });
  const delArea = (aid) => updateProject(sel.id, { categories: sel.categories.filter((a) => a.id !== aid) });
  const addProduct = (aid) => { const a = sel.categories.find((x) => x.id === aid); const np = newProduct(); updArea(aid, { products: [...a.products, np] }); setFocusProd(np.id); };
  const updProduct = (aid, pid, patch) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: a.products.map((p) => p.id === pid ? { ...p, ...patch } : p) }); };
  // Mobile add bar (mobile shell 2026-07-16): + Product targets the area in
  // view — tracked on scroll with the anchor 30% down the viewport (v2 mockup
  // spec); tapping inside an area also claims it (onClickCapture on the card,
  // which child stopPropagation can't suppress).
  useEffect(() => {
    if (isWide || !sel?._full || viewTab !== "edit") return;
    const el = mainRef.current; if (!el) return;
    const pick = () => {
      const nodes = el.querySelectorAll("[data-area-drop]");
      if (!nodes.length) return setActiveAreaId(null);
      const anchor = el.getBoundingClientRect().top + el.clientHeight * 0.3;
      let cur = nodes[0];
      nodes.forEach((n) => { if (n.getBoundingClientRect().top <= anchor) cur = n; });
      setActiveAreaId(cur.getAttribute("data-area-drop"));
    };
    pick();
    el.addEventListener("scroll", pick, { passive: true });
    return () => el.removeEventListener("scroll", pick);
  }, [isWide, viewTab, sel?.id, sel?._full, sel?.categories?.length]);
  // Every area keeps a trailing blank adder row — reuse it instead of stacking
  // another blank when the add bar's + Product is tapped. The blank adder is
  // hidden from the phone list (mobile rows 2026-07-17), so + Product opens
  // its editor sheet directly, ready to search or fill.
  const mobileAddProduct = () => {
    if (!sel?._full) return;
    const aid = sel.categories.some((a) => a.id === activeAreaId) ? activeAreaId : sel.categories[0]?.id;
    if (!aid) return addArea();
    const a = sel.categories.find((x) => x.id === aid);
    const last = a.products[a.products.length - 1];
    if (last && rowBlank(last)) setRowSheet({ aid, pid: last.id });
    else {
      const np = newProduct();
      updArea(aid, { products: [...a.products, np] });
      setRowSheet({ aid, pid: np.id });
    }
  };
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
  // Pick from the SKU dropdown: the first item fills the anchor row, each
  // further item becomes its own new product row right below it. A Laticrete
  // pigment (Spectralock Part C, Permacolor Color Kit) drags its default base
  // unit along as an extra row, since neither is usable without the other.
  // The snapshot patch for a picked item: a special-order item (bookId set)
  // goes through orderPatch — which prices it by its book's markup and carries
  // the order provenance (cost/markupPct/freight/tier) — while a stock item
  // keeps the stock path. One sanctioned pick path for both spaces (ADR 0009).
  const patchFor = (it, p) => it.bookId ? orderPatch(it, books.find((b) => b.id === it.bookId), p) : stockPatch(it, p);
  const addStockProducts = (aid, pid, items) => {
    if (!items.length) return;
    // Only stock items carry a companion base unit (Laticrete pigment → base).
    const expanded = items.flatMap((it) => { const base = it.bookId ? null : stockCompanionBase(it, stock); return base ? [it, base] : [it]; });
    const a = sel.categories.find((x) => x.id === aid);
    const products = a.products.flatMap((p) => p.id !== pid ? [p] : [
      { ...p, ...patchFor(expanded[0], p) },
      ...expanded.slice(1).map((it) => { const np = newProduct(); return { ...np, ...patchFor(it, np) }; }),
    ]);
    updArea(aid, { products });
  };
  // Append moved Sheoga lines as new product rows at the end of an area — used
  // by basket "Move", which must apply lines AND clear the basket in ONE
  // updateProject (two calls would clobber via the non-functional setter).
  const appendSheogaLines = (categories, aid, lines) => categories.map((a) =>
    a.id === aid ? { ...a, products: [...a.products, ...lines.map((patch) => ({ ...newProduct(), ...patch }))] } : a);
  // Sheoga configurator add (issue 023): the main line fills the row the popup
  // was opened from and each vendor-fee line lands as its own new row after it,
  // mirroring addStockProducts. Payloads come from sheoga.js lineItems() —
  // snapshot rule, nothing reprices later.
  const addSheogaLines = (aid, pid, lines) => {
    if (!lines.length) return;
    const a = sel.categories.find((x) => x.id === aid);
    if (!a || !a.products.some((p) => p.id === pid)) return;
    const products = a.products.flatMap((p) => p.id !== pid ? [p] : [
      { ...p, ...lines[0] },
      ...lines.slice(1).map((patch) => ({ ...newProduct(), ...patch })),
    ]);
    updArea(aid, { products });
  };
  // Sheoga opened from the Apps hub has no row/project context. Its lines drop
  // into the first area of whichever project the salesperson picks in the
  // Apps-hub destination prompt (filling a blank adder row if there is one, else
  // appending). A blank adder row is the trailing empty row every area carries.
  const applySheogaToFirstArea = (categories, lines) => {
    const cats = categories.length ? categories : [newArea()];
    return cats.map((cat, i) => {
      if (i !== 0) return cat;
      const blank = cat.products.find(rowBlank);
      if (blank) return { ...cat, products: cat.products.flatMap((p) => p.id !== blank.id ? [p] : [{ ...p, ...lines[0] }, ...lines.slice(1).map((patch) => ({ ...newProduct(), ...patch }))]) };
      return { ...cat, products: [...cat.products, ...lines.map((patch) => ({ ...newProduct(), ...patch }))] };
    });
  };
  // "New quick price" from that prompt: build the unnamed draft with the lines
  // already in it and insert ONCE — applying the lines via updateProject after
  // creation would hit the stale-`data` closure and silently drop them.
  const createQuickWithSheoga = (lines) => {
    const c = { ...newProject(null, "Quick price", { quick: true, seedArea: true, waste: settings.waste }), salesperson: { name: profile.name || "", phone: profile.phone || "", email: profile.email || "" }, updatedAt: Date.now(), _full: true };
    c.categories = applySheogaToFirstArea(c.categories, lines);
    setData((prev) => ({ ...prev, projects: [c, ...prev.projects] }));
    baselineRef.current = { id: c.id, json: catSig(c.categories) };
    setSelId(c.id); setSelCustId(null); setSidebarOpen(false);
    (async () => { try { const { error } = await supabase.from("projects").insert({ id: c.id, owner_id: user.id, customer_id: null, data: custData(c), created_at: new Date(c.createdAt).toISOString() }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — export a backup"); } })();
    return c;
  };
  const delProduct = (aid, pid) => { const a = sel.categories.find((x) => x.id === aid); updArea(aid, { products: a.products.filter((p) => p.id !== pid) }); };
  const moveProduct = (fromAid, pid, toAid, toIndex) => {
    const p = sel.categories.find((x) => x.id === fromAid)?.products.find((x) => x.id === pid);
    if (!p) return;
    updateProject(sel.id, { categories: sel.categories.map((a) => {
      if (a.id !== fromAid && a.id !== toAid) return a;
      let products = a.id === fromAid ? a.products.filter((x) => x.id !== pid) : a.products;
      if (a.id === toAid) { products = [...products]; products.splice(toIndex, 0, p); }
      return { ...a, products };
    }) });
  };

  // Pointer-driven drag of a product card (mouse + touch via pointer events).
  // A short hold arms the drag, so brushing the handle doesn't yank the card;
  // lifting or slipping more than a few pixels during the hold cancels it.
  // The grabbed card pops out and tracks the pointer via CSS `translate`; drop
  // targets are hit-tested with elementFromPoint (the card is pointer-events:
  // none while held). Data is written once, on drop, through moveProduct.
  const startDrag = (e, aid, p, pi, holdMs = 220) => {
    if (e.button != null && e.button !== 0) return;
    const node = e.currentTarget.closest("[data-prod-card]");
    const main = mainRef.current;
    if (!node || !main) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const last = { ...start };
    const abort = () => { clearTimeout(timer); window.removeEventListener("pointermove", onHoldMove); window.removeEventListener("pointerup", abort); window.removeEventListener("pointercancel", abort); };
    const onHoldMove = (ev) => { last.x = ev.clientX; last.y = ev.clientY; if (Math.hypot(last.x - start.x, last.y - start.y) > 6) abort(); };
    const timer = setTimeout(() => { abort(); beginDrag(node, main, last.x, last.y, aid, p, pi); }, holdMs);
    window.addEventListener("pointermove", onHoldMove);
    window.addEventListener("pointerup", abort);
    window.addEventListener("pointercancel", abort);
  };
  const beginDrag = (node, main, startX, startY, aid, p, pi) => {
    const d = { startX, startY, lastX: startX, lastY: startY, startScroll: main.scrollTop, to: null, raf: 0 };
    node.dataset.dragging = "1";
    Object.assign(node.style, { position: "relative", zIndex: 50, pointerEvents: "none", transition: "scale .18s ease, rotate .18s ease, box-shadow .18s ease", scale: "1.03", rotate: "0.6deg", boxShadow: "0 0 0 1px rgba(40,30,20,.10), 0 6px 14px rgba(40,30,20,.16), 0 18px 44px rgba(40,30,20,.28)", borderRadius: "8px", overflow: "hidden", willChange: "translate" });
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    // Add the scroll delta so the card stays glued to the pointer while the
    // main pane auto-scrolls underneath it.
    const applyPos = () => { node.style.translate = `${d.lastX - d.startX}px ${d.lastY - d.startY + (main.scrollTop - d.startScroll)}px`; };
    const setTo = (to) => {
      if (!to && !d.to) return;
      if (to && d.to && to.aid === d.to.aid && to.index === d.to.index) return;
      d.to = to;
      setDrag((prev) => (prev ? { ...prev, to } : prev));
    };
    const hitTest = () => {
      const el = document.elementFromPoint(d.lastX, d.lastY);
      const areaEl = el && el.closest ? el.closest("[data-area-drop]") : null;
      const list = areaEl && areaEl.querySelector("[data-prod-list]");
      if (!list) return setTo(null);
      const taid = areaEl.getAttribute("data-area-drop");
      const cards = [...list.querySelectorAll("[data-prod-card]")].filter((c) => c !== node);
      let index = 0;
      for (const c of cards) { const r = c.getBoundingClientRect(); if (d.lastY > r.top + r.height / 2) index++; }
      // Dropping back where it came from is a no-op — show no target.
      if (taid === aid && index === pi) return setTo(null);
      const lr = list.getBoundingClientRect();
      const y = cards.length === 0 ? 0 : index < cards.length ? cards[index].getBoundingClientRect().top - lr.top - 9 : cards[cards.length - 1].getBoundingClientRect().bottom - lr.top + 3;
      setTo({ aid: taid, index, y });
    };
    const onMove = (ev) => { d.lastX = ev.clientX; d.lastY = ev.clientY; applyPos(); hitTest(); };
    const loop = () => {
      const r = main.getBoundingClientRect(); const zone = 70; let dy = 0;
      if (d.lastY < r.top + zone) dy = -Math.min(18, (r.top + zone - d.lastY) / 3);
      else if (d.lastY > r.bottom - zone) dy = Math.min(18, (d.lastY - (r.bottom - zone)) / 3);
      if (dy) { main.scrollTop += dy; applyPos(); hitTest(); }
      d.raf = requestAnimationFrame(loop);
    };
    d.raf = requestAnimationFrame(loop);
    // Once the card has popped out, claim the touch gesture — otherwise the
    // browser starts scrolling on the first finger move and fires
    // pointercancel, killing the drag (surfaces without touch-action:none,
    // e.g. long-press on the row itself).
    const stopTouchScroll = (ev) => ev.preventDefault();
    window.addEventListener("touchmove", stopTouchScroll, { passive: false });
    const finish = (commit) => {
      cancelAnimationFrame(d.raf);
      window.removeEventListener("touchmove", stopTouchScroll);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      const rect = node.getBoundingClientRect();
      delete node.dataset.dragging;
      Object.assign(node.style, { position: "", zIndex: "", pointerEvents: "", transition: "", scale: "", rotate: "", boxShadow: "", borderRadius: "", overflow: "", willChange: "", translate: "" });
      dropAnim.current = { id: p.id, rect };
      if (commit && d.to) moveProduct(aid, p.id, d.to.aid, d.to.index);
      setDrag(null);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev) => { if (ev.key === "Escape") finish(false); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    setDrag({ pid: p.id, fromAid: aid, to: null });
  };

  const attPath = (custId, fileId) => `${custId}/${fileId}`;
  const addAttachment = async (e) => { const f = e.target.files?.[0]; if (!f) return; const id = uid(); try { const { error } = await supabase.storage.from(ATT_BUCKET).upload(attPath(sel.id, id), f, { contentType: f.type, upsert: true }); if (error) throw error; updateProject(sel.id, { attachments: [...(sel.attachments || []), { id, name: f.name, type: f.type, size: f.size }] }); ping("Attachment added"); } catch (x) { ping("Upload failed — file may be too large"); } e.target.value = ""; };
  const openAttachment = async (m) => { try { const { data: blob, error } = await supabase.storage.from(ATT_BUCKET).download(attPath(sel.id, m.id)); if (error) throw error; const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = m.name; a.click(); URL.revokeObjectURL(u); } catch (x) { ping("Could not load attachment"); } };
  const delAttachment = async (m) => { try { await supabase.storage.from(ATT_BUCKET).remove([attPath(sel.id, m.id)]); } catch (x) { } updateProject(sel.id, { attachments: (sel.attachments || []).filter((x) => x.id !== m.id) }); };

  // Versions are their own rows (issue 003) — saving/deleting one never touches
  // the customer's data blob. In memory a customer carries version metadata
  // only; the snapshot is fetched when a restore needs it.
  const insertVersion = async (custId, label, auto, categories) => {
    const v = { id: uid(), label, auto, savedAt: Date.now() };
    const { error } = await supabase.from("versions").insert({ id: v.id, customer_id: custId, label, auto, saved_at: new Date(v.savedAt).toISOString(), snapshot: categories });
    if (error) throw error;
    return v;
  };
  const namedCount = (c) => (c.versions || []).filter((v) => !v.auto).length;
  const startVersionName = () => { setVersionName(`Version ${namedCount(sel) + 1}`); setNamingVersion(true); };
  const confirmVersion = async () => {
    const label = versionName.trim() || `Version ${namedCount(sel) + 1}`;
    const cust = sel;
    setNamingVersion(false); setVersionName("");
    try {
      const v = await insertVersion(cust.id, label, false, cust.categories);
      setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === cust.id ? { ...c, versions: [v, ...(c.versions || [])] } : c) }));
      baselineRef.current = { id: cust.id, json: catSig(cust.categories) };
      flashSaved(); ping("Version saved");
    } catch (e) { ping("Save failed — check connection"); }
  };
  const loadVersion = async (v) => {
    try {
      const { data: row, error } = await supabase.from("versions").select("snapshot").eq("id", v.id).maybeSingle();
      if (error || !row) throw error || new Error("missing");
      updateProject(sel.id, { categories: (Array.isArray(row.snapshot) ? row.snapshot : []).map(normA) });
      setShowVersions(false); ping("Version loaded");
    } catch (e) { ping("Could not load version — check connection"); }
  };
  const delVersion = async (vid) => {
    setData((prev) => ({ ...prev, projects: prev.projects.map((c) => c.id === sel.id ? { ...c, versions: (c.versions || []).filter((v) => v.id !== vid) } : c) }));
    try { const { error } = await supabase.from("versions").delete().eq("id", vid); if (error) throw error; } catch (e) { ping("Delete failed"); }
  };

  // The safety net: when a work session on a customer ends (they get deselected,
  // or the user signs out) and the selections changed since open / last
  // snapshot, save an automatic version. Autos beyond the newest AUTO_KEEP are
  // pruned; named versions are never touched. Baseline advances only on a
  // successful save so a failed attempt is retried at the next deselect.
  const autoSnapshot = async (id) => {
    const c = dataRef.current.projects.find((x) => x.id === id);
    const base = baselineRef.current;
    if (!c || !c._full || !base || base.id !== id) return;
    // Quick-price drafts are throwaway until promoted — don't spawn version rows.
    if (c.quick) return;
    const json = catSig(c.categories);
    if (json === base.json) return;
    const label = "Auto — " + new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    try {
      const v = await insertVersion(id, label, true, c.categories);
      baselineRef.current = { id, json };
      const drop = [v, ...(c.versions || []).filter((x) => x.auto)].sort((a, b) => b.savedAt - a.savedAt).slice(AUTO_KEEP).map((x) => x.id);
      setData((prev) => ({ ...prev, projects: prev.projects.map((x) => x.id === id ? { ...x, versions: [v, ...(x.versions || [])].filter((vv) => !drop.includes(vv.id)) } : x) }));
      if (drop.length) await supabase.from("versions").delete().in("id", drop);
    } catch (e) { /* best-effort — the live data is already saved */ }
  };
  useEffect(() => {
    const prev = prevSelRef.current;
    prevSelRef.current = selId;
    if (prev && prev !== selId) autoSnapshot(prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);
  const handleSignOut = async () => { await autoSnapshot(selId); onSignOut(); };

  // Team to-do / issue list (issue 006): every item is its own shared row.
  // Open items order by `position` (smaller = higher); a drag renumbers all
  // open items 0..n-1 and writes them in one upsert. Done items keep their row
  // and sort by completion time instead.
  const todoData = (t) => ({ text: t.text, done: t.done, doneAt: t.doneAt, createdBy: t.createdBy, createdAt: t.createdAt });
  const openTodos = () => {
    setShowTodos(true); setSidebarOpen(false);
    // Refresh so the list shows what teammates added since load.
    loadTodos(supabase).then(setTodos).catch(() => { });
  };
  const addTodo = (text) => {
    const top = Math.min(0, ...todos.filter((t) => !t.done).map((t) => t.position));
    const t = { id: uid(), position: top - 1, text, done: false, doneAt: null, createdBy: profile.name || user.email || "", createdAt: Date.now() };
    setTodos((prev) => [t, ...prev]);
    (async () => { try { const { error } = await supabase.from("todos").insert({ id: t.id, position: t.position, data: todoData(t) }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/todos.sql?"); } })();
  };
  const updateTodo = (id, patch) => {
    const next = todos.map((t) => t.id === id ? { ...t, ...patch } : t);
    setTodos(next);
    const t = next.find((x) => x.id === id);
    (async () => { try { const { error } = await supabase.from("todos").update({ position: t.position, data: todoData(t) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  const toggleTodo = (id) => {
    const t = todos.find((x) => x.id === id);
    if (!t) return;
    // Reopening puts the item back on top so it gets looked at again.
    updateTodo(id, t.done
      ? { done: false, doneAt: null, position: Math.min(0, ...todos.filter((x) => !x.done).map((x) => x.position)) - 1 }
      : { done: true, doneAt: Date.now() });
  };
  const delTodo = (id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    (async () => { try { const { error } = await supabase.from("todos").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  const clearDoneTodos = () => {
    const ids = todos.filter((t) => t.done).map((t) => t.id);
    if (!ids.length) return;
    setTodos((prev) => prev.filter((t) => !t.done));
    (async () => { try { const { error } = await supabase.from("todos").delete().in("id", ids); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  // `from`/`to` index into the open list; `to` counts positions with the moved
  // item already lifted out (same convention as moveProduct).
  const reorderTodos = (from, to) => {
    const open = todos.filter((t) => !t.done).sort((a, b) => a.position - b.position);
    const [moved] = open.splice(from, 1);
    if (!moved) return;
    open.splice(to, 0, moved);
    const pos = new Map(open.map((t, i) => [t.id, i]));
    const next = todos.map((t) => pos.has(t.id) ? { ...t, position: pos.get(t.id) } : t);
    setTodos(next);
    const rows = next.filter((t) => pos.has(t.id)).map((t) => ({ id: t.id, position: t.position, data: todoData(t) }));
    (async () => { try { const { error } = await supabase.from("todos").upsert(rows, { onConflict: "id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };

  // Labels write path (Apps → Label Generator). Mirrors the todos helpers; the
  // paged loader lives in bootload.js.
  const labelData = (l) => ({ presetId: l.presetId, w: l.w, h: l.h, header: l.header, lines: l.lines, fields: l.fields, twoVariant: l.twoVariant, fields2: l.fields2, sku: l.sku, createdBy: l.createdBy, createdAt: l.createdAt });
  // The refresh merges instead of replacing: an optimistic add made before the
  // fetch resolves (its select predates the insert) must not vanish from view.
  const openApps = () => {
    setShowApps(true); setSidebarOpen(false);
    loadLabels(supabase).then((rows) => setLabels((prev) => {
      const have = new Set(rows.map((l) => l.id));
      return [...rows, ...prev.filter((l) => !have.has(l.id))];
    })).catch(() => { });
  };
  const nextPos = () => (labels.length ? Math.max(...labels.map((l) => l.position)) + 1 : 0);
  const addLabel = (draft) => {
    const l = normLabel({ ...draft, id: uid(), position: nextPos(), createdBy: profile.name || user.email || "", createdAt: Date.now() });
    setLabels((prev) => [...prev, l]);
    (async () => { try { const { error } = await supabase.from("labels").insert({ id: l.id, position: l.position, data: labelData(l) }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/labels.sql?"); } })();
    return l;
  };
  const addLabelsBulk = (drafts) => {
    let pos = nextPos();
    const made = drafts.map((d) => normLabel({ ...d, id: uid(), position: pos++, createdBy: profile.name || user.email || "", createdAt: Date.now() }));
    setLabels((prev) => [...prev, ...made]);
    (async () => { try { const { error } = await supabase.from("labels").insert(made.map((l) => ({ id: l.id, position: l.position, data: labelData(l) }))); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/labels.sql?"); } })();
  };
  const updateLabel = (id, patch) => {
    const next = labels.map((l) => l.id === id ? normLabel({ ...l, ...patch }) : l);
    setLabels(next);
    const l = next.find((x) => x.id === id);
    (async () => { try { const { error } = await supabase.from("labels").update({ position: l.position, data: labelData(l) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  const delLabel = (id) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    (async () => { try { const { error } = await supabase.from("labels").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  // Custom size presets live in shared settings; setSettings persists them
  // (serializeSettings keeps only non-built-in presets).
  const saveLabelPreset = (preset) => {
    const cur = settings.apps?.labels?.presets || [];
    const presets = [...cur.filter((p) => p.id !== preset.id), preset];
    setSettings({ ...settings, apps: { ...settings.apps, labels: { presets } } });
  };

  const dl = (blob, name) => { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); };
  const exportBackup = async () => {
    // Pull every full project + all people + builders. Versions come from their
    // own table and are re-embedded per project (the file keeps the pre-table
    // snapshot shape). Format v2 uses projects/people/builders; a v1 file (just
    // `customers`) still restores — see importBackup.
    let projects, people, builders;
    try {
      const [{ data: rows, error }, { data: vRows, error: vErr }, { data: pplRows }, { data: bRows }] = await Promise.all([
        supabase.from("projects").select("id, customer_id, data, created_at"),
        supabase.from("versions").select("id, customer_id, label, auto, saved_at, snapshot"),
        supabase.from("customers").select("id, builder_id, data, created_at"),
        supabase.from("builders").select("id, name"),
      ]);
      if (error) throw error;
      if (vErr) throw vErr;
      const byCust = {};
      (vRows || []).forEach((r) => { (byCust[r.customer_id] = byCust[r.customer_id] || []).push({ id: r.id, label: r.label, auto: !!r.auto, savedAt: r.saved_at ? new Date(r.saved_at).getTime() : Date.now(), snapshot: r.snapshot || [] }); });
      projects = (rows || []).map((r) => {
        const c = { ...normC(r.data || {}), id: r.id, customerId: r.customer_id ?? null };
        const table = (byCust[r.id] || []).sort((a, b) => b.savedAt - a.savedAt);
        return { ...c, versions: table.length ? table : c.versions };
      });
      people = (pplRows || []).map((r) => ({ id: r.id, builderId: r.builder_id ?? null, ...(r.data || {}), createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now() }));
      builders = (bRows || []).map((r) => ({ id: r.id, name: r.name || "" }));
    } catch (e) { ping("Backup failed — check connection"); return; }
    const attachments = {};
    for (const c of projects) for (const m of (c.attachments || [])) { try { const { data: blob } = await supabase.storage.from(ATT_BUCKET).download(attPath(c.id, m.id)); if (blob) attachments[m.id] = await blobToDataURL(blob); } catch (x) { } }
    dl(new Blob([JSON.stringify({ version: 2, builders, people, projects, settings: data.settings, attachments }, null, 2)], { type: "application/json" }), `kiln_backup_${new Date().toISOString().slice(0, 10)}.json`);
    setSettings({ ops: { ...(settings.ops || {}), lastBackup: { at: Date.now(), by: profile.name || user.email || "" } } });
  };
  const importBackup = (e) => { const f = e.target.files?.[0]; if (!f) return; const fr = new FileReader(); fr.onload = async () => { try {
    const p = JSON.parse(fr.result);
    // Restore with fresh ids so nothing collides. Builders first, then people
    // (remap builderId), then projects (remap customerId). A v1 backup (its
    // projects under `customers`, no people/builders) restores its jobs as
    // unassigned projects.
    const bMap = {}, newBuilders = [];
    for (const raw of (p.builders || [])) {
      const b = newBuilder(raw.name || ""); bMap[raw.id] = b.id; newBuilders.push(b);
      try { await supabase.from("builders").insert({ id: b.id, owner_id: user.id, name: b.name }); } catch (x) { }
    }
    const cMap = {}, newPeople = [];
    for (const raw of (p.people || [])) {
      const c = { ...newPerson(raw.name || ""), phone: raw.phone || "", email: raw.email || "", address: raw.address || "", notes: raw.notes || "", builderId: raw.builderId ? (bMap[raw.builderId] || null) : null, updatedAt: Date.now() };
      cMap[raw.id] = c.id; newPeople.push(c);
      try { await supabase.from("customers").insert({ id: c.id, owner_id: user.id, builder_id: c.builderId, data: personData(c), created_at: new Date(c.createdAt).toISOString() }); } catch (x) { }
    }
    const restored = [];
    for (const raw of (p.projects || p.customers || [])) {
      const c = { ...normC(raw), id: uid(), customerId: raw.customerId ? (cMap[raw.customerId] || null) : null, updatedAt: Date.now(), _full: true };
      const idMap = {};
      c.attachments = (c.attachments || []).map((m) => { const nid = uid(); idMap[m.id] = nid; return { ...m, id: nid }; });
      try { const { error } = await supabase.from("projects").insert({ id: c.id, owner_id: user.id, customer_id: c.customerId, data: custData(c), created_at: new Date(c.createdAt || Date.now()).toISOString() }); if (error) throw error; } catch (x) { continue; }
      const vRows = (c.versions || []).map((v) => ({ id: uid(), customer_id: c.id, label: v.label || "Version", auto: !!v.auto, saved_at: new Date(v.savedAt || Date.now()).toISOString(), snapshot: v.snapshot || [] }));
      if (vRows.length) { try { const { error } = await supabase.from("versions").insert(vRows); if (error) throw error; } catch (x) { } }
      c.versions = vRows.map((r) => vMeta(r));
      for (const m of c.attachments) { const val = p.attachments?.[Object.keys(idMap).find((k) => idMap[k] === m.id)]; if (!val) continue; try { await supabase.storage.from(ATT_BUCKET).upload(attPath(c.id, m.id), dataURLToBlob(val), { upsert: true }); } catch (x) { } }
      restored.push(c);
    }
    if (p.settings) setSettings(serializeSettings(normalizeSettings(p.settings)));
    setData((prev) => ({ ...prev, builders: [...prev.builders, ...newBuilders], people: [...newPeople, ...prev.people], projects: [...restored, ...prev.projects] }));
    ping("Backup restored");
  } catch (x) { ping("Invalid file"); } }; fr.readAsText(f); e.target.value = ""; };

  // The tier lens (spec 2026-07-16): everything on-screen and on the estimate
  // computes from the tier-priced pair; quantities are price-independent so the
  // order sheet and order-entry copies (which print no prices) are unaffected.
  // The raw `sel` stays the editable/stored truth.
  // Waste lives on the project now, so fold it onto settings BEFORE the tier
  // lens: tierView hands back the settings object untouched for retail/0%, so
  // injecting downstream would leave every retail job on the shop default.
  // `wSet` is what all job math reads — raw `settings` stays the shop record
  // the Settings screen edits.
  const wSet = withProjWaste(settings, sel && sel._full ? sel : null);
  const jobWaste = wSet.waste;
  // What the header control shows and writes back. A project from before waste
  // moved off Settings (`waste == null`) was quoted with both families applied
  // at the shop rate — present it that way, and the first press materializes it.
  // Gated on `_full` for the same reason `wSet` is: a list-shaped record has no
  // `waste` yet, and the control must not claim a state the math isn't using.
  const jobWasteUI = (sel && sel._full && sel.waste) || { tile: settings.waste.tile, floor: settings.waste.floor, tileOn: true, floorOn: true };
  const tv = tierView(sel && sel._full ? sel : null, wSet);
  const tSet = tv.settings;
  let totalSqft = 0, orderedSqft = 0, flooringPrice = 0, groutCost = 0, caulkCost = 0, mortarCost = 0, underlayCost = 0, miscCost = 0; const gAgg = {}, mAgg = {}, uAgg = {}, cAgg = {};
  (tv.proj?.categories || []).forEach((a) => a.products.forEach((p) => { if (p.type === "misc") { const PC = getPieceCarton(p); miscCost += num(p.priceSqft) * (PC ? PC.pieces : miscQty(p)); } else if (p.qtyType === "sqft") { const sf = num(p.qty); totalSqft += sf; const C = getCarton(p, tSet); orderedSqft += C ? C.order * C.sf : sf; flooringPrice += (C ? C.order * C.sf : sf) * num(p.priceSqft); } else { flooringPrice += num(p.qty) * num(p.priceSqft); } const G = getGrout(p, tSet); if (G) { groutCost += G.order * G.price; const k = G.product + "||" + (G.color || "—"); if (!gAgg[k]) gAgg[k] = { product: G.product, color: G.color || "—", exact: 0 }; Object.assign(gAgg[k], { unit: G.unit, price: G.price, pending: false, colorSku: gAgg[k].colorSku || p.grout.sku || "" }); gAgg[k].exact += G.exact; } else if (p.type === "tile" && p.grout?.checked) { const k = p.grout.product + "||" + (p.grout.color || "—"); if (!gAgg[k]) gAgg[k] = { product: p.grout.product, color: p.grout.color || "—", colorSku: p.grout.sku || "", unit: tSet.grouts[p.grout.product]?.unit || "units", price: num(tSet.grouts[p.grout.product]?.price), exact: 0, pending: true }; } if (p.type === "tile" && p.grout?.checked) { const ck = num(p.grout.caulk); if (ck > 0) { caulkCost += ck * num(p.grout.caulkPrice); const k = p.grout.product + "||" + (p.grout.color || "—"); if (!cAgg[k]) cAgg[k] = { product: p.grout.product, color: p.grout.color || "—", sku: "", unit: "tubes", price: 0, exact: 0 }; cAgg[k].sku = cAgg[k].sku || p.grout.caulkSku || ""; if (num(p.grout.caulkPrice) > 0) cAgg[k].price = num(p.grout.caulkPrice); cAgg[k].exact += ck; } } const M = getMortar(p, tSet); if (M) { mortarCost += M.order * M.price; const k = M.product; if (!mAgg[k]) mAgg[k] = { product: M.product, exact: 0 }; Object.assign(mAgg[k], { unit: M.unit, price: M.price, pending: false }); mAgg[k].exact += M.exact; } else if (p.type === "tile" && p.mortar?.checked) { const k = p.mortar.product; if (!mAgg[k]) mAgg[k] = { product: p.mortar.product, unit: tSet.mortars[p.mortar.product]?.unit || "units", price: num(tSet.mortars[p.mortar.product]?.price), exact: 0, pending: true }; } const U = getUnderlay(p, tSet); if (U && U.product) { underlayCost += U.order * U.price; const k = U.product; if (!uAgg[k]) uAgg[k] = { product: U.product, exact: 0 }; Object.assign(uAgg[k], { unit: U.unit, price: U.price, pending: false }); uAgg[k].exact += U.exact; } else if (p.type !== "misc" && p.underlay?.checked && p.underlay.product) { const k = p.underlay.product; if (!uAgg[k]) uAgg[k] = { product: p.underlay.product, unit: tSet.underlayments?.[p.underlay.product]?.unit || "units", price: num(tSet.underlayments?.[p.underlay.product]?.price), exact: 0, pending: true }; } const IN = getUnderlayInstall(p, tSet); if (IN) IN.forEach((m) => { if (m.kind === "mortar") { mortarCost += m.order * m.price; const k = m.name; if (!mAgg[k]) mAgg[k] = { product: m.name, unit: m.unit, price: m.price, exact: 0 }; mAgg[k].exact += m.exact; } else { underlayCost += m.order * m.price; const k = "install||" + m.name; if (!uAgg[k]) uAgg[k] = { product: m.name, itemSku: m.sku || "", unit: m.unit, price: m.price, exact: 0 }; uAgg[k].exact += m.exact; } }); }));
  // The color's own snapshotted SKU (ADR 0007) outranks the catalog product SKU.
  const gList = Object.values(gAgg).map((g) => { const order = ceilQty(g.exact); return { ...g, sku: g.colorSku || settings.grouts[g.product]?.sku || "", order, cost: order * num(g.price) }; });
  const mList = Object.values(mAgg).map((m) => { const order = ceilQty(m.exact); return { ...m, sku: settings.mortars[m.product]?.sku || "", order, cost: order * num(m.price) }; });
  const uList = Object.values(uAgg).map((u) => { const order = ceilQty(u.exact); return { ...u, sku: u.itemSku || settings.underlayments?.[u.product]?.sku || "", order, cost: order * num(u.price) }; });
  const cList = Object.values(cAgg).map((c) => { const order = ceilQty(c.exact); return { ...c, order, cost: order * num(c.price) }; });
  // Base units ride the CONSOLIDATED kit counts (ADR 0006), so they're derived
  // from gList — not per line — and their cost joins the grout family's.
  const bList = groutBaseList(gList, tSet);
  const baseCost = bList.reduce((t, b) => t + b.cost, 0);
  // Add-on categories (ADR 0016), aggregated once and shared by the order
  // summary, order sheet, and grand total. Grouped by category for the summary.
  const aList = sel?._full ? attachedList(tv.proj, tSet) : [];
  const addonCost = aList.reduce((t, r) => t + r.cost, 0);
  const aByCat = (settings.catalog.categories || []).map((cat) => ({ cat, rows: aList.filter((r) => r.categoryId === cat.id) })).filter((g) => g.rows.length > 0);
  // Every estimated material line with an order quantity, flattened and labeled
  // — shared by the printed order sheet and the order-entry panel.
  const matLines = [
    ...mList.filter((m) => m.order > 0).map((m) => ({ ...m, kind: "Mortar" })),
    ...gList.filter((g) => g.order > 0).map((g) => ({ ...g, product: `${g.product}${g.color !== "—" ? ` — ${g.color}` : ""}`, kind: "Grout" })),
    ...bList.filter((b) => b.order > 0).map((b) => ({ ...b, product: b.name, kind: "Grout base" })),
    ...cList.filter((c) => c.order > 0).map((c) => ({ ...c, product: `${c.product}${c.color !== "—" ? ` — ${c.color}` : ""} matching caulk`, kind: "Caulk" })),
    ...uList.filter((u) => u.order > 0).map((u) => ({ ...u, kind: "Underlayment" })),
    ...aList.filter((r) => r.order > 0).map((r) => ({ ...r, kind: r.category })),
  ];
  const hasMat = gList.length > 0 || bList.length > 0 || mList.length > 0 || uList.length > 0 || cList.length > 0 || aList.length > 0; const materialsCost = groutCost + baseCost + caulkCost + mortarCost + underlayCost + addonCost; const grandTotal = flooringPrice + materialsCost + miscCost;
  // Internal materials margin over special-order rows only (ADR 0011 / 0009 §8.1):
  // those snapshot a cost. Each row's sell mirrors its flooring/misc line total,
  // so this margin is a subset of grandTotal. On screen only — never printed.
  const soLines = [];
  (tv.proj?.categories || []).forEach((a) => a.products.forEach((p) => {
    if (!(num(p.cost) > 0)) return;
    const C = getCarton(p, tSet);
    const PC = getPieceCarton(p);
    const sell = lineTotal(p, C, PC, num(p.priceSqft));
    if (sell > 0) soLines.push({ sell, cost: orderLineCost(p, tSet, sell), markupPct: num(p.markupPct) });
  }));
  const margin = specialOrderMargin(soLines);
  const pMats = sel && sel._full ? printMatList(tv.proj, tSet) : [];

  // The estimate "paper" — renders in BOTH the print layout and the on-screen
  // Print preview tab (one source, so the preview can never drift from what
  // prints). Callers guard sel && sel._full. Two layouts live here: the card
  // redesign (renderEstimatePaperCards, default) and the prior table sheet
  // (renderEstimatePaperClassic), selected by ESTIMATE_PRINT_LAYOUT.
  const renderEstimatePaperClassic = () => {
    // Print pricing switch (spec 2026-07-16): "full" prints everything, "unit"
    // keeps per-unit prices but no line/job totals, "none" prints no money at
    // all (the sheet still works as a selection/scope document). The tier tag
    // only prints when some price does — it explains the numbers.
    const pMode = normPrintPricing(sel.printPricing);
    const showUnit = pMode !== "none", showTotals = pMode === "full";
    const pCols = showTotals ? PRINT_COLS : showUnit ? PRINT_COLS_UNIT : PRINT_COLS_NONE;
    const tag = showUnit ? tierTag(tv.tier, tv.pct) : "";
    return (
          <div>
            <div className="flex justify-between items-center mb-5" style={{ borderBottom: "2px solid var(--ft-text)", paddingBottom: 16 }}>
              <img src={keimLogo} alt="Keim" style={{ height: 40, width: "auto", display: "block" }} />
              <div className="flex flex-col items-end" style={{ gap: 4 }}>
                <div className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: "var(--ft-brand-deep)" }}>Selection Sheet</div>
                <div className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{new Date().toLocaleDateString()}</div>
                {tag && <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-brand-deep)" }}>{tag}</div>}
              </div>
            </div>
            {(() => {
              const cust = data.people.find((c) => c.id === sel.customerId);
              // Pre-snapshot projects have no salesperson — fall back to the
              // signed-in profile, which is exactly what they printed before.
              const sp = sel.salesperson || profile;
              const pname = sp.name || sp.email;
              const areaCount = sel.categories.length;
              const wMeta = wasteMeta(jobWaste, "waste factor");
              const col = (label, name, detail) => (
                <div className="flex flex-col" style={{ gap: 2 }}>
                  <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-faint)" }}>{label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{name || PRINT_DASH}</div>
                  {detail && <div style={{ fontSize: 11, color: "var(--ft-muted)" }}>{detail}</div>}
                </div>
              );
              return (
                <div className="mb-5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  {col("Customer", cust?.name || sel.name, cust?.address || sel.address)}
                  {col("Your salesperson", pname, [sp.phone, sp.email].filter((x) => x && x !== pname).join("  ·  "))}
                  {col("Project", sel.name, [areaCount ? `${areaCount} area${areaCount === 1 ? "" : "s"}` : "", wMeta].filter(Boolean).join("  ·  "))}
                </div>
              );
            })()}
            {sel.notes && <div className="text-sm mb-4 italic text-slate-600">{sel.notes}</div>}
            {tv.proj.categories.map((a, ai) => { const areaSf = a.products.reduce((t, p) => t + (p.qtyType === "sqft" ? num(p.qty) : 0), 0); return (
              <div key={a.id} className="mb-5 break-inside-avoid">
                <div className="flex justify-between items-center" style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "8px 12px" }}>
                  <div className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Area {String(ai + 1).padStart(2, "0")}{(a.name || "").trim() ? ` · ${a.name}` : ""}</div>
                  <div className="ft-mono" style={{ fontSize: 10 }}>{[areaSf > 0 ? `${sf1(areaSf)} SF` : "", showTotals && printAreaFloor(a, tSet) > 0 ? money(printAreaFloor(a, tSet)) : ""].filter(Boolean).join(" · ")}</div>
                </div>
                {a.note && <div className="text-xs italic text-slate-500 mt-1.5" style={{ padding: "0 12px" }}>{a.note}</div>}
                <div style={{ display: "grid", gridTemplateColumns: pCols, gap: 7, padding: "8px 12px 6px", borderBottom: "1px solid var(--ft-text)", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ft-faint)" }}>
                  <div>Size</div><div>Product / Color</div><div>SKU</div><div>Cov.</div>
                  <div className="text-right">SF</div>{showUnit && <div className="text-right">Price</div>}<div className="text-right">Order</div>{showTotals && <div className="text-right">Total</div>}
                </div>
                {a.products.filter((p) => !rowBlank(p)).map((p, pi) => { const c = printProduct(p, tSet); const inline = c.mats.filter((m) => m.inline); const thickLabel = p.type === "tile" && p.thickness ? THICK.find((t) => t.v === String(p.thickness))?.label || `${p.thickness}"` : ""; return (
                  <Fragment key={p.id}>
                    <div style={{ display: "grid", gridTemplateColumns: pCols, gap: 7, padding: "2px 12px 6px", fontSize: 11, alignItems: "baseline", borderTop: pi > 0 ? "1px solid var(--ft-border)" : "none" }}>
                      <div style={{ whiteSpace: "nowrap" }}>{p.type === "tile" ? <>{p.sizeText || (p.L && p.W ? `${p.L}×${p.W}` : PRINT_DASH)}{thickLabel && <span style={{ fontSize: 9.5, color: "var(--ft-muted)" }}> · {thickLabel}</span>}</> : (p.sizeText || PRINT_DASH)}</div>
                      <div style={{ fontWeight: 700 }}>{p.brandColor || TLBL[p.type]}{p.brandColor && <span style={{ fontWeight: 400, fontSize: 10, color: "var(--ft-muted)" }}> · {TLBL[p.type]}</span>}</div>
                      <div className="ft-mono" style={{ fontSize: 9 }}>{p.sku || PRINT_DASH}</div>
                      <div className="ft-mono" style={{ fontSize: 9.5 }}>{c.C ? <>{sf1(c.C.sf)}<span style={{ fontSize: 7.5, color: "var(--ft-muted)" }}> SF/{c.C.unit.toUpperCase()}</span></> : PRINT_DASH}</div>
                      <div className="text-right">{p.qtyType === "sqft" && num(p.qty) > 0 ? sf1(num(p.qty)) : PRINT_DASH}</div>
                      {showUnit && <div className="text-right">{num(p.priceSqft) > 0 ? money(num(p.priceSqft)) : PRINT_DASH}</div>}
                      <div className="text-right whitespace-nowrap">{p.type === "misc" ? `${c.qtyText} EA` : c.C && c.C.order > 0 ? `${c.C.order} ${c.C.unit}` : c.qtyText || PRINT_DASH}</div>
                      {showTotals && <div className="text-right" style={{ fontWeight: 700 }}>{c.line > 0 ? money(c.line) : PRINT_DASH}</div>}
                    </div>
                    {inline.length > 0 && (
                      <div style={{ padding: "0 12px 4px 24px", fontSize: 9.5, color: "var(--ft-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {inline.map((m, i) => (
                          <span key={i}>
                            <span style={{ fontWeight: 700, color: "var(--ft-brand-deep)" }}>{KSHORT[m.kind] || m.kind}</span>{m.order > 0 ? ` ${m.order}` : ""} · {m.kind === "Caulk" ? "Matching caulk" : <>{m.name}{m.spec && <> — {m.spec}</>}{m.detail && <span style={{ color: "var(--ft-faint)" }}> · {m.detail}</span>}</>}
                          </span>
                        ))}
                      </div>
                    )}
                    {p.note && <div className="italic" style={{ padding: "0 12px 6px 24px", fontSize: 10.5, color: "var(--ft-muted)" }}>{p.note}</div>}
                  </Fragment>
                ); })}
              </div>
            ); })}
            {pMats.length > 0 && (
              <div className="break-inside-avoid mb-4">
                <div className="uppercase mb-2" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Setting materials &amp; sundries</div>
                <div style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "14px 16px" }}>
                  <div style={{ columns: 2, columnGap: 28 }}>
                    {(() => {
                      // pMats is pre-sorted by PRINT_KINDS, so same-kind items are
                      // already adjacent — one heading per category, its items listed
                      // beneath it (no repeated category labels).
                      const groups = [];
                      pMats.forEach((m) => {
                        const g = groups[groups.length - 1];
                        if (g && g.kind === m.kind) g.items.push(m);
                        else groups.push({ kind: m.kind, items: [m] });
                      });
                      return groups.map((g, gi) => (
                        <div key={gi} className="break-inside-avoid" style={{ marginBottom: 12 }}>
                          <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", marginBottom: 3 }}>{g.kind}</div>
                          {g.items.map((m, i) => (
                            <div key={i} style={{ marginBottom: 4 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700 }}>{m.name}{m.order > 0 && <> · {m.order} {u1(m.order, m.unit)}</>} <span className="ft-mono" style={{ fontWeight: 400, fontSize: 10 }}>{!showUnit ? "" : showTotals && m.cost > 0 ? money(m.cost) : m.price > 0 ? `${money(m.price)}/${u1(1, m.unit)}` : ""}</span></div>
                              <div style={{ fontSize: 10, color: "var(--ft-muted)" }}>{[m.spec, m.sku, m.exact > 0 ? `(${m.exact.toFixed(2)})` : ""].filter(Boolean).join(" · ")}</div>
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                  {showTotals && (
                  <div className="flex justify-between items-baseline" style={{ borderTop: "1px solid var(--ft-border)", marginTop: 2, paddingTop: 8 }}>
                    <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Materials subtotal</div>
                    <div className="ft-mono" style={{ fontSize: 12, fontWeight: 700 }}>{money(materialsCost)}</div>
                  </div>
                  )}
                </div>
              </div>
            )}
            <div className="break-inside-avoid">
              <div className="flex justify-between items-center gap-4" style={{ borderTop: "2px solid var(--ft-text)", paddingTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--ft-muted)" }}>
                  {[
                    showTotals && flooringPrice + miscCost > 0 ? `Flooring ${money(flooringPrice + miscCost)}` : "",
                    showTotals && materialsCost > 0 ? `Materials ${money(materialsCost)}` : "",
                    totalSqft > 0 ? `${totalSqft.toLocaleString()} SF measured${orderedSqft > 0 ? `, ${sf1(orderedSqft)} ordered` : ""}` : "",
                  ].filter(Boolean).join(" · ")}
                </div>
                {showTotals && grandTotal > 0 && <div className="flex items-baseline gap-2 shrink-0"><span className="uppercase" style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Estimated total</span><span className="ft-serif" style={{ fontSize: 22 }}>{money(grandTotal)}</span></div>}
              </div>
              <div className="mt-2" style={{ fontSize: 10.5, color: "var(--ft-muted)" }}>Quantities{showUnit ? " and prices" : ""} are estimates{wasteNote(jobWaste) ? `, incl. ${wasteNote(jobWaste)}` : ""}. Confirm against product specs and final measurements before ordering.</div>
            </div>
            <div className="break-inside-avoid flex mt-6" style={{ gap: 40 }}>
              <div className="flex-1 flex flex-col" style={{ gap: 4 }}>
                <div style={{ borderBottom: "1px solid var(--ft-text)", height: 28 }} />
                <div className="uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-faint)" }}>Customer approval</div>
              </div>
              <div className="flex flex-col" style={{ width: 160, gap: 4 }}>
                <div style={{ borderBottom: "1px solid var(--ft-text)", height: 28 }} />
                <div className="uppercase" style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", color: "var(--ft-faint)" }}>Date</div>
              </div>
            </div>
            <div className="break-inside-avoid flex justify-between items-center mt-5" style={{ borderTop: "1px solid var(--ft-paper-footer)", paddingTop: 10 }}>
              <div className="flex items-center gap-2">
                <NedLogo height={17} />
              </div>
              <div className="text-[9.5px] text-slate-400">Prepared with the ned</div>
            </div>
          </div>
    );
  };
  // Receipt-card estimate (2026-07). Each product is a card: name + spec +
  // material chips on the left, a right rail (qty · unit price · line total) on
  // the right. The unit always carries its unit ($/sf, and $/carton when sold by
  // the carton; $/ea for counted lines) so the price is never ambiguous. Per-area
  // totals are dropped; material costs collect once in the "Extras" block, which
  // meets flooring at the single Estimated total. Pricing switch: "full" shows
  // qty+unit+totals, "unit" shows unit price only (no qty, no totals), "none"
  // shows product + spec only (and drops the area extras note).
  const renderEstimatePaperCards = () => {
    const pMode = normPrintPricing(sel.printPricing);
    const showUnit = pMode !== "none", showTotals = pMode === "full";
    const tag = showUnit ? tierTag(tv.tier, tv.pct) : "";
    const cust = data.people.find((c) => c.id === sel.customerId);
    const sp = sel.salesperson || profile;
    const pname = sp.name || sp.email;
    const wMeta = wasteMeta(jobWaste);
    const areaCount = sel.categories.length;
    // CT/SH read as cartons/sheets on the qty line; the price keeps the short unit.
    const unitLong = (unit, n) => { const u = String(unit || "").toUpperCase(); if (u === "CT") return n === 1 ? "carton" : "cartons"; if (u === "SH") return n === 1 ? "sheet" : "sheets"; return u1(n, unit); };
    const groups = [];
    pMats.forEach((m) => { const g = groups[groups.length - 1]; if (g && g.kind === m.kind) g.items.push(m); else groups.push({ kind: m.kind, items: [m] }); });
    return (
      <div style={{ fontSize: 11, color: "var(--ft-text)" }}>
        <div className="flex justify-between items-center" style={{ gap: 16, borderBottom: "2px solid var(--ft-text)", paddingBottom: 12, marginBottom: 14 }}>
          <img src={keimLogo} alt="Keim" style={{ height: 40, width: "auto", display: "block", flexShrink: 0 }} />
          <div style={{ flex: "0 1 auto", maxWidth: 320, textAlign: "center", background: "#f4ebd6", border: "1px solid #d8c48c", borderRadius: 6, padding: "5px 14px", lineHeight: 1.28 }}>
            <div className="uppercase" style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", color: "#7a5a1c" }}>Rough Estimate</div>
            <div style={{ fontSize: 9, color: "var(--ft-muted)", marginTop: 2 }}>For planning purposes only · pricing subject to change on final order</div>
          </div>
          <div className="flex flex-col items-end" style={{ gap: 3, flexShrink: 0 }}>
            <div className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".24em", color: "var(--ft-brand-deep)" }}>Selection Sheet</div>
            <div className="ft-mono" style={{ fontSize: 9.5, color: "var(--ft-muted)" }}>{new Date().toLocaleDateString()}</div>
            {tag && <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".18em", color: "var(--ft-brand-deep)" }}>{tag}</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 12 }}>
          {[
            ["Customer", cust?.name || sel.name, cust?.address || sel.address],
            ["Your salesperson", pname, [sp.phone, sp.email].filter((x) => x && x !== pname).join("  ·  ")],
            ["Project", sel.name, [areaCount ? `${areaCount} area${areaCount === 1 ? "" : "s"}` : "", wMeta].filter(Boolean).join("  ·  ")],
          ].map(([label, name, detail], i) => (
            <div key={i} className="flex flex-col" style={{ gap: 2 }}>
              <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".2em", color: "var(--ft-faint)" }}>{label}</div>
              <div style={{ fontSize: 12.5, fontWeight: 800 }}>{name || PRINT_DASH}</div>
              {detail && <div style={{ fontSize: 11, color: "var(--ft-muted)" }}>{detail}</div>}
            </div>
          ))}
        </div>
        {sel.notes && <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--ft-muted)", margin: "-2px 0 12px" }}>{sel.notes}</div>}

        {tv.proj.categories.map((a, ai) => {
          const areaHasExtras = a.products.some((p) => printProduct(p, tSet).mats.length > 0);
          return (
            <div key={a.id} className="break-inside-avoid" style={{ marginBottom: 12 }}>
              <div className="flex justify-between items-center" style={{ gap: 12, background: "var(--ft-paper-band)", borderRadius: 4, padding: "6px 12px", minHeight: 28 }}>
                <div className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".22em", color: "var(--ft-brand-deep)" }}>Area {String(ai + 1).padStart(2, "0")}{(a.name || "").trim() ? ` · ${a.name}` : ""}</div>
                {showUnit && areaHasExtras && <div style={{ fontSize: 10, fontStyle: "italic", color: "var(--ft-muted)", whiteSpace: "nowrap" }}><b style={{ fontStyle: "normal", fontWeight: 800, color: "var(--ft-brand-deep)" }}>＋</b> extras priced below</div>}
              </div>
              {a.note && <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--ft-muted)", padding: "6px 12px 0" }}>{a.note}</div>}
              {a.products.filter((p) => !rowBlank(p)).map((p, pi) => {
                const c = printProduct(p, tSet);
                const inline = c.mats.filter((m) => m.inline);
                const isEach = p.type === "misc" || p.qtyType === "count";
                const typeLbl = TLBL[p.type] || "";
                const specParts = [c.size, c.C ? `${sf1(c.C.sf)} SF/${c.C.unit}` : "", p.sku ? `SKU ${p.sku}` : ""].filter(Boolean).join(" · ");
                const cartonPrice = c.C ? c.C.sf * num(p.priceSqft) : 0;
                const qtyLine = c.C ? `${sf1(c.orderedSf)} SF ordered · ${c.C.order} ${unitLong(c.C.unit, c.C.order)}` : (num(p.qty) > 0 ? `${sf1(num(p.qty))} SF` : "");
                const eachQty = p.type === "misc" ? (c.PC ? `${c.PC.pieces} pcs` : `${miscQty(p)} ${miscQty(p) === 1 ? "pc" : "pcs"}`) : (num(p.qty) > 0 ? `${p.qty} ${num(p.qty) === 1 ? "unit" : "units"}` : "");
                return (
                  <div key={p.id} className="flex justify-between" style={{ gap: 22, padding: "8px 12px", borderTop: pi > 0 ? "1px solid var(--ft-paper-rule)" : "none" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 12.5, lineHeight: 1.25 }}>{p.brandColor || typeLbl}{p.brandColor && <span style={{ fontWeight: 500, fontSize: 10.5, color: "var(--ft-muted)" }}> — {typeLbl.toLowerCase()}</span>}</div>
                      {specParts && <div style={{ fontSize: 10.5, color: "var(--ft-muted)", marginTop: 2 }}>{specParts}</div>}
                      {inline.length > 0 && (
                        <div className="flex flex-wrap" style={{ gap: 6, marginTop: 8 }}>
                          {inline.map((m, i) => (
                            <span key={i} style={{ fontSize: 10, background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)", borderRadius: 20, padding: "2px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>
                              <b style={{ fontWeight: 800 }}>{KSHORT[m.kind] || m.kind}</b>{m.order > 0 ? ` ${m.order}` : ""} · {m.kind === "Caulk" ? "Matching caulk" : `${m.name}${m.spec ? ` — ${m.spec}` : ""}`}
                            </span>
                          ))}
                        </div>
                      )}
                      {p.note && <div style={{ fontSize: 10.5, fontStyle: "italic", color: "var(--ft-muted)", marginTop: 6 }}>{p.note}</div>}
                    </div>
                    <div className="ft-mono" style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {isEach ? (
                        <>
                          {showUnit && <div style={{ fontSize: 11, color: "var(--ft-text)", marginTop: 2 }}>{showTotals && eachQty ? <span style={{ color: "var(--ft-muted)" }}>{eachQty}{num(p.priceSqft) > 0 ? " · " : ""}</span> : null}{num(p.priceSqft) > 0 ? `${money(num(p.priceSqft))}/ea` : null}</div>}
                          {showTotals && c.line > 0 && <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{money(c.line)}</div>}
                        </>
                      ) : (
                        <>
                          {showTotals && qtyLine && <div style={{ fontSize: 10.5, color: "var(--ft-muted)" }}>{qtyLine}</div>}
                          {showUnit && num(p.priceSqft) > 0 && <div style={{ fontSize: 11, color: "var(--ft-text)", marginTop: 2 }}>{money(num(p.priceSqft))}/sf{c.C ? <span style={{ color: "var(--ft-muted)" }}> · {money(cartonPrice)}/{String(c.C.unit).toLowerCase()}</span> : null}</div>}
                          {showTotals && c.line > 0 && <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{money(c.line)}</div>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {pMats.length > 0 && (
          <div className="break-inside-avoid" style={{ margin: "15px 0 6px" }}>
            <div className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".22em", color: "var(--ft-brand-deep)", marginBottom: 6 }}>Extras</div>
            <div style={{ background: "var(--ft-paper-band)", borderRadius: 4, padding: "11px 15px" }}>
              <div style={{ columns: 2, columnGap: 28 }}>
                {groups.map((g, gi) => (
                  <div key={gi} className="break-inside-avoid" style={{ marginBottom: 9 }}>
                    <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".2em", color: "var(--ft-brand-deep)", marginBottom: 3 }}>{g.kind}</div>
                    {g.items.map((m, i) => (
                      <div key={i} className="flex justify-between" style={{ gap: 14, alignItems: "baseline", marginBottom: 6, breakInside: "avoid" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11.5, fontWeight: 800 }}>{m.name}{m.spec ? ` — ${m.spec}` : ""}</div>
                          {(m.detail || m.sku) && <div style={{ fontSize: 10, color: "var(--ft-muted)", marginTop: 1 }}>{[m.detail, m.sku ? `SKU ${m.sku}` : ""].filter(Boolean).join(" · ")}</div>}
                        </div>
                        <div className="ft-mono" style={{ textAlign: "right", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {(showTotals && m.order > 0) || (showUnit && m.price > 0) ? (
                            <div style={{ fontSize: 10.5, color: "var(--ft-muted)" }}>
                              {showTotals && m.order > 0 && <span>{m.order} {u1(m.order, m.unit)}{showUnit && m.price > 0 ? " · " : ""}</span>}
                              {showUnit && m.price > 0 && <span style={{ color: "var(--ft-text)" }}>{money(m.price)}/{u1(1, m.unit)}</span>}
                            </div>
                          ) : null}
                          {showTotals && m.cost > 0 && <div style={{ fontSize: 12, fontWeight: 800, marginTop: 1 }}>{money(m.cost)}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {showTotals && (
                <div className="flex justify-between items-baseline" style={{ borderTop: "1px solid var(--ft-paper-rule)", marginTop: 4, paddingTop: 7 }}>
                  <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Extras subtotal</div>
                  <div className="ft-mono" style={{ fontSize: 12, fontWeight: 800 }}>{money(materialsCost)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {showTotals && grandTotal > 0 && (
          <div className="break-inside-avoid flex justify-end items-baseline" style={{ borderTop: "2px solid var(--ft-text)", paddingTop: 10, marginTop: 10 }}>
            <div className="flex items-baseline" style={{ gap: 10 }}>
              <span className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".2em", color: "var(--ft-brand-deep)" }}>Estimated total</span>
              <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.01em" }}>{money(grandTotal)}</span>
            </div>
          </div>
        )}
        {showTotals && wasteNote(jobWaste) && <div className="break-inside-avoid" style={{ fontSize: 9.5, color: "var(--ft-faint)", marginTop: 6, textAlign: "right" }}>Includes {wasteNote(jobWaste)}</div>}

        <div className="break-inside-avoid flex justify-center items-center" style={{ gap: 7, borderTop: "1px solid var(--ft-paper-footer)", paddingTop: 12, marginTop: 18 }}>
          <span style={{ fontSize: 10.5, color: "var(--ft-faint)" }}>Prepared with</span>
          <NedMark size={18} />
        </div>
      </div>
    );
  };
  const renderEstimatePaper = () => (ESTIMATE_PRINT_LAYOUT === "classic" ? renderEstimatePaperClassic() : renderEstimatePaperCards());
  // The sidebar is two-level: Customers (people), each expandable to their
  // Projects, plus an "Unassigned projects" group for jobs with no customer.
  // Search spans builder + customer contact + project names (ADR 0005).
  const q = search.trim().toLowerCase();
  const matchProj = (p) => [p.name, p.address, p.phone, p.email].some((f) => (f || "").toLowerCase().includes(q));
  const matchPerson = (c) => !q || [c.name, c.phone, c.email, c.address, builderNameOf(c.builderId)].some((f) => (f || "").toLowerCase().includes(q)) || projectsOf(c.id).some(matchProj);
  // "Newest" bubbles a customer up on any activity — their own edit or any of
  // their projects'. "A–Z" ignores recency.
  const personActivity = (c) => Math.max(c.updatedAt || 0, 0, ...projectsOf(c.id).map((p) => p.updatedAt || 0));
  const sortPeople = (list) => [...list].sort((a, b) => sortBy === "name" ? (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }) : personActivity(b) - personActivity(a));
  const peopleList = sortPeople(q ? data.people.filter(matchPerson) : data.people);
  const unassignedAll = data.projects.filter((p) => !p.customerId && (!q || matchProj(p)));
  const quickPrices = unassignedAll.filter((p) => p.quick);
  const unassigned = unassignedAll.filter((p) => !p.quick);

  // Customer column layout (customer-column-redesign): with more than a rail's
  // worth of customers, pin the 5 most-recent up top and tuck the full list
  // into a "Customers" folder that opens into age buckets. Small lists and any
  // active search fall back to a flat, fully-visible list.
  const showFolders = !q && data.people.length > 5;
  const recents = showFolders ? [...data.people].sort((a, b) => personActivity(b) - personActivity(a)).slice(0, 5) : [];
  const DAY = 86400000, nowMs = Date.now();
  const BUCKETS = [["month", "This month", 31], ["quarter", "Last 3 months", 92], ["year", "This year", 366], ["older", "Older", Infinity]];
  const bucketKey = (c) => { const age = (nowMs - personActivity(c)) / DAY; return (BUCKETS.find(([, , max]) => age <= max) || BUCKETS[BUCKETS.length - 1])[0]; };
  const bucketMembers = {};
  if (showFolders) data.people.forEach((c) => { (bucketMembers[bucketKey(c)] ||= []).push(c); });

  if (loading) return <div className="h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
  const lbl = "ft-eyebrow text-[10px] mb-1 block";

  const renderProjRow = (p) => {
    const on = selId === p.id;
    return (
      <button key={p.id} onClick={() => pickProject(p.id)} className={`w-full text-left rounded-md px-2 py-1.5 flex items-center gap-2 border ${on ? "bg-white border-slate-200 shadow-[0_1px_3px_var(--ft-shadow)]" : "border-transparent hover:bg-slate-50"}`}>
        <FileText size={13} className="text-slate-300 shrink-0" />
        <span className="ft-item-name text-[12.5px] truncate flex-1">{p.name || "Untitled project"}</span>
      </button>
    );
  };
  const renderPersonRow = (c) => {
    const projs = projectsOf(c.id);
    const shown = q ? projs.filter(matchProj) : projs;
    const isOpen = !!openCust[c.id] || (q && projs.some(matchProj));
    // Highlight the person row when their open project is hidden behind a
    // collapsed group (or the legacy customer pane is showing).
    const on = (selCustId === c.id && !selId) || (!isOpen && projs.some((p) => p.id === selId));
    const bn = builderNameOf(c.builderId);
    const clickName = () => {
      if (projs.length === 1) pickProject(projs[0].id);
      else setOpenCust((s) => ({ ...s, [c.id]: !isOpen }));
    };
    return (
      <div key={c.id} className="mb-0.5">
        <div className={`w-full rounded-md flex items-center gap-0.5 border ${on ? "bg-white border-slate-200 shadow-[0_1px_4px_var(--ft-shadow)]" : "border-transparent hover:bg-slate-50"}`}>
          <button onClick={clickName} title={projs.length === 1 ? "Open project" : isOpen ? "Collapse" : "Expand"} className="flex items-center gap-1.5 min-w-0 flex-1 py-1.5 pl-1.5 pr-1 text-left">
            {projs.length !== 1 && <ChevronRight size={13} className={`text-slate-300 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} />}
            <div className="min-w-0 flex-1">
              <div className="ft-item-name text-[13.5px] font-semibold truncate">{c.name || "Unnamed customer"}</div>
              <div className="text-[11px] text-slate-400 truncate mt-px">{[bn, `${projs.length} project${projs.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</div>
            </div>
          </button>
          <button onClick={() => setCustModal(c.id)} title="Customer details" className="shrink-0 mr-1.5 rounded border border-slate-200 p-1 text-slate-400 hover:text-slate-600 hover:bg-white">
            <MoreHorizontal size={13} />
          </button>
        </div>
        {acc(isOpen, (
          <div className="ml-6 mt-0.5 mb-1 space-y-0.5 border-l border-slate-200 pl-1.5">
            {shown.map((p) => renderProjRow(p))}
            <button onClick={() => addProject(c.id)} className="w-full flex items-center gap-1 px-2 py-1 text-[11.5px] text-slate-400 hover:text-indigo-600"><Plus size={12} /> New project</button>
          </div>
        ))}
      </div>
    );
  };
  // Smooth-height accordion body + a folder header row (Customers / age bucket /
  // Estimates), sharing the sidebar's row styling.
  const acc = (open, children) => (<div className="ft-acc" data-open={open ? "true" : "false"}><div className="ft-acc-in">{children}</div></div>);
  const folderRow = (open, onClick, icon, label, count, tiny) => (
    <button onClick={onClick} title={open ? "Collapse" : "Expand"} className="w-full rounded-md flex items-center gap-1.5 py-1.5 pl-1.5 pr-2 border border-transparent hover:bg-slate-50 text-left">
      <ChevronRight size={13} className={`text-slate-300 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      {icon}
      <span className="ft-item-name text-[12.5px] font-semibold truncate flex-1">{label}</span>
      {tiny && <span className="text-[8.5px] text-slate-400 whitespace-nowrap">{tiny}</span>}
      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded-full px-1.5 leading-5 shrink-0">{count}</span>
    </button>
  );

  return (
    <div className="ft-vh bg-slate-50 text-slate-800 flex flex-col" style={{ fontFamily: 'var(--ft-ui)' }}>
      <div className={`print:hidden flex ${isWide ? "flex-row" : "flex-col"} flex-1 overflow-hidden relative`}>
        {/* Mobile top bar */}
        {!isWide && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 ft-rail border-b border-slate-200">
            <button onClick={() => setSidebarOpen(true)} className="p-1 -ml-1 text-slate-600"><Menu size={20} /></button>
            <button onClick={goHome} title="Home" className="shrink-0 hover:opacity-70 transition"><NedMark size={28} /></button>
            <span className="ft-serif text-lg truncate flex-1">{sel ? sel.name : selCust ? selCust.name : ""}</span>
            {sel && sel._full && (<>
              <button onClick={() => setProjSheet(true)} className="shrink-0 text-right" style={{ lineHeight: 1.15 }}>
                <span className="ft-mono block text-[13px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</span>
                {tierBadgeText(tv.tier, tv.pct) && <span className="block text-[8.5px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main }}>{tierBadgeText(tv.tier, tv.pct)}</span>}
              </button>
              <button onClick={() => setProjSheet(true)} title="Project details" className="shrink-0 rounded-md border border-slate-200 bg-white p-1.5 text-slate-500"><MoreHorizontal size={15} /></button>
            </>)}
          </div>
        )}

        {!isWide && sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30" onClick={() => setSidebarOpen(false)} />}

        {/* Sidebar */}
        <aside className={isWide ? "ft-rail border-r border-slate-200 flex flex-col w-64 shrink-0" : `ft-rail border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2.5">
            <div className="flex-1 min-w-0"><button onClick={goHome} title="Home" className="block text-left hover:opacity-70 transition"><NedLogo height={27} /></button><div className="ft-eyebrow text-[9.5px] mt-1">Selection Manager</div></div>
            {!isWide && <button onClick={() => setSidebarOpen(false)} className="text-slate-400"><X size={18} /></button>}
          </div>
          <div className="p-2.5 space-y-2">
            <div className="relative"><Search size={16} className="absolute left-2.5 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className={inp + " pl-8"} /></div>
            <div className="flex gap-2">
              <div className="flex items-stretch rounded-md border border-slate-200 overflow-hidden text-xs shrink-0">
                {[["Newest", "newest"], ["A–Z", "name"]].map(([label, v]) => (
                  <button key={v} onClick={() => setSortBy(v)} className={`px-2 flex items-center font-medium ${sortBy === v ? "ft-seg-on" : "ft-seg-off"}`}>{label}</button>
                ))}
              </div>
              <button onClick={() => setNewCust("")} className="ft-spark-btn flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2"><Plus size={16} className="-ml-1" /> New Customer</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-2">
            {data.people.length === 0 && unassigned.length === 0 && quickPrices.length === 0 && <div className="text-center text-sm text-slate-400 mt-8 px-4">No customers yet</div>}
            {q && peopleList.length === 0 && unassigned.length === 0 && quickPrices.length === 0 && <div className="text-center text-sm text-slate-400 mt-8 px-4">No matches</div>}

            {/* Long list: pinned recents + the Customers folder of age buckets */}
            {showFolders && (<>
              <div className="mt-1 mb-1 px-2.5 ft-eyebrow text-[9px]">Recent</div>
              {recents.map((c) => renderPersonRow(c))}
              <div className="mt-2">
                {folderRow(openLib, () => setOpenLib((o) => !o), <Folder size={14} className="text-indigo-500 shrink-0" />, "Customers", data.people.length)}
                {acc(openLib, (
                  <div className="ml-3 border-l border-slate-200 pl-1.5 mt-0.5">
                    {BUCKETS.map(([key, label]) => {
                      const members = sortPeople(bucketMembers[key] || []);
                      if (!members.length) return null;
                      const bopen = !!openBuckets[key];
                      return (
                        <div key={key} className="mb-0.5">
                          {folderRow(bopen, () => setOpenBuckets((s) => ({ ...s, [key]: !s[key] })), <Clock size={13} className="text-slate-400 shrink-0" />, label, members.length)}
                          {acc(bopen, <div className="ml-3 border-l border-slate-200 pl-1.5 mt-0.5">{members.map((c) => renderPersonRow(c))}</div>)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>)}

            {/* Small list or active search: flat, fully-visible customer list */}
            {!showFolders && peopleList.length > 0 && <div className="mt-1 mb-1 px-2.5 ft-eyebrow text-[9px]">Customers ({peopleList.length})</div>}
            {!showFolders && peopleList.map((c) => renderPersonRow(c))}

            {/* Quick Prices + Unassigned jobs, merged into one folder (open on search) */}
            {(quickPrices.length + unassigned.length) > 0 && (
              <div className="mt-2">
                {folderRow(openDrafts || !!q, () => setOpenDrafts((o) => !o), <Clock size={14} className="text-indigo-500 shrink-0" />, "Estimates & drafts", quickPrices.length + unassigned.length)}
                {acc(openDrafts || !!q, (
                  <div className="ml-3 border-l border-slate-200 pl-1.5 mt-0.5">
                    {quickPrices.length > 0 && (<>
                      <div className="mt-1 mb-1 px-2.5 flex items-center justify-between gap-2">
                        <span className="ft-eyebrow text-[9px]">Quick Prices ({quickPrices.length})</span>
                        <span className="text-[8.5px] text-slate-400 whitespace-nowrap">clears in 30d</span>
                      </div>
                      {quickPrices.map((p) => renderProjRow(p))}
                    </>)}
                    {unassigned.length > 0 && (<>
                      <div className="mt-2 mb-1 px-2.5 ft-eyebrow text-[9px]">Unassigned jobs ({unassigned.length})</div>
                      {unassigned.map((p) => renderProjRow(p))}
                    </>)}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-2.5 border-t border-slate-100">
            <div className="flex mb-2">
              <ThemeSwitch theme={theme} setTheme={setTheme} />
            </div>
            <div className="flex mb-2">
              <button onClick={openApps} title="Apps — shop tools" className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><LayoutGrid size={15} /> Apps</button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowSettings(true); setSidebarOpen(false); }} className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><Settings size={15} /> Settings</button>
              <button onClick={openTodos} title="Team issues & to-do list" className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600">
                <ListTodo size={15} /> Issues
                {todos.filter((t) => !t.done).length > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-semibold flex items-center justify-center">{todos.filter((t) => !t.done).length}</span>}
              </button>
              <button onClick={handleSignOut} title={`Sign out — ${user.email}`} className="shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 px-2.5 text-slate-500"><LogOut size={15} /></button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {!sel ? (
            selCust ? (
              <div className="max-w-3xl mx-auto p-3 md:p-5">
                <div className="bg-white rounded-lg border border-slate-200" style={{ padding: "clamp(12px,1.8vw,18px)" }}>
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="ft-eyebrow-accent text-[10px] mb-1.5">{builderNameOf(selCust.builderId) ? `${builderNameOf(selCust.builderId)} · Customer` : "Customer"}</div>
                      <div className="flex items-center gap-2">
                        <input value={selCust.name} onChange={(e) => updatePerson(selCust.id, { name: e.target.value })} placeholder="Customer name" className="ft-serif bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 min-w-0 flex-1" style={{ fontSize: "clamp(26px,4vw,34px)", lineHeight: 1 }} />
                        {saveOk && <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--ft-brand)" }}>Saved ✓</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="ft-serif" style={{ fontSize: "clamp(22px,3vw,28px)", lineHeight: 1 }}>{projectsOf(selCust.id).length}</div>
                      <div className="ft-eyebrow text-[9px] mt-1">project{projectsOf(selCust.id).length === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                    <MetaChip icon={Phone} label="Phone" value={selCust.phone} active={custChip === "phone"} onClick={() => setCustChip(custChip === "phone" ? null : "phone")} />
                    <MetaChip icon={Mail} label="Email" value={selCust.email} active={custChip === "email"} onClick={() => setCustChip(custChip === "email" ? null : "email")} />
                    <MetaChip icon={MapPin} label="Address" value={selCust.address} active={custChip === "address"} onClick={() => setCustChip(custChip === "address" ? null : "address")} />
                    <MetaChip icon={Building2} label="Builder" value={builderNameOf(selCust.builderId)} active={custChip === "builder"} onClick={() => setCustChip(custChip === "builder" ? null : "builder")} />
                    <MetaChip icon={StickyNote} label="Notes" value={selCust.notes ? "Notes" : ""} active={custChip === "notes"} onClick={() => setCustChip(custChip === "notes" ? null : "notes")} />
                    <span className="flex-1" />
                    <button onClick={() => setConfirm({ kind: "person", id: selCust.id })} className="flex items-center justify-center rounded-full border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 p-2 text-slate-400" title="Delete customer"><Trash2 size={15} /></button>
                  </div>
                  {custChip && (
                    <div className="mt-3">
                      {custChip === "phone" && <><label className={lbl}>Phone</label><input autoFocus value={selCust.phone} onChange={(e) => updatePerson(selCust.id, { phone: e.target.value })} className={inp} /></>}
                      {custChip === "email" && <><label className={lbl}>Email</label><input autoFocus value={selCust.email} onChange={(e) => updatePerson(selCust.id, { email: e.target.value })} className={inp} /></>}
                      {custChip === "address" && <><label className={lbl}>Mailing address</label><input autoFocus value={selCust.address} onChange={(e) => updatePerson(selCust.id, { address: e.target.value })} className={inp} /></>}
                      {custChip === "builder" && <><label className={lbl}>Builder</label><BuilderCombo value={selCust.builderId} builders={data.builders} inp={inp} onSelect={(bid) => updatePerson(selCust.id, { builderId: bid })} onAddBuilder={(name) => addBuilderFor(selCust.id, name)} /></>}
                      {custChip === "notes" && <><label className={lbl}>Customer notes</label><textarea autoFocus value={selCust.notes} onChange={(e) => updatePerson(selCust.id, { notes: e.target.value })} rows={2} className={inp} /></>}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-6 mb-3 gap-2">
                  <h2 className="ft-serif" style={{ fontSize: "clamp(22px,3vw,30px)", lineHeight: 1 }}>Projects</h2>
                  <button onClick={() => addProject(selCust.id)} className="flex items-center gap-1.5 text-sm font-semibold rounded-full border border-dashed border-slate-300 px-3.5 py-1.5 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 transition"><Plus size={15} /> New project</button>
                </div>
                {projectsOf(selCust.id).length === 0 && <div className="bg-white rounded-lg border border-dashed border-slate-300 p-9 text-center text-sm text-slate-400">No projects yet. Add the first job for this customer.</div>}
                <div className="space-y-2">
                  {projectsOf(selCust.id).map((p) => (
                    <button key={p.id} onClick={() => pickProject(p.id)} className="w-full text-left bg-white rounded-lg border border-slate-200 hover:border-indigo-300 transition p-4 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{p.name || "Untitled project"}</div>
                        {p.address && <div className="text-[12.5px] text-slate-400 truncate mt-px">{p.address}</div>}
                      </div>
                      {p.updatedAt && <div className="ft-mono text-[11px] text-slate-400 shrink-0 whitespace-nowrap">{fmtAgo(p.updatedAt)}</div>}
                      <ChevronRight size={18} className="text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <NedLogo style={{ width: "clamp(205px, 28vw, 345px)" }} />
                <div className="ft-eyebrow mt-3" style={{ fontSize: "clamp(11px,1.4vw,16px)", letterSpacing: ".32em" }}>Selection Manager</div>
                <button onClick={() => setNewCust("")} className="ft-spark-btn mt-8 inline-flex items-center gap-2 font-semibold px-6 py-3 text-base"><Plus size={18} className="-ml-1" /> New customer</button>
                <button onClick={startQuickPrice} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-700 transition"><Zap size={15} /> Quick Price</button>
              </div>
            )
          ) : !sel._full ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm">Loading {sel.name || "customer"}…</div>
          ) : (
            <div className="max-w-4xl mx-auto p-3 md:p-5">
              <div className="flex items-center gap-1 mb-3 border-b border-slate-200">
                {[["edit", "Edit"], ["preview", "Print preview"]].map(([k, label]) => (
                  <button key={k} onClick={() => setViewTab(k)} className={"px-4 py-2 text-sm font-semibold -mb-px border-b-2 transition " + (viewTab === k ? "" : "border-transparent text-slate-400 hover:text-slate-600")} style={viewTab === k ? { color: "var(--ft-brand)", borderColor: "var(--ft-brand)" } : {}}>{label}</button>
                ))}
              </div>
              {/* Edit view stays mounted (hidden, not unmounted) so field focus and in-progress typing survive tab flips. */}
              <div className={viewTab === "edit" ? "" : "hidden"}>
              {/* Header card, print-sheet style: customer | project | salesperson
                  up top, then builder + attachments | notes | actions, then a
                  full-width Add-area row. The middle (project) column is the
                  widest, like the estimate paper's header. Desktop only — the
                  mobile shell (2026-07-16) collapses it to the stat strip +
                  project sheet below. */}
              {isWide && <div className="rounded-lg border mb-4" style={{ padding: "clamp(10px,1.5vw,15px)", background: "var(--ft-band)", borderColor: "var(--ft-border)" }}>
                {(() => {
                  const cust = data.people.find((c) => c.id === sel.customerId);
                  const bn = cust ? builderNameOf(cust.builderId) : "";
                  const sp = sel.salesperson || profile;
                  const cols = isWide ? { display: "grid", gridTemplateColumns: "1fr 1.28fr 1.08fr", gap: 16 } : { display: "grid", gridTemplateColumns: "1fr", gap: 12 };
                  const midPad = isWide ? { borderLeft: "1px solid var(--ft-border)", borderRight: "1px solid var(--ft-border)", padding: "0 16px" } : {};
                  return (
                    <>
                      <div style={cols}>
                        <div className="min-w-0">
                          <div className="ft-eyebrow text-[9px] mb-1">Customer</div>
                          {cust ? (
                            <>
                              <button onClick={() => setCustModal(cust.id)} title="Open customer details" className="ft-serif flex items-center gap-1 min-w-0 max-w-full text-indigo-600 hover:text-indigo-700" style={{ fontSize: 19, lineHeight: 1.15 }}>
                                <span className="truncate">{cust.name || "Customer"}</span><ChevronDown size={14} className="shrink-0" />
                              </button>
                              <div className="text-xs text-slate-500 mt-1 truncate">{cust.address || " "}</div>
                              {bn && <div className="text-xs text-slate-500 mt-0.5 truncate flex items-center gap-1"><Building2 size={11} className="shrink-0 text-slate-400" /> {bn}</div>}
                            </>
                          ) : (
                            <button onClick={() => { setPromoteId(sel.id); setPromoteQ(""); }} title="File this job under a customer" className="flex items-center gap-2 text-amber-600 hover:text-amber-700 transition" style={{ lineHeight: 1.6 }}>
                              <span className="text-sm font-semibold">{sel.quick ? "Quick price" : "Unassigned"}</span>
                              <span className="text-[10.5px] font-semibold rounded border border-amber-300 px-1.5 py-0.5">File under customer ▾</span>
                            </button>
                          )}
                        </div>
                        <div className="min-w-0 relative" style={midPad}>
                          {isWide && <div className="absolute top-0 flex flex-col items-end" style={{ right: 16 }}>
                            <div className="ft-mono text-[12px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>
                            {tierBadgeText(tv.tier, tv.pct) && <span className="rounded px-1 py-px mt-0.5 font-semibold" style={{ background: TIER_COLOR[tv.tier]?.soft || "var(--ft-brand-soft)", color: TIER_COLOR[tv.tier]?.main, fontSize: 9.5 }}>{tierBadgeText(tv.tier, tv.pct)}</span>}
                          </div>}
                          {saveOk && <span className="absolute top-0 text-[11px] font-medium whitespace-nowrap" style={{ left: isWide ? 16 : 0, color: "var(--ft-brand)" }}>Saved ✓</span>}
                          <div className={"ft-eyebrow text-[9px] mb-1" + (isWide ? " text-center" : "")}>Project</div>
                          <input ref={nameRef} onKeyDown={tabTo(addAreaRef)} value={sel.name} onChange={(e) => updateProject(sel.id, { name: e.target.value })} placeholder="Project name" className={"ft-serif w-full bg-transparent border-b-2 border-transparent focus:border-indigo-500 focus:outline-none pb-0.5 min-w-0 transition" + (isWide ? " text-center" : "") + (focusName ? " border-indigo-300" : "")} style={{ fontSize: "clamp(19px,2.6vw,24px)", lineHeight: 1.05 }} />
                          <input value={sel.address} onChange={(e) => updateProject(sel.id, { address: e.target.value })} placeholder="Project address…" className={"w-full bg-transparent text-xs text-slate-500 border-b border-transparent focus:border-indigo-500 focus:outline-none mt-1" + (isWide ? " text-center" : "")} />
                          {!isWide && <div className="mt-1">
                            <div className="ft-mono text-[12px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>
                            {tierBadgeText(tv.tier, tv.pct) && <span className="inline-block rounded px-1 py-px mt-0.5 font-semibold" style={{ background: TIER_COLOR[tv.tier]?.soft || "var(--ft-brand-soft)", color: TIER_COLOR[tv.tier]?.main, fontSize: 9.5 }}>{tierBadgeText(tv.tier, tv.pct)}</span>}
                          </div>}
                        </div>
                        <div className={"min-w-0 flex flex-col" + (isWide ? " items-end text-right" : " items-start")}>
                          <div className="ft-eyebrow text-[9px] mb-1 flex items-center gap-1"><Lock size={10} /> Salesperson</div>
                          <SalespersonPop value={sel.salesperson} fallback={profile} alignRight={isWide} onChange={(v) => updateProject(sel.id, { salesperson: v })} />
                          <div className="text-xs text-slate-500 mt-1 truncate max-w-full">{sp.phone || " "}</div>
                        </div>
                      </div>
                      <div className="ft-noprint mt-2 pt-2 border-t" style={{ ...cols, borderColor: "var(--ft-border)" }}>
                        <div className="flex flex-col gap-1.5 min-w-0" style={isWide ? { height: 66 } : {}}>
                          {(() => { const pcts = normPricing(settings.pricing); return (
                            <SegBar value={sel.priceTier || "retail"} inputValue={sel.customPct}
                              onChange={(v) => updateProject(sel.id, { priceTier: v })}
                              onInput={(v) => updateProject(sel.id, { priceTier: "custom", customPct: v })}
                              options={[
                                { v: "retail", label: "Retail", title: "Retail pricing" },
                                { v: "builder", label: "Bldr", color: TIER_COLOR.builder.main, title: `Builder pricing — ${pcts.builderPct}% off retail` },
                                { v: "employee", label: "Emp", color: TIER_COLOR.employee.main, title: "Employee pricing — cost + 6% (no-cost lines stay retail)" },
                                { v: "sale", label: "Sale", color: TIER_COLOR.sale.main, title: `Sale pricing — ${pcts.salePct}% off retail` },
                                { v: "custom", input: true, color: TIER_COLOR.custom.main, title: "Custom % off retail" },
                              ]} />
                          ); })()}
                          {/* Printed pricing shares its row with the waste
                              toggles; the tier bar above keeps the full width. */}
                          <div className="flex gap-1.5 min-w-0">
                            <div className="flex-1 min-w-0">
                              <SegBar value={sel.printPricing || "full"}
                                onChange={(v) => updateProject(sel.id, { printPricing: v })}
                                options={[
                                  { v: "full", label: "All $", title: "Print every price and total" },
                                  { v: "unit", label: "Unit $", title: "Print unit prices only — no line or job totals" },
                                  { v: "none", label: "No $", title: "Print no pricing" },
                                ]} />
                            </div>
                            <WasteBar w={jobWasteUI} dflt={settings.waste} className="w-[134px]"
                              onChange={(patch) => updateProject(sel.id, { waste: { ...jobWasteUI, ...patch } })} />
                          </div>
                        </div>
                        <textarea value={sel.notes} onChange={(e) => updateProject(sel.id, { notes: e.target.value })} placeholder="Project notes…" className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" style={{ height: 66, background: "var(--ft-cream)" }} />
                        <div className="flex flex-col justify-between gap-1.5" style={isWide ? { height: 66 } : {}}>
                          {namingVersion ? (
                            <div className="flex items-center gap-1.5">
                              <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmVersion(); if (e.key === "Escape") setNamingVersion(false); }} placeholder="Version name" className="ft-field flex-1 min-w-0 h-[30px] text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                              <button onClick={confirmVersion} className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"><Check size={15} /></button>
                              <button onClick={() => setNamingVersion(false)} className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-400"><X size={15} /></button>
                            </div>
                          ) : (
                            <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 132px" }}>
                              <div className="flex gap-1.5">
                                <button onClick={startVersionName} title="Save a version" className="h-[30px] flex-1 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50"><Save size={14} /></button>
                                <FilesPop attachments={sel.attachments} onOpen={openAttachment} onDelete={delAttachment} onAdd={() => attRef.current?.click()} />
                                <input ref={attRef} type="file" onChange={addAttachment} className="hidden" />
                                <button onClick={() => setShowVersions(true)} title={`Version history (${sel.versions?.length || 0})`} className="h-[30px] flex-1 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50"><History size={14} /></button>
                              </div>
                              <div className="flex gap-1.5">
                                <button onClick={() => setPrintMode("order")} className="h-[30px] flex-1 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold rounded-md border border-slate-200 hover:bg-slate-50 whitespace-nowrap"><ClipboardList size={14} /> Order sheet</button>
                                <button onClick={() => setConfirm({ id: sel.id })} title="Delete project" className="h-[30px] w-[30px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-slate-400"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          )}
                          {/* Non-retail tiers repaint both buttons in the tier's color —
                              the pricing state is visible right where you commit to it. */}
                          <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 132px" }}>
                            <button onClick={() => setShowOrderCopy(true)} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"><Copy size={14} /> Order entry</button>
                            <button onClick={() => setPrintMode("estimate")} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"><Printer size={14} /> Print</button>
                          </div>
                        </div>
                      </div>
                      {/* Ink row — same action as the dashed Add-area bar that
                          trails the areas list; both stay on purpose. */}
                      <button ref={addAreaRef} onClick={addArea} className="ft-noprint mt-2 w-full h-[30px] flex items-center justify-center gap-1.5 text-[12.5px] font-bold rounded-md transition hover:opacity-90" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}><Plus size={14} /> Add area</button>
                    </>
                  );
                })()}
              </div>}

              {/* Mobile shell (2026-07-16, .scratch/mockups/mobile-v2): the
                  header card collapses to a horizontally scrolling stat strip;
                  the full project controls live in a bottom sheet opened from
                  the strip, the top bar's total, or ⋯. No Order entry on
                  mobile — that's a desk task (owner call). */}
              {!isWide && (() => {
                const cust = data.people.find((c) => c.id === sel.customerId);
                const totalSf = sel.categories.reduce((t, a) => t + a.products.reduce((s, p) => s + (p.qtyType === "sqft" ? num(p.qty) : 0), 0), 0);
                const pcts = normPricing(settings.pricing);
                const tile = "shrink-0 text-left rounded-md border border-slate-200 bg-white px-2.5 py-1.5";
                const tLbl = "ft-eyebrow text-[8px]";
                const tVal = "text-[12.5px] font-bold whitespace-nowrap mt-px";
                const act = "h-[34px] flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white text-[12px] font-semibold text-slate-600";
                return (
                  <>
                    <input ref={attRef} type="file" onChange={addAttachment} className="hidden" />
                    <div className="ft-noprint flex gap-1.5 overflow-x-auto mb-3" style={{ scrollbarWidth: "none" }}>
                      <button onClick={() => cust ? setCustModal(cust.id) : (setPromoteId(sel.id), setPromoteQ(""))} className={tile}>
                        <div className={tLbl}>Customer</div>
                        <div className={tVal + (cust ? "" : " text-amber-600")}>{cust ? `${cust.name || "Customer"} ▾` : "File ▾"}</div>
                      </button>
                      <div className={tile}><div className={tLbl}>Floor</div><div className={tVal + " ft-mono"}>{sf1(totalSf)} SF</div></div>
                      <button onClick={() => setProjSheet(true)} className={tile}><div className={tLbl}>Print</div><div className={tVal}>{sel.printPricing === "unit" ? "Unit $" : sel.printPricing === "none" ? "No $" : "All $"}</div></button>
                      <button onClick={() => setProjSheet(true)} className={tile}><div className={tLbl}>Files</div><div className={tVal}>{(sel.attachments || []).length}</div></button>
                      <button onClick={() => setShowVersions(true)} className={tile}><div className={tLbl}>Versions</div><div className={tVal}>{sel.versions?.length || 0}</div></button>
                      {saveOk && <div className={tile}><div className={tLbl}>Sync</div><div className={tVal} style={{ color: "var(--ft-brand)" }}>Saved ✓</div></div>}
                    </div>
                    <MobileSheet open={projSheet} onClose={() => setProjSheet(false)} title={sel.name || "Untitled project"}
                      badge={tierBadgeText(tv.tier, tv.pct) ? <span className="shrink-0 rounded px-1 py-px font-semibold" style={{ background: TIER_COLOR[tv.tier]?.soft || "var(--ft-brand-soft)", color: TIER_COLOR[tv.tier]?.main, fontSize: 9.5 }}>{tierBadgeText(tv.tier, tv.pct)}</span> : null}
                      footer={<>
                        <div className="flex-1 min-w-0" style={{ lineHeight: 1.15 }}>
                          <div className="ft-eyebrow text-[8.5px]">Total</div>
                          <div className="ft-mono text-[17px] font-bold" style={{ color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>
                        </div>
                        <button onClick={() => { setProjSheet(false); setPrintMode("estimate"); }} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[38px] shrink-0 flex items-center justify-center gap-1.5 text-[13px] font-bold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-7"><Printer size={15} /> Print</button>
                      </>}>
                      <div className="space-y-3">
                        <div><label className={lbl}>Project name</label><input value={sel.name} onChange={(e) => updateProject(sel.id, { name: e.target.value })} placeholder="Project name" className={inp} /></div>
                        <div><label className={lbl}>Project address</label><input value={sel.address} onChange={(e) => updateProject(sel.id, { address: e.target.value })} placeholder="Project address…" className={inp} /></div>
                        <div>
                          <label className={lbl}>Price tier</label>
                          <SegBar value={sel.priceTier || "retail"} inputValue={sel.customPct}
                            onChange={(v) => updateProject(sel.id, { priceTier: v })}
                            onInput={(v) => updateProject(sel.id, { priceTier: "custom", customPct: v })}
                            options={[
                              { v: "retail", label: "Retail", title: "Retail pricing" },
                              { v: "builder", label: "Bldr", color: TIER_COLOR.builder.main, title: `Builder pricing — ${pcts.builderPct}% off retail` },
                              { v: "employee", label: "Emp", color: TIER_COLOR.employee.main, title: "Employee pricing — cost + 6% (no-cost lines stay retail)" },
                              { v: "sale", label: "Sale", color: TIER_COLOR.sale.main, title: `Sale pricing — ${pcts.salePct}% off retail` },
                              { v: "custom", input: true, color: TIER_COLOR.custom.main, title: "Custom % off retail" },
                            ]} />
                        </div>
                        <div>
                          <label className={lbl}>Printed pricing</label>
                          <SegBar value={sel.printPricing || "full"}
                            onChange={(v) => updateProject(sel.id, { printPricing: v })}
                            options={[
                              { v: "full", label: "All $", title: "Print every price and total" },
                              { v: "unit", label: "Unit $", title: "Print unit prices only — no line or job totals" },
                              { v: "none", label: "No $", title: "Print no pricing" },
                            ]} />
                        </div>
                        <div>
                          <label className={lbl}>Waste</label>
                          <WasteBar w={jobWasteUI} dflt={settings.waste} className="w-[160px]"
                            onChange={(patch) => updateProject(sel.id, { waste: { ...jobWasteUI, ...patch } })} />
                        </div>
                        <div><label className={lbl}>Project notes</label><textarea value={sel.notes} onChange={(e) => updateProject(sel.id, { notes: e.target.value })} placeholder="Project notes…" rows={2} className={inp} /></div>
                        <div>
                          <label className={lbl}>Salesperson</label>
                          <SalespersonPop value={sel.salesperson} fallback={profile} onChange={(v) => updateProject(sel.id, { salesperson: v })} />
                        </div>
                        <div>
                          <label className={lbl}>Files <span className="text-slate-400 font-normal normal-case tracking-normal">— not printed</span></label>
                          <div className="flex flex-wrap gap-1">
                            {(sel.attachments || []).map((m) => (
                              <span key={m.id} className="flex items-center gap-1 rounded-md bg-slate-100 pl-1.5 pr-1 py-0.5 text-[11px]">
                                <button onClick={() => openAttachment(m)} className="hover:text-indigo-600 max-w-[9rem] truncate" title={`${m.name} · ${Math.max(1, Math.round(m.size / 1024))} KB`}>{m.name}</button>
                                <button onClick={() => delAttachment(m)} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
                              </span>
                            ))}
                            <button onClick={() => attRef.current?.click()} className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-500"><Paperclip size={11} /> Add</button>
                          </div>
                        </div>
                        {namingVersion ? (
                          <div className="flex items-center gap-1.5">
                            <input autoFocus value={versionName} onChange={(e) => setVersionName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmVersion(); if (e.key === "Escape") setNamingVersion(false); }} placeholder="Version name" className="ft-field flex-1 min-w-0 h-[34px] text-sm rounded-md border border-slate-200 px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            <button onClick={confirmVersion} className="h-[34px] w-[34px] shrink-0 flex items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"><Check size={15} /></button>
                            <button onClick={() => setNamingVersion(false)} className="h-[34px] w-[34px] shrink-0 flex items-center justify-center rounded-md border border-slate-200 text-slate-400"><X size={15} /></button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <button onClick={startVersionName} className={act}><Save size={14} /> Save version</button>
                            <button onClick={() => { setProjSheet(false); setShowVersions(true); }} className={act}><History size={14} /> History ({sel.versions?.length || 0})</button>
                            <button onClick={() => { setProjSheet(false); setPrintMode("order"); }} className={act}><ClipboardList size={14} /> Order sheet</button>
                            <button onClick={() => { setProjSheet(false); setConfirm({ id: sel.id }); }} className={act + " hover:bg-red-50"} style={{ color: "#b91c1c", borderColor: "#fecaca" }}><Trash2 size={14} /> Delete</button>
                          </div>
                        )}
                      </div>
                    </MobileSheet>
                  </>
                );
              })()}

              {sel.categories.length === 0 && <div className="bg-white rounded-lg border border-dashed border-slate-300 p-9 text-center text-sm text-slate-400">No areas yet. Add one to start building this customer's selections.</div>}

              {/* Areas butt up against each other (no gap) — each area still
                  rounds its own corners, so touching areas keep the soft "pill"
                  notch at their seam that the flush product boxes don't. */}
              <div>
                {sel.categories.map((a, ai) => {
                  const areaSf = a.products.reduce((t, p) => t + (p.qtyType === "sqft" ? num(p.qty) : 0), 0);
                  const areaTotal = printAreaFloor(tv.proj.categories[ai] || a, tSet);
                  const areaMatOpen = a.products.some((pp) => matOpen[pp.id]);
                  return (
                  // overflow-hidden lifts while a card is dragged (so the floating
                  // card isn't clipped at its home area's edge) and while one of its
                  // products' materials drawers is open (so the drawer can float past
                  // the card's bottom edge without being clipped).
                  <div key={a.id} data-area-drop={a.id} onClickCapture={isWide ? undefined : () => setActiveAreaId(a.id)} className={`rounded-lg border bg-white transition-colors ${drag || areaMatOpen ? "" : "overflow-hidden"} ${drag?.to?.aid === a.id ? "border-indigo-400" : drag ? "border-dashed border-slate-300" : "border-slate-200"}`}>
                    <div className="flex justify-between items-center gap-3" style={{ background: "var(--ft-area-head)", padding: "8px 14px", ...(!isWide && a.id === activeAreaId ? { boxShadow: "inset 3px 0 0 var(--ft-brand)" } : {}) }}>
                      <div className="flex items-baseline gap-2.5 flex-1 min-w-0">
                        <input ref={(el) => { if (el) areaRefs.current[a.id] = el; }} value={a.name} onChange={(e) => updArea(a.id, { name: e.target.value })} placeholder={`Area ${ai + 1}`} className="ft-serif bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none min-w-0 placeholder:text-slate-400" style={{ fontSize: 20, lineHeight: 1.1, width: `${Math.max(a.name.length || `Area ${ai + 1}`.length, 4) + 1}ch` }} />
                        <input tabIndex={-1} value={a.note} onChange={(e) => updArea(a.id, { note: e.target.value })} placeholder="area note…" className="text-xs bg-transparent focus:outline-none placeholder:text-current flex-1 min-w-0" style={{ color: "color-mix(in oklab, var(--ft-text) 80%, transparent)" }} />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="ft-mono" style={{ fontSize: 10.5 }}>{(isWide ? [areaSf > 0 ? `${sf1(areaSf)} SF` : "", areaTotal > 0 ? money(areaTotal) : ""] : [areaTotal > 0 ? money(areaTotal) : ""]).filter(Boolean).join(" · ")}</span>
                        <button tabIndex={-1} onClick={() => setConfirmArea(a.id)} title="Delete this area" className="ft-noprint text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {confirmArea === a.id && (
                      <div className="ft-noprint flex items-center gap-2 px-3 py-2 text-xs border-b border-slate-100">
                        {(() => { const realN = a.products.filter((p) => !rowBlank(p)).length; return (
                        <span className="text-red-600 flex-1">Delete "{areaLabel(a, ai)}"{realN > 0 ? <> and its {realN} selection{realN === 1 ? "" : "s"}</> : ""}? Everything in this area comes off the estimate.</span>
                        ); })()}
                        <button onClick={() => { delArea(a.id); setConfirmArea(null); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
                        <button onClick={() => setConfirmArea(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
                      </div>
                    )}

                    <div data-prod-list="1" className="relative" onKeyDown={(e) => gridEnterNav(e, () => addProduct(a.id))}>
                      {isWide && (
                      <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, background: "var(--ft-area-head)", borderTop: "1px solid var(--ft-border)", borderBottom: "1px solid var(--ft-border)", fontSize: 8, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ft-muted)" }}>
                        <div style={{ padding: "5px 10px", borderRight: "1px solid var(--ft-row-line)" }}>Size / Type ▾</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)" }}>Product / Color ▾</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)" }}>SKU</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)" }}>Cov.</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)", textAlign: "right" }}>SF/EA</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)", textAlign: "right" }}>Price</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)", textAlign: "right" }}>Order</div>
                        <div style={{ padding: "5px 8px", borderRight: "1px solid var(--ft-row-line)", textAlign: "right" }}>Total</div>
                        <div />
                      </div>
                      )}
                      {a.products.map((p, pi) => {
                        const G = getGrout(p, wSet), M = getMortar(p, wSet);
                        const gEx = groutExact(p, wSet), mEx = mortarExact(p, wSet);
                        // Amber-flag the empty qty box only once the row has identity —
                        // a freshly added blank row shouldn't glow before you start.
                        const qtyMissing = p.type !== "misc" && !(num(p.qty) > 0) && !!(p.sku || p.brandColor || num(p.priceSqft) > 0);
                        // Sold by the carton: whole cartons drive the line total —
                        // cartonSf for flooring sqft, cartonPc for per-piece count lines.
                        const C = getCarton(p, wSet), cEx = cartonExact(p, wSet), PC = getPieceCarton(p);
                        const line = lineTotal(p, C, PC, num(p.priceSqft));
                        // Tier lens (spec 2026-07-16): the price INPUT stays the stored
                        // retail; the chip + line total show the tier the estimate uses.
                        const tierPrice = tv.tier !== "retail" ? tierUnitPrice(p, tv.tier, tv.pct) : null;
                        const tierNoCost = tv.tier === "employee" && employeeNoCost(p);
                        const tLine = tierPrice == null ? line : lineTotal(p, C, PC, tierPrice);
                        // Dropdowns are driven by the catalog (resolve-by-name). A selection
                        // whose stored product is no longer offered is injected back as an
                        // option so it still shows — same pattern as tile thickness above.
                        const groutNames = offeredGrouts(settings.catalog), mortarNames = offeredMortars(settings.catalog);
                        const groutOpts = groutNames.includes(p.grout.product) ? groutNames : [p.grout.product, ...groutNames];
                        // A grout linked to a price-book family (ADR 0007) offers that
                        // family's colors; picking one snapshots the color's SKU onto
                        // the row. Unlinked grouts keep the standard code list.
                        const gBook = settings.grouts[p.grout.product]?.book || "";
                        const gFam = gBook ? gFamilies.find((f) => f.product.toLowerCase() === gBook.toLowerCase()) : null;
                        const colorBase = gFam ? gFam.colors.map((c) => c.color) : colorsFor(p.grout.product);
                        const colorOpts = (!p.grout.color || colorBase.includes(p.grout.color)) ? colorBase : [p.grout.color, ...colorBase];
                        // A book-linked pick snapshots from the stock cache at click
                        // time (ADR 0007, groutSnapshotPatch) — while stage 2 is in
                        // flight (or after it failed) that would blank an existing
                        // snapshot, so refuse loudly instead (ADR 0026).
                        const stockBusy = (book) => { if (book && (!stockReady || stockFailed)) { ping(stockFailed ? STOCK_FAILED_MSG : STOCK_LOADING_MSG); return true; } return false; };
                        const pickGroutColor = (color) => { if (stockBusy(gBook)) return; updProduct(a.id, p.id, { grout: { ...p.grout, color, ...groutSnapshotPatch(stock, gBook, color) } }); };
                        const pickGroutProduct = (product) => { const book = settings.grouts[product]?.book || ""; if (stockBusy(book)) return; updProduct(a.id, p.id, { grout: { ...p.grout, product, ...groutSnapshotPatch(stock, book, p.grout.color) } }); };
                        // Turning a material on: keep the row's pick when the catalog
                        // still offers it, else the team's catalog default, else the
                        // first offered — so "click to choose" never activates a
                        // renamed/removed name (e.g. a retired ProLite). A saved job's
                        // explicit pick is untouched; it only injects back as a select
                        // option, as before.
                        const mortarDefault = resolveMaterialDefault(mortarNames, p.mortar.product, settings.catalog.defaults?.mortar);
                        const groutDefault = resolveMaterialDefault(groutNames, p.grout.product, settings.catalog.defaults?.grout);
                        const addGrout = () => { if (groutDefault === p.grout.product) { updProduct(a.id, p.id, { grout: { ...p.grout, checked: true } }); return; } const book = settings.grouts[groutDefault]?.book || ""; if (stockBusy(book)) return; updProduct(a.id, p.id, { grout: { ...p.grout, checked: true, product: groutDefault, ...groutSnapshotPatch(stock, book, p.grout.color) } }); };
                        const mortarOpts = mortarNames.includes(p.mortar.product) ? mortarNames : [p.mortar.product, ...mortarNames];
                        // Underlayment applies to every flooring type but its options are
                        // filtered to the ones tagged for this type; a stored pick that is
                        // no longer offered is injected back so it still shows.
                        const U = getUnderlay(p, wSet), uEx = underlayExact(p, wSet);
                        const installDefs = settings.underlayments[p.underlay.product]?.install || [];
                        const INS = getUnderlayInstall(p, wSet);
                        const insById = new Map((INS || []).map((m) => [m.defId, m]));
                        const insIncluded = installDefs.filter((d) => !p.underlay.installSkip?.[d.id]).length;
                        const insExpanded = !!insOpen[p.id];
                        const underlayNames = offeredUnderlayments(settings.catalog, p.type);
                        const underlayOpts = p.underlay.product && !underlayNames.includes(p.underlay.product) ? [p.underlay.product, ...underlayNames] : underlayNames;
                        const underlayUnit = U ? U.unit : settings.underlayments[p.underlay.product]?.unit;
                        const underlayDefault = resolveMaterialDefault(underlayNames, "", settings.catalog.defaults?.underlay);
                        const toggleUnderlay = () => updProduct(a.id, p.id, { underlay: { ...p.underlay, checked: !p.underlay.checked, product: p.underlay.checked ? p.underlay.product : (p.underlay.product || underlayDefault) } });
                        // Collapsed rows reuse the print sheet's inline material line
                        // (Phase 2 wording, incl. swatch + subtotal) — the #14a spec
                        // wants the collapsed line identical to the printed one.
                        const matExpanded = !!matOpen[p.id];
                        const pInline = printProduct(tv.proj.categories[ai]?.products[pi] || p, tSet).mats.filter((m) => m.inline);
                        const matsCost = pInline.reduce((t, m) => t + m.cost, 0);
                        const warns = materialWarnings(p, wSet);
                        // Add-on categories (ADR 0016) this row's flooring type offers.
                        const offCats = p.type === "misc" ? [] : offeredCategories(settings.catalog, p.type);
                        const WLBL = { grout: "Grout", mortar: "Mortar", underlay: underlayLabel(p.type), install: "Install materials" };
                        const warnLabel = (w) => w.startsWith("attach:") ? (settings.catalog.categories.find((c) => c.id === w.slice(7))?.name || "Add-on") : WLBL[w];
                        // The strip shows uncomputed grout as a name with no number;
                        // when it's being warned about, the warning replaces that ghost.
                        const stripMats = pInline.filter((m) => !(m.kind === "Grout" && m.order <= 0 && warns.includes("grout")));
                        const hasMats = p.type !== "misc" && ((p.type === "tile" && (p.grout.checked || p.mortar.checked)) || p.underlay.checked || offCats.some((c) => p.attached?.[c.id]?.checked));
                        const openMats = () => setMatOpen({ [p.id]: true });
                        const closeMats = () => setMatOpen({});
                        const addables = p.type === "misc" ? [] : [
                          ...(p.type === "tile" && !p.grout.checked ? ["Grout"] : []),
                          ...(p.type === "tile" && !p.mortar.checked ? ["Mortar"] : []),
                          ...(!p.underlay.checked ? [KSHORT[underlayLabel(p.type)]] : []),
                          ...offCats.filter((c) => !p.attached?.[c.id]?.checked).map((c) => c.name),
                        ];
                        const gUnit = G ? G.unit : settings.grouts[p.grout.product]?.unit || "";
                        const mUnit = M ? M.unit : settings.mortars[p.mortar.product]?.unit || "";
                        // Price-book link: the row keeps its snapshotted values; the
                        // chip below only points out drift from the current book. An
                        // order row (bookId set) drifts on cost x markup, its book item
                        // fetched on demand (orderItems), so it takes the order path and
                        // skips the stock lookup entirely.
                        const orderRow = !!p.bookId;
                        const oBook = orderRow ? books.find((b) => b.id === p.bookId) : null;
                        const oItem = orderRow && p.sku ? orderItems[p.bookId]?.[p.sku] : null;
                        const oDrift = oItem && oBook ? orderDrift(oItem, oBook, p) : null;
                        const stockItem = orderRow ? null : findStock(stock, p.sku);
                        const drift = stockDrift(stockItem, p);
                        const stockRetired = p.sku && stockItem && (stockItem.discontinued || !stockItem.active);
                        const baseAlt = stockItem && stockBaseVariant(stockItem, stock);
                        // The type accent stays on the small type button and the material
                        // chips; the row itself carries the page tone (constant — it does
                        // not deepen when the materials box expands), and the Price and
                        // Total cells carry the head tone to anchor the money columns.
                        // The row tone continues below the row and wraps the materials
                        // box, which reads as the exact same color as the row, open or
                        // closed.
                        const accent = TYPE_ACCENT[p.type];
                        const rowTint = ROW_WASH;
                        const totalTint = TOTAL_WASH;
                        const matBoxBg = rowTint;
                        // The materials box and its collapsed summary chip both carry the
                        // light hairline border.
                        const chipBorder = "1px solid var(--ft-border)";
                        // When the drawer is open the owning row + drawer form one sharp,
                        // undimmed unit framed by a double border (row draws the top & sides,
                        // the drawer the sides & bottom, so they read as a single box).
                        const matBorder = "3px double color-mix(in oklab, var(--ft-text) 45%, var(--ft-prod))";
                        const rowOpen = matExpanded && p.type !== "misc";
                        // The note lives inside the tinted wrap, hugging the chip's
                        // bottom edge; rows with no wrap fall back to a cream note row.
                        const noteInput = (
                          <input value={p.note} onChange={(e) => updProduct(a.id, p.id, { note: e.target.value })} placeholder="note…" className="w-full min-w-0 text-xs italic text-slate-500 bg-transparent focus:outline-none placeholder:text-slate-300" style={{ padding: "3px 7px 0" }} />
                        );
                        const searchMode = rowBlank(p) && !manualRows[p.id];
                        // The last row of an area is the permanent inline "adder";
                        // a blank row above it is a real selection the user cleared.
                        const isAdder = pi === a.products.length - 1;
                        const clearOmni = () => setOmniQ((o) => { const n = { ...o }; delete n[p.id]; return n; });
                        const omniText = omniQ[p.id] || "";
                        const goManual = (extra) => { const t = omniText.trim(); updProduct(a.id, p.id, { ...(t ? { brandColor: t } : {}), ...extra }); setManualRows((m) => ({ ...m, [p.id]: true })); setOmniQ((o) => { const n = { ...o }; delete n[p.id]; return n; }); setFocusProdBox(p.id); };
                        const fillFromStock = (items) => { addStockProducts(a.id, p.id, items); setOmniQ((o) => { const n = { ...o }; delete n[p.id]; return n; }); setFocusQty(p.id); };
                        // Drift / retired-SKU / base-variant chips render under the row on
                        // both layouts, so the block is built once. A Sheoga row's chip
                        // reopens the configurator pre-filled from its saved configuration.
                        const driftBlock = (drift || oDrift || p.freightFlag || stockRetired || baseAlt || p.sheoga?.cfg) ? (
                          <div className="ft-noprint flex items-center gap-2 text-xs flex-wrap" style={{ padding: "2px 12px 4px 26px" }}>
                            {p.sheoga?.cfg && (
                              <button tabIndex={-1} onClick={() => setSheogaPop({ aid: a.id, pid: p.id, seed: p.sheoga })} data-sheoga-reconfig
                                className="rounded-full border px-2 py-0.5 font-medium hover:bg-slate-50" style={{ borderColor: "var(--ft-brand)", color: "var(--ft-brand-deep)" }}>
                                Sheoga — reconfigure
                              </button>
                            )}
                            {drift && (<>
                              <span className="text-amber-600">Price book now {money(drift.to)} — this row has {money(drift.from)}</span>
                              <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { priceSqft: String(drift.to) })} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Use new price</button>
                            </>)}
                            {oDrift && (oDrift.frame ? (
                              // The book item's quote frame moved (a trim reclassified to
                              // per-piece, ADR 0013 amendment) — a price arrow across frames
                              // would compare $/sqft to $/piece. Re-picking the SKU adopts
                              // the new frame deliberately; the row stays as saved.
                              <span className="text-amber-600">The price book now sells this {oDrift.frame === "piece" ? "per piece" : "by the square foot"} — this row was saved {oDrift.frame === "piece" ? "by the square foot" : "per piece"}. Re-pick the SKU to update it.</span>
                            ) : (<>
                              <span className="text-amber-600">Price book now {money(oDrift.to)} — this row has {money(oDrift.from)}</span>
                              {(oDrift.cost || oDrift.markup) && (
                                <span className="text-slate-400">
                                  {oDrift.cost && `cost ${money(oDrift.cost.from)} → ${money(oDrift.cost.to)}`}
                                  {oDrift.cost && oDrift.markup && ", "}
                                  {oDrift.markup && `markup ${oDrift.markup.from}% → ${oDrift.markup.to}%`}
                                </span>
                              )}
                              <button tabIndex={-1} onClick={() => { const priced = pricedItem(oItem, oBook?.data?.markups); const csf = rowCostSqft(oItem); updProduct(a.id, p.id, { priceSqft: String(oDrift.to), cost: oItem.cost != null ? String(oItem.cost) : "", costSqft: csf != null ? String(Math.round(csf * 100) / 100) : "", markupPct: priced.markupPct != null ? String(priced.markupPct) : "" }); }} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Use new price</button>
                            </>))}
                            {p.freightFlag && <span className="shrink-0 rounded px-1.5 py-0.5 bg-amber-50 text-amber-700 font-medium">+ freight</span>}
                            {baseAlt && (
                              <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, stockPatch(baseAlt, p))} className="rounded-full border border-slate-300 text-slate-600 px-2 py-0.5 hover:bg-slate-50 font-medium">Use {baseAlt.style || baseAlt.description}</button>
                            )}
                            {stockRetired && <span className="text-slate-400">SKU {p.sku} is no longer in the stock price book</span>}
                          </div>
                        ) : null;
                        const rowEditor = !isWide && rowSheet?.pid === p.id ? (
                          <MobileRowSheet p={p} areaName={areaLabel(a, ai)} canDelete={a.products.length > 1 && !(rowBlank(p) && isAdder)}
                            settings={wSet} stock={stock} stockReady={stockReady} stockFailed={stockFailed} gFamilies={gFamilies} searchOrder={searchOrder} bookName={bookName} tv={tv} notify={ping}
                            onPatch={(patch) => updProduct(a.id, p.id, patch)}
                            onPickStock={(items) => { addStockProducts(a.id, p.id, items); setFocusQty(p.id); }}
                            onOpenSheoga={(query) => { setRowSheet(null); setSheogaPop({ aid: a.id, pid: p.id, seed: sheogaSeed(query) }); }}
                            onDelete={() => delProduct(a.id, p.id)}
                            onClose={() => setRowSheet(null)}
                            qtyRef={(el) => { if (el) qtyRefs.current[p.id] = el; }} />
                        ) : null;
                        // The blank trailing adder never shows in the phone list (the add
                        // bar's + Product opens its editor sheet instead), but an open
                        // sheet on it must still render so the add flow has a surface.
                        if (!isWide && rowBlank(p) && isAdder) return <Fragment key={p.id}>{rowEditor}</Fragment>;
                        return (
                          // flow-root keeps the collapsed pill's bottom margin inside the
                          // card — collapsed through, it painted a white strip between rows
                          <div key={p.id} data-prod-card={p.id} data-flip={p.id} style={{
                            display: "flow-root",
                            position: "relative",
                            background: "var(--ft-area-row)",
                            borderBottom: "1px solid var(--ft-grid-line)",
                          }}>
                            {!isWide ? (<>
                            {/* compact two-line summary (mobile rows 2026-07-17) — a tap
                                opens the row's editor sheet, a long-press pops it out for
                                drag (startDrag's hold + move-abort does the detection; the
                                timestamp keeps the drop's trailing click from re-opening) */}
                            <MobileProductRow p={p} settings={wSet} tv={tv}
                              onPointerDown={(e) => { mobilePressAt.current = Date.now(); startDrag(e, a.id, p, pi, 350); }}
                              onOpen={() => { if (Date.now() - mobilePressAt.current > 330) return; setRowSheet({ aid: a.id, pid: p.id }); }} />
                            {driftBlock}
                            {rowEditor}
                            </>) : searchMode ? (
                            /* empty row: type chip + one wide price-book search that fills the row on pick */
                            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 44px", fontSize: 11, fontWeight: 600, background: "var(--ft-card)" }}>
                              <div style={{ ...gridCell, paddingLeft: 0, gap: 2 }}>
                                <TypeSelect compact blank type={p.type} onChange={(t) => goManual({ type: t })} />
                                <span className="w-1 shrink-0" />
                              </div>
                              <div style={gridCell}>
                                <GridOmniSearch stock={stock} stockReady={stockReady} query={omniText}
                                  onQuery={(v) => setOmniQ((o) => ({ ...o, [p.id]: v }))}
                                  onPick={(it) => fillFromStock([it])} onPickMany={(items) => fillFromStock(items)}
                                  onManual={() => goManual()} onAbandon={clearOmni}
                                  onVendor={(q) => { clearOmni(); setSheogaPop({ aid: a.id, pid: p.id, seed: sheogaSeed(q) }); }}
                                  searchOrder={searchOrder} bookName={bookName}
                                  inputRef={(el) => { if (el) typeRefs.current[p.id] = el; }} />
                              </div>
                              <div className="ft-noprint flex items-center justify-center gap-0.5" style={{ background: "var(--ft-card)" }}>
                                <button tabIndex={-1} onPointerDown={(e) => startDrag(e, a.id, p, pi)} title="Drag to reorder or move to another area" className="p-0.5 rounded touch-none cursor-grab text-slate-300 hover:text-slate-500"><Hand size={12} /></button>
                                {a.products.length > 1 && !isAdder && <button tabIndex={-1} onClick={() => delProduct(a.id, p.id)} title="Remove this empty row" className="p-0.5 text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>}
                              </div>
                            </div>
                            ) : (<>
                            {/* main product row: the 9-column grid (desktop only — the
                                phone renders MobileProductRow above instead) */}
                            <div style={{ display: "grid", gridTemplateColumns: GRID_COLS, fontSize: 11, fontWeight: 600, background: rowTint, ...(rowOpen ? { position: "relative", zIndex: 46, borderTop: matBorder, borderLeft: matBorder, borderRight: matBorder, marginTop: -3 } : null) }}>
                              <div style={{ ...gridCell, paddingLeft: 0, gap: 2 }}>
                                <TypeSelect compact type={p.type} onChange={(t) => updProduct(a.id, p.id, { type: t })} triggerRef={(el) => { if (el) typeRefs.current[p.id] = el; }} />
                                {/* no expand carrot — the materials pill opens the drawer,
                                    clicking anywhere outside folds it */}
                                <span className="w-1 shrink-0" />
                                {p.type === "tile" ? (
                                  <GridSizeInput p={p} onCommit={(patch) => updProduct(a.id, p.id, patch)} />
                                ) : (
                                  <input value={p.sizeText} onChange={(e) => updProduct(a.id, p.id, { sizeText: e.target.value })} data-c="size" className="ft-cell" style={{ padding: "6px 4px" }} placeholder={p.type === "hardwood" ? "Width" : p.type === "misc" ? "Size (opt.)" : "Size"} title={p.type === "hardwood" ? "Plank width (in)" : "Size"} />
                                )}
                              </div>
                              <div style={gridCell}>
                                <GridProductBox value={p.brandColor} stock={stock} onChange={(v) => updProduct(a.id, p.id, { brandColor: v })} onPick={(it) => { addStockProducts(a.id, p.id, [it]); setFocusQty(p.id); }} searchOrder={searchOrder} bookName={bookName} placeholder={p.type === "misc" ? "Description…" : "Product / color…"} inputRef={(el) => { if (el) prodRefs.current[p.id] = el; }} />
                              </div>
                              <div style={{ ...gridCell, fontSize: 9.5 }} className="ft-mono">
                                {skuSearchable(stock, searchOrder, stockReady) ? (
                                  <SkuPicker value={p.sku || ""} stock={stock} stockReady={stockReady}
                                    onChange={(v) => updProduct(a.id, p.id, { sku: v })}
                                    onPick={(it) => { addStockProducts(a.id, p.id, [it]); setFocusQty(p.id); }}
                                    onPickMany={(items) => addStockProducts(a.id, p.id, items)}
                                    searchOrder={searchOrder} bookName={bookName}
                                    wrapClass="relative flex-1 min-w-0 self-stretch flex" wrapStyle={{}} inputClass="ft-cell" />
                                ) : (
                                  <input value={p.sku} onChange={(e) => updProduct(a.id, p.id, { sku: e.target.value })} data-c="sku" className="ft-cell" placeholder="SKU" />
                                )}
                              </div>
                              <div style={{ ...gridCell, fontSize: 9.5 }} className="ft-mono">
                                {p.type !== "misc" && p.qtyType === "sqft" ? (<>
                                  <input tabIndex={p.sku ? -1 : 0} type="number" value={p.cartonSf} onChange={(e) => updProduct(a.id, p.id, { cartonSf: e.target.value })} data-c="cov" className="ft-cell text-right" style={{ flex: 1, minWidth: 0, padding: "6px 2px" }} placeholder="—" title="Sq ft per carton/sheet — filled from the price book when the SKU has one. With this set, quantities and totals are figured by whole cartons." />
                                  {num(p.cartonSf) > 0 && p.cartonUnit && <span className="shrink-0 pr-0.5" style={{ fontSize: 6.5, letterSpacing: "-0.02em", color: "var(--ft-muted)" }}>SF/{String(p.cartonUnit).toUpperCase()}</span>}
                                </>) : p.type === "misc" ? (<>
                                  <input tabIndex={p.sku ? -1 : 0} type="number" value={p.cartonPc} onChange={(e) => updProduct(a.id, p.id, { cartonPc: e.target.value })} data-c="cov" className="ft-cell text-right" style={{ flex: 1, minWidth: 0, padding: "6px 2px" }} placeholder="—" title="Pieces per carton — filled from the price book when the SKU is sold by the carton only. With this set, pieces needed round up to whole cartons." />
                                  {num(p.cartonPc) > 0 && <span className="shrink-0 pr-0.5" style={{ fontSize: 6.5, letterSpacing: "-0.02em", color: "var(--ft-muted)" }}>PC/{String(p.cartonUnit || "CT").toUpperCase()}</span>}
                                </>) : <span className="px-2" style={{ color: "var(--ft-faint)" }}>—</span>}
                              </div>
                              <div style={gridCell}>
                                {p.type !== "misc" && p.qtyType === "sqft" ? (
                                  <input ref={(el) => { if (el) qtyRefs.current[p.id] = el; }} type="number" value={p.qty} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value })} data-c="sf" className={`ft-cell text-right ${qtyMissing ? "ring-2 ring-inset ring-amber-400 bg-amber-50 rounded" : ""}`} placeholder="0" title={qtyMissing ? "Enter square footage" : "Square feet"} />
                                ) : (<>
                                  <input ref={(el) => { if (el) qtyRefs.current[p.id] = el; }} type="number" value={p.qtyType === "count" ? p.qty : ""} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value, qtyType: "count" })} data-c="sf" className={`ft-cell text-right ${qtyMissing ? "ring-2 ring-inset ring-amber-400 bg-amber-50 rounded" : ""}`} placeholder={p.type === "misc" ? "1" : "0"} title={PC ? `Pieces needed — the order rounds up to whole ${PC.unit.toUpperCase()}s of ${PC.per}` : "Quantity — counted each"} />
                                  <span className="shrink-0 pr-0.5" style={{ fontSize: 6.5, letterSpacing: "-0.02em", color: "var(--ft-muted)" }}>EA</span>
                                </>)}
                              </div>
                              <div style={{ ...gridCell, background: totalTint }}>
                                <GridPriceCell p={p} tier={tv.tier} tierPrice={tierPrice} noCost={tierNoCost} onRetail={(v) => updProduct(a.id, p.id, { priceSqft: v })} title={p.type === "misc" || p.qtyType === "count" ? "Price each" : "Price per sq ft"} />
                              </div>
                              <div style={{ ...gridCell, justifyContent: "flex-end", gap: 3 }}>
                                {p.type !== "misc" && C ? (<>
                                  <input tabIndex={-1} type="number" value={String(C.order)} onChange={(e) => updProduct(a.id, p.id, { cartonManual: e.target.value })} data-c="order" className="ft-cell text-right" style={{ width: 42, flex: "none", padding: "6px 2px" }} title={`Cartons to order — type to override${cEx != null ? ` (exact ${cEx.toFixed(2)}, ${sf1(C.order * C.sf)} sf ordered)` : ""}`} />
                                  <span className="shrink-0" style={{ fontSize: 9.5 }}>{C.unit}</span>
                                  <span className="ft-noprint flex flex-col shrink-0 pr-1">
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(C.order + 1) })} title="One more carton" className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronUp size={9} /></button>
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(Math.max(0, C.order - 1)) })} title="One less carton" className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronDown size={9} /></button>
                                  </span>
                                </>) : PC ? (<>
                                  <input tabIndex={-1} type="number" value={String(PC.cartons)} onChange={(e) => updProduct(a.id, p.id, { cartonManual: e.target.value })} data-c="order" className="ft-cell text-right" style={{ width: 42, flex: "none", padding: "6px 2px" }} title={`Cartons to order — type to override (${PC.need} pcs needed, ${PC.pieces} billed at ${PC.per}/${PC.unit.toUpperCase()})`} />
                                  <span className="shrink-0" style={{ fontSize: 9.5 }}>{PC.unit}</span>
                                  <span className="ft-noprint flex flex-col shrink-0 pr-1">
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(PC.cartons + 1) })} title="One more carton" className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronUp size={9} /></button>
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { cartonManual: String(Math.max(0, PC.cartons - 1)) })} title="One less carton" className="text-slate-300 hover:text-slate-600" style={{ lineHeight: 0, padding: "1px 0" }}><ChevronDown size={9} /></button>
                                  </span>
                                </>) : p.type === "misc" || p.qtyType === "count" ? (<>
                                  <span className="text-slate-500">{p.type === "misc" ? miscQty(p) : num(p.qty) > 0 ? sf1(num(p.qty)) : ""}</span>
                                  {p.type === "misc" ? <span className="shrink-0 pr-1.5" style={{ fontSize: 9.5 }}>EA</span> : (
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { qtyType: "sqft" })} title="Counted each — click to switch to square feet" className="shrink-0 pr-1.5 font-semibold hover:text-slate-600" style={{ fontSize: 9.5 }}>EA</button>
                                  )}
                                </>) : (<>
                                  <span className="text-slate-500">{num(p.qty) > 0 ? sf1(num(p.qty)) : ""}</span>
                                  <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { qtyType: "count" })} title="Square feet — click to switch to counted each" className="shrink-0 pr-1.5 font-semibold hover:text-slate-600" style={{ fontSize: 9.5 }}>sf</button>
                                </>)}
                              </div>
                              {tierPrice != null && tLine > 0 ? (
                                <div style={{ ...gridCell, background: totalTint, flexDirection: "column", alignItems: "flex-end", justifyContent: "center", padding: "2px 8px", gap: 1 }}>
                                  <span style={{ fontWeight: 700, color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(tLine)}</span>
                                  <span style={{ fontSize: 8.5, color: "var(--ft-faint)", lineHeight: 1.1 }}>retail {money(line)}</span>
                                </div>
                              ) : (
                                <div style={{ ...gridCell, justifyContent: "flex-end", padding: "6px 8px", fontWeight: 700, background: totalTint }}>{tLine > 0 ? money(tLine) : PRINT_DASH}</div>
                              )}
                              <div className="ft-noprint flex items-center justify-center gap-0.5" style={{ background: "var(--ft-area-row)" }}>
                                <button tabIndex={-1} onPointerDown={(e) => startDrag(e, a.id, p, pi)} title="Drag to reorder or move to another area" className="p-0.5 rounded touch-none cursor-grab text-slate-300 hover:text-slate-500"><Hand size={12} /></button>
                                {a.products.length > 1 && <button tabIndex={-1} onClick={() => setConfirmProd({ aid: a.id, pid: p.id })} title="Delete this selection" className="p-0.5 text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>}
                              </div>
                            </div>
                            {confirmProd?.aid === a.id && confirmProd?.pid === p.id && (
                              <div className="ft-noprint flex items-center gap-2 px-3 py-1.5 text-xs" style={{ background: "var(--ft-area-row)" }}>
                                <span className="text-red-600 flex-1">Delete this selection{p.brandColor ? ` — "${p.brandColor}"` : ""}? Its materials come off the estimate too.</span>
                                <button onClick={() => { delProduct(a.id, p.id); setConfirmProd(null); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
                                <button onClick={() => setConfirmProd(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
                              </div>
                            )}
                            {driftBlock}
                            {/* Materials footer. The collapsed pill/summary/note (below)
                                stays in normal flow so opening the drawer never reflows the
                                page; the open drawer is a modal that overlays that footprint
                                (absolute, top:0) and floats down over the rows below. A
                                dimmed, lightly blurred backdrop covers everything else —
                                signalling the drawer must be clicked out of — and folds it
                                when clicked. Each material shows checked (full controls) or
                                unchecked (slim card, click ✓ to add). */}
                            {(pInline.length > 0 || warns.length > 0 || (!hasMats && addables.length > 0) || p.note || (matExpanded && p.type !== "misc")) && (
                            <div style={{ position: "relative" }}>
                            {matExpanded && p.type !== "misc" && (
                              <>
                              <div className="ft-noprint" style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(20,15,10,.14)", backdropFilter: "blur(0.6px)", WebkitBackdropFilter: "blur(0.6px)" }} onClick={closeMats} />
                              <div style={{ position: "absolute", left: 0, top: 0, zIndex: 45, width: "100%", background: rowTint, padding: "4px 8px 7px 26px", borderLeft: matBorder, borderRight: matBorder, borderBottom: matBorder, boxShadow: "0 10px 24px rgba(20,15,10,.16)" }}>
                              <div className="ft-mats" style={{ background: matBoxBg, border: chipBorder, overflow: "hidden", "--mat-acc": accent }}>
                                {p.type === "tile" && p.grout.checked && (
                                  <div className="px-2.5 py-1.5" style={{ background: rowTint }}>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                      <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { grout: { ...p.grout, checked: false } })} title="Remove grout" className="ft-mat-toggle w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: accent, color: "var(--ft-type-ink)" }}><Check size={12} /></button>
                                      <span className="text-sm font-medium">Grout</span>
                                      <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0 flex flex-wrap items-center gap-1.5">
                                        <FitSelect sm value={p.grout.product} display={p.grout.product} onChange={(e) => pickGroutProduct(e.target.value)}>{groutOpts.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect>
                                        <span className="inline-flex items-center gap-1 min-w-0">
                                          <span className="shrink-0" style={{ width: 10, height: 10, borderRadius: 999, background: p.grout.color ? "#C9B79D" : "#F4F2EC", border: "1px solid #B3A38D" }} />
                                          <FitSelect sm value={p.grout.color} display={p.grout.color || "Color…"} onChange={(e) => pickGroutColor(e.target.value)}><option value="">Color…</option>{colorOpts.map((c) => <option key={c}>{c}</option>)}</FitSelect>
                                        </span>
                                        {(p.grout.sku || settings.grouts[p.grout.product]?.sku) && <span className="ft-mono text-[10px] text-slate-400 shrink-0" title="This color's price book SKU — prints on the order summary">{p.grout.sku || settings.grouts[p.grout.product]?.sku}</span>}
                                        <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px] shrink-0">{JOINTS.map((j) => <button tabIndex={-1} key={j.v} onClick={() => updProduct(a.id, p.id, { grout: { ...p.grout, joint: j.v } })} className={`px-1.5 py-1 ${num(p.grout.joint) === j.v ? "" : "ft-field text-slate-500 hover:bg-slate-50"}`} style={num(p.grout.joint) === j.v ? { background: accent, color: "var(--ft-type-ink)" } : undefined}>{j.label}</button>)}</div>
                                      </div>
                                      <span className="ml-auto flex items-center gap-1 text-sm shrink-0" style={{ color: accent }}>{gEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{gEx.toFixed(2)} →</span>}<input tabIndex={-1} type="number" value={G ? String(G.order) : ""} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{gUnit}</span></span>
                                      {!G && <div className="order-last basis-full text-xs text-amber-500">Enter Sq Ft + tile L/W/thickness to calculate, or type a total above.</div>}
                                    </div>
                                    <div className="mt-1.5 pl-7 flex items-center gap-2 text-xs text-slate-500">
                                      <span className="text-slate-400">Matching caulk</span>
                                      {p.grout.color && <span className="inline-flex items-center gap-1"><span className="shrink-0" style={{ width: 9, height: 9, borderRadius: 999, background: "#C9B79D", border: "1px solid #B3A38D" }} />{p.grout.color} match</span>}
                                      {p.grout.caulkSku && <span className="ft-mono text-[10px] text-slate-400">{p.grout.caulkSku}</span>}
                                      <span className="ml-auto flex items-center gap-1"><input tabIndex={-1} type="number" value={p.grout.caulk} onChange={(e) => updProduct(a.id, p.id, { grout: { ...p.grout, caulk: e.target.value } })} placeholder="—" title="Matching caulk for this grout color — tubes to order; leave blank for none" className={`w-10 text-right rounded border px-1 py-0.5 ft-field focus:border-indigo-500 focus:outline-none ${p.grout.caulk ? "border-indigo-300 text-indigo-700 font-semibold" : "border-slate-200"}`} /><span>tubes</span></span>
                                    </div>
                                  </div>
                                )}
                                {p.type === "tile" && !p.grout.checked && (
                                  <div className="px-2.5 py-1 flex items-center gap-2">
                                    <button tabIndex={-1} onClick={addGrout} title="Add grout" className="ft-mat-toggle w-5 h-5 rounded shrink-0 border border-slate-300 ft-field hover:border-indigo-500" />
                                    <span className="text-sm text-slate-500">Grout</span>
                                    <span className="text-xs text-slate-400 truncate">{groutDefault || ""}</span>
                                  </div>
                                )}
                                {p.type === "tile" && p.mortar.checked && (
                                  <div className="px-2.5 py-1.5" style={{ background: rowTint }}>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                      <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { mortar: { ...p.mortar, checked: false } })} title="Remove mortar" className="ft-mat-toggle w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: accent, color: "var(--ft-type-ink)" }}><Check size={12} /></button>
                                      <span className="text-sm font-medium">Mortar</span>
                                      <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0 flex flex-wrap items-center gap-1.5">
                                        <FitSelect sm value={p.mortar.product} display={p.mortar.product} onChange={(e) => updProduct(a.id, p.id, { mortar: { ...p.mortar, product: e.target.value } })}>{mortarOpts.map((g) => <option key={g} value={g}>{g}</option>)}</FitSelect>
                                        {settings.mortars[p.mortar.product]?.sku && <span className="ft-mono text-[10px] text-slate-400 shrink-0">{settings.mortars[p.mortar.product]?.sku}</span>}
                                      </div>
                                      <span className="ml-auto flex items-center gap-1 text-sm shrink-0" style={{ color: accent }}>{mEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{mEx.toFixed(2)} →</span>}<input tabIndex={-1} type="number" value={M ? String(M.order) : ""} onChange={(e) => updProduct(a.id, p.id, { mortar: { ...p.mortar, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{mUnit}</span></span>
                                    </div>
                                  </div>
                                )}
                                {p.type === "tile" && !p.mortar.checked && (
                                  <div className="px-2.5 py-1 flex items-center gap-2">
                                    <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, { mortar: { ...p.mortar, checked: true, product: mortarDefault } })} title="Add mortar" className="ft-mat-toggle w-5 h-5 rounded shrink-0 border border-slate-300 ft-field hover:border-indigo-500" />
                                    <span className="text-sm text-slate-500">Mortar</span>
                                    <span className="text-xs text-slate-400 truncate">{mortarDefault || ""}</span>
                                  </div>
                                )}
                                {p.type !== "misc" && p.underlay.checked && (
                                  <div className="px-2.5 py-1.5" style={{ background: rowTint }}>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                      <button tabIndex={-1} onClick={toggleUnderlay} title={`Remove ${underlayLabel(p.type).toLowerCase()}`} className="ft-mat-toggle w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: accent, color: "var(--ft-type-ink)" }}><Check size={12} /></button>
                                      <span className="text-sm font-medium">{KSHORT[underlayLabel(p.type)]}</span>
                                      <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0 flex flex-wrap items-center gap-1.5">
                                        {underlayOpts.length > 0 ? (
                                          <FitSelect sm value={p.underlay.product} display={p.underlay.product || "Select…"} onChange={(e) => updProduct(a.id, p.id, { underlay: { ...p.underlay, product: e.target.value } })}>{!p.underlay.product && <option value="">Select…</option>}{underlayOpts.map((u) => <option key={u} value={u}>{u}</option>)}</FitSelect>
                                        ) : (
                                          <span className="text-amber-500 text-xs">No {underlayLabel(p.type).toLowerCase()} products for {TLBL[p.type]} yet — add them in Settings.</span>
                                        )}
                                        {settings.underlayments[p.underlay.product]?.sku && <span className="ft-mono text-[10px] text-slate-400 shrink-0">{settings.underlayments[p.underlay.product]?.sku}</span>}
                                      </div>
                                      <span className="ml-auto flex items-center gap-1 text-sm shrink-0" style={{ color: accent }}>{uEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{uEx.toFixed(2)} →</span>}<input tabIndex={-1} type="number" value={U ? String(U.order) : ""} onChange={(e) => updProduct(a.id, p.id, { underlay: { ...p.underlay, manual: e.target.value } })} placeholder="—" title="Total — type to override the calculated amount" className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{underlayUnit}</span></span>
                                    </div>
                                    {installDefs.length > 0 && (
                                      <div className="mt-1.5 pt-1.5" style={{ borderTop: "1px solid var(--ft-border)" }}>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => updProduct(a.id, p.id, { underlay: { ...p.underlay, install: !p.underlay.install } })} className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${p.underlay.install ? "" : "border border-slate-300"}`} style={p.underlay.install ? { background: accent, color: "var(--ft-type-ink)" } : undefined}>{p.underlay.install && <Check size={10} />}</button>
                                    {p.underlay.install ? (
                                      <button onClick={() => setInsOpen((o) => ({ ...o, [p.id]: !insExpanded }))} className="flex items-center gap-1 text-xs min-w-0">
                                        {insExpanded ? <ChevronDown size={12} className="text-slate-400 shrink-0" /> : <ChevronRight size={12} className="text-slate-400 shrink-0" />}
                                        Install materials
                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{insIncluded < installDefs.length ? `${insIncluded} of ${installDefs.length}` : `${installDefs.length} item${installDefs.length === 1 ? "" : "s"}`}</span>
                                      </button>
                                    ) : (
                                      <span className="text-xs">Install materials <span className="text-[10px] text-slate-400">({installDefs.length})</span></span>
                                    )}
                                    {p.underlay.install && !insExpanded && (INS ? (
                                      <span className="ml-auto text-[10px] font-medium truncate" style={{ color: accent }}>{INS.slice(0, 3).map((m) => `${m.order} ${m.unit}`).join(" · ")}{INS.length > 3 ? ` +${INS.length - 3}` : ""}</span>
                                    ) : insIncluded === 0 ? (
                                      <span className="ml-auto text-[10px] text-slate-400">none included</span>
                                    ) : (
                                      <span className="ml-auto text-[10px] text-amber-500 truncate">{p.qtyType === "sqft" && num(p.qty) > 0 ? "No coverage set" : "Enter Sq Ft"}</span>
                                    ))}
                                  </div>
                                  {p.underlay.install && insExpanded && (
                                    <div className="mt-1 ml-6 space-y-1">
                                      {installDefs.map((d) => {
                                        const skipped = !!p.underlay.installSkip?.[d.id];
                                        const item = insById.get(d.id);
                                        const cur = p.underlay.installMortars?.[d.id] || d.product;
                                        const opts = cur && !mortarNames.includes(cur) ? [cur, ...mortarNames] : mortarNames;
                                        return (
                                          <div key={d.id} className="flex items-center gap-2">
                                            <button onClick={() => updProduct(a.id, p.id, { underlay: { ...p.underlay, installSkip: { ...(p.underlay.installSkip || {}), [d.id]: !skipped } } })} title={skipped ? "Skipped — click to include" : "Included — click to skip"} className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${skipped ? "border border-slate-300" : ""}`} style={skipped ? undefined : { background: accent, color: "var(--ft-type-ink)" }}>{!skipped && <Check size={10} />}</button>
                                            {d.kind === "mortar" && !skipped ? (
                                              <FitSelect sm value={cur} display={cur || "Select mortar…"} onChange={(e) => updProduct(a.id, p.id, { underlay: { ...p.underlay, installMortars: { ...(p.underlay.installMortars || {}), [d.id]: e.target.value } } })} title="Mortar used to set the underlayment — combines with this job's other mortar totals">
                                                {!cur && <option value="">Select mortar…</option>}{opts.map((g) => <option key={g} value={g}>{g}</option>)}
                                              </FitSelect>
                                            ) : (
                                              <span className={`text-xs truncate ${skipped ? "text-slate-400 line-through" : "text-slate-600"}`}>{d.kind === "mortar" ? (cur || "mortar") : d.name}</span>
                                            )}
                                            <span className="ml-auto text-xs whitespace-nowrap">{skipped ? <span className="text-slate-300">skipped</span> : item ? <><span className="text-slate-400">{item.exact.toFixed(2)} → </span><span className="font-semibold" style={{ color: accent }}>{item.order} {item.unit}</span></> : <span className="text-slate-300">—</span>}</span>
                                          </div>
                                        );
                                      })}
                                      {!INS && insIncluded > 0 && <div className="text-xs text-amber-500">{p.qtyType === "sqft" && num(p.qty) > 0 ? "Set install-material coverage in Settings to calculate." : "Enter Sq Ft to calculate install materials."}</div>}
                                    </div>
                                  )}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {p.type !== "misc" && !p.underlay.checked && (
                                  <div className="px-2.5 py-1 flex items-center gap-2">
                                    <button tabIndex={-1} onClick={toggleUnderlay} title={`Add ${underlayLabel(p.type).toLowerCase()}`} className="ft-mat-toggle w-5 h-5 rounded shrink-0 border border-slate-300 ft-field hover:border-indigo-500" />
                                    <span className="text-sm text-slate-500">{KSHORT[underlayLabel(p.type)]}</span>
                                    <span className="text-xs text-slate-400 truncate">{p.underlay.product || underlayDefault}</span>
                                  </div>
                                )}
                                {offCats.map((cat) => {
                                  const jobA = p.attached?.[cat.id] || { checked: false, product: "", manual: "" };
                                  const names = offeredAttached(settings.catalog, cat.id);
                                  const opts = jobA.product && !names.includes(jobA.product) ? [jobA.product, ...names] : names;
                                  const def = resolveMaterialDefault(names, jobA.product, cat.default);
                                  const A = getAttached(p, wSet, cat);
                                  const pf = settings.attached?.[cat.id]?.[jobA.product];
                                  const aUnit = A ? A.unit : pf?.unit || "";
                                  const covEx = cat.math === "coverage" && p.qtyType === "sqft" && num(p.qty) > 0 && num(pf?.coverage) > 0 ? num(p.qty) * wasteFor(p, wSet) / num(pf.coverage) : null;
                                  const setA = (patch) => updProduct(a.id, p.id, { attached: { ...p.attached, [cat.id]: { ...jobA, ...patch } } });
                                  const toggleOn = () => setA({ checked: true, product: jobA.product || def, manual: cat.math === "manual" ? (jobA.manual || "1") : jobA.manual });
                                  return jobA.checked ? (
                                    <div key={cat.id} className="px-2.5 py-1.5" style={{ background: rowTint }}>
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                                        <button tabIndex={-1} onClick={() => setA({ checked: false })} title={`Remove ${cat.name.toLowerCase()}`} className="ft-mat-toggle w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: accent, color: "var(--ft-type-ink)" }}><Check size={12} /></button>
                                        <span className="text-sm font-medium">{cat.name}</span>
                                        <div className="order-1 md:order-none basis-full md:basis-0 md:grow min-w-0 flex flex-wrap items-center gap-1.5">
                                          {names.length > 0 || jobA.product ? (
                                            <FitSelect sm value={jobA.product} display={jobA.product || "Select…"} onChange={(e) => setA({ product: e.target.value })}>{!jobA.product && <option value="">Select…</option>}{opts.map((n) => <option key={n} value={n}>{n}</option>)}</FitSelect>
                                          ) : (
                                            <span className="text-amber-500 text-xs">No {cat.name.toLowerCase()} products for {TLBL[p.type]} yet — add them in Settings.</span>
                                          )}
                                          {pf?.sku && <span className="ft-mono text-[10px] text-slate-400 shrink-0">{pf.sku}</span>}
                                        </div>
                                        <span className="ml-auto flex items-center gap-1 text-sm shrink-0" style={{ color: accent }}>{covEx != null && <span className="text-slate-400 text-xs whitespace-nowrap">{covEx.toFixed(2)} →</span>}<input tabIndex={-1} type="number" value={cat.math === "manual" ? jobA.manual : (A ? String(A.order) : "")} onChange={(e) => setA({ manual: e.target.value })} placeholder={cat.math === "manual" ? "qty" : "—"} title={cat.math === "manual" ? "Quantity to order" : "Total — type to override the calculated amount"} className="!w-12 text-right font-semibold rounded border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5 ft-field" /><span className="font-semibold">{aUnit}</span></span>
                                        {cat.math === "coverage" && !A && jobA.product && <div className="order-last basis-full text-xs text-amber-500">Enter Sq Ft + a coverage for this product to calculate, or type a total above.</div>}
                                      </div>
                                    </div>
                                  ) : (
                                    <div key={cat.id} className="px-2.5 py-1 flex items-center gap-2">
                                      <button tabIndex={-1} onClick={toggleOn} title={`Add ${cat.name.toLowerCase()}`} className="ft-mat-toggle w-5 h-5 rounded shrink-0 border border-slate-300 ft-field hover:border-indigo-500" />
                                      <span className="text-sm text-slate-500">{cat.name}</span>
                                      <span className="text-xs text-slate-400 truncate">{jobA.product || def}</span>
                                    </div>
                                  );
                                })}
                              </div>
                              {noteInput}
                              </div>
                              </>
                            )}
                            {(stripMats.length > 0 || warns.length > 0) && (
                              <div style={{ background: rowTint, width: "calc(100% - 44px)", padding: "4px 8px 7px 26px" }}>
                              <button onClick={openMats} className="flex items-center flex-wrap text-left" style={{ width: "100%", padding: "4px 7px", columnGap: 12, rowGap: 3, fontSize: 9.5, color: "var(--ft-muted)", background: rowTint, border: "1px solid var(--ft-border)" }} title="Materials — click to edit">
                                {stripMats.map((m, i) => (
                                  <span key={i} className="inline-flex items-center" style={{ gap: 4 }}>
                                    <span style={{ fontWeight: 700, color: accent }}>{KSHORT[m.kind] || m.kind}</span>{m.order > 0 ? ` ${m.order}` : ""} · {m.kind === "Caulk" ? "Matching caulk" : m.name}{m.spec && m.kind !== "Caulk" ? <> — <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: 999, background: "#C9B79D", border: "1px solid #B3A38D", display: m.kind === "Grout" ? "inline-block" : "none" }} /> {m.spec}</> : ""}{m.detail ? <span style={{ color: "var(--ft-faint)" }}> · {m.detail}</span> : ""}
                                  </span>
                                ))}
                                {warns.map((w) => (
                                  <span key={w} className="ft-warn-orange inline-flex items-center font-semibold" style={{ gap: 4 }}>
                                    <AlertTriangle size={10} /> {warnLabel(w)} — not calculating
                                  </span>
                                ))}
                                <span className="flex-1" />
                                {matsCost > 0 && <span className="ft-mono" style={{ fontSize: 9, color: "var(--ft-muted)" }}>+ {money(matsCost)}</span>}
                              </button>
                              {p.note ? noteInput : null}
                              </div>
                            )}
                            {stripMats.length === 0 && warns.length === 0 && !hasMats && addables.length > 0 && (
                              <div style={{ background: rowTint, width: "calc(100% - 44px)", padding: "4px 8px 7px 26px" }}>
                              <button onClick={openMats} className="ft-noprint flex items-center text-left" style={{ width: "100%", padding: "4px 7px", fontSize: 9.5, color: "var(--ft-muted)", border: "1px dashed var(--ft-border)" }} title="Materials — click to choose">
                                ＋ {addables.join(" · ")}…
                              </button>
                              {p.note ? noteInput : null}
                              </div>
                            )}
                            {stripMats.length === 0 && warns.length === 0 && (hasMats || addables.length === 0) && p.note && (
                              <div className="flex items-center" style={{ padding: "1px 12px 4px 26px" }}>
                                {noteInput}
                              </div>
                            )}
                            </div>
                            )}
                            </>)}
                          </div>
                        );
                      })}
                      {drag?.to?.aid === a.id && <div className="absolute left-1 right-1 h-1.5 rounded-full bg-indigo-600 pointer-events-none" style={{ top: drag.to.y, marginTop: 0 }} />}
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Mobile gets its + Area in the bottom add bar instead. */}
              {isWide && sel.categories.length > 0 && (
                <button onClick={addArea} className="ft-noprint mt-4 w-full flex items-center justify-center gap-1.5 text-sm font-semibold rounded-lg border border-dashed border-slate-300 py-2.5 text-slate-500 hover:border-indigo-300 hover:text-indigo-700 transition"><Plus size={15} /> Add area</button>
              )}

              {(totalSqft > 0 || hasMat || miscCost > 0) && (
                <div className="mt-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex justify-between items-center gap-3" style={{ background: "var(--ft-band)", padding: "10px 16px" }}>
                    <span className="ft-serif min-w-0 truncate" style={{ fontSize: 20 }}>Materials estimate</span>
                    {materialsCost > 0 && <span className="ft-mono shrink-0" style={{ fontSize: 10.5 }}>{money(materialsCost)} materials</span>}
                  </div>
                  <div style={{ padding: 16, display: "grid", gap: isWide ? 24 : 20, gridTemplateColumns: isWide ? "minmax(0,1fr) 15rem" : "1fr" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(165px,1fr))", columnGap: 24, rowGap: 20, alignContent: "start" }}>
                    <div>
                      <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>Grout</div>
                      {gList.length + bList.length + cList.length === 0 ? <div className="text-sm text-slate-400">—</div> : [...gList, ...bList.map((b) => ({ product: b.name, sku: b.sku, color: "—", order: b.order, unit: b.unit, cost: b.cost, price: b.price, pending: false })), ...cList.map((c) => ({ ...c, product: `${c.product} caulk` }))].map((g, i) => (
                        <div key={"g" + i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
                          <span className="font-medium min-w-0">{g.product}{g.color !== "—" && <span className="text-slate-500 font-normal"> · {g.color}</span>}{g.sku && <span className="ft-mono block font-normal" style={{ fontSize: 9.5, color: "var(--ft-faint)" }}>{g.sku}</span>}</span>
                          <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{g.pending ? "—" : <>{g.order} {g.unit}</>}{g.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(g.cost)}</span> : g.pending && g.price > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(g.price)}/{u1(1, g.unit)}</span> : null}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>Mortar</div>
                      {mList.length === 0 ? <div className="text-sm text-slate-400">—</div> : mList.map((m, i) => (
                        <div key={"m" + i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
                          <span className="font-medium min-w-0">{m.product}{m.sku && <span className="ft-mono block font-normal" style={{ fontSize: 9.5, color: "var(--ft-faint)" }}>{m.sku}</span>}</span>
                          <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{m.pending ? "—" : <>{m.order} {m.unit}</>}{m.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(m.cost)}</span> : m.pending && m.price > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(m.price)}/{u1(1, m.unit)}</span> : null}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>Underlayment</div>
                      {uList.length === 0 ? <div className="text-sm text-slate-400">—</div> : uList.map((u, i) => (
                        <div key={"u" + i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
                          <span className="font-medium min-w-0">{u.product}{u.sku && <span className="ft-mono block font-normal" style={{ fontSize: 9.5, color: "var(--ft-faint)" }}>{u.sku}</span>}</span>
                          <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{u.pending ? "—" : <>{u.order} {u.unit}</>}{u.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(u.cost)}</span> : u.pending && u.price > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(u.price)}/{u1(1, u.unit)}</span> : null}</span>
                        </div>
                      ))}
                    </div>
                    {aByCat.map(({ cat, rows }) => (
                      <div key={cat.id}>
                        <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", borderBottom: "1px solid var(--ft-row-line)", paddingBottom: 4, marginBottom: 8 }}>{cat.name}</div>
                        {rows.map((r, i) => (
                          <div key={"x" + i} className="flex justify-between gap-2.5 py-1" style={{ fontSize: 12 }}>
                            <span className="font-medium min-w-0">{r.product}{r.sku && <span className="ft-mono block font-normal" style={{ fontSize: 9.5, color: "var(--ft-faint)" }}>{r.sku}</span>}</span>
                            <span className="ft-mono text-slate-500 whitespace-nowrap text-right" style={{ fontSize: 11 }}>{r.order > 0 ? <>{r.order} {r.unit}</> : "—"}{r.cost > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(r.cost)}</span> : r.order === 0 && r.price > 0 ? <span className="block" style={{ fontSize: 10, color: "var(--ft-faint)" }}>{money(r.price)}/{u1(1, r.unit)}</span> : null}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    </div>
                    <div style={{ background: "var(--ft-tint)", border: "1px solid var(--ft-border)", borderRadius: 8, padding: "12px 14px", alignSelf: "start" }}>
                      <div className="uppercase" style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".2em", color: "var(--ft-brand-deep)", marginBottom: 8 }}>Order summary</div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Flooring</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(flooringPrice)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Grout &amp; caulk</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(groutCost + baseCost + caulkCost)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Mortar</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(mortarCost)}</span></div>
                        {underlayCost > 0 && <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Underlayment</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(underlayCost)}</span></div>}
                        {aByCat.map(({ cat, rows }) => { const c = rows.reduce((t, r) => t + r.cost, 0); return c > 0 ? <div key={cat.id} className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>{cat.name}</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(c)}</span></div> : null; })}
                        {miscCost > 0 && <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 12 }}>Miscellaneous</span><span className="ft-mono" style={{ fontSize: 12 }}>{money(miscCost)}</span></div>}
                        <div className="flex justify-between items-baseline" style={{ marginTop: 4, paddingTop: 10, borderTop: "2px solid var(--ft-text)" }}><span style={{ fontSize: 13, fontWeight: 700 }}>Total</span><span className="ft-serif" style={{ fontSize: 26, lineHeight: 1 }}>{money(grandTotal)}</span></div>
                        <MarginLine margin={margin} show={showMargin} onToggle={() => setShowMargin((v) => !v)} />
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--ft-faint)", marginTop: 10 }}>{wasteNote(jobWaste) ? `Figures include ${wasteNote(jobWaste)}. ` : ""}Verify before ordering.</div>
                    </div>
                  </div>
                </div>
              )}
              </div>
              {viewTab === "preview" && (
                <div className="rounded-lg py-6 px-3 md:px-6" style={{ background: "color-mix(in oklab, var(--ft-text) 6%, var(--ft-cream))" }}>
                  <div className="ft-light bg-white text-black rounded-sm shadow-lg mx-auto" style={{ maxWidth: 780, padding: "clamp(18px,3vw,38px)" }}>
                    {renderEstimatePaper()}
                  </div>
                  <div className="text-center mt-4">
                    <button onClick={() => setPrintMode("estimate")} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="inline-flex items-center gap-1.5 text-sm rounded-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 font-semibold"><Printer size={15} /> Print</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Mobile add bar (mobile shell 2026-07-16): + Product follows the
            area in view (activeAreaId); Print wears the tier color like the
            desktop header buttons. Sits under <main> in the flex column, so
            it never overlaps content and stays locked to the bottom whenever
            a project is open — on the preview tab too, where Area/Product
            first hop back to the edit view. While a bottom sheet is up the
            bar slides down out of the way and returns when it closes. */}
        {!isWide && sel && sel._full && (() => {
          const cur = sel.categories.find((a) => a.id === activeAreaId) || sel.categories[0];
          const sheetUp = projSheet || !!rowSheet;
          return (
            <div className={`ft-noprint flex gap-2 px-3 pt-2.5 ft-rail border-t border-slate-200 transition-transform duration-200 ${sheetUp ? "translate-y-full" : ""}`} style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
              <button onClick={() => { setViewTab("edit"); addArea(); }} className="h-[38px] shrink-0 flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-[12.5px] font-bold"><Plus size={14} /> Area</button>
              <button onClick={() => { setViewTab("edit"); mobileAddProduct(); }} className="h-[38px] flex-1 min-w-0 flex items-center justify-center gap-1 rounded-md text-[12.5px] font-bold" style={{ background: "var(--ft-text)", color: "var(--ft-cream)" }}>
                <Plus size={14} className="shrink-0" /> Product{cur ? <span className="truncate opacity-75 font-semibold">&nbsp;· {areaLabel(cur, sel.categories.indexOf(cur))}</span> : null}
              </button>
              <button onClick={() => setPrintMode("estimate")} style={TIER_COLOR[sel.priceTier] ? { background: TIER_COLOR[sel.priceTier].main } : undefined} className="h-[38px] shrink-0 flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 text-[12.5px] font-bold"><Printer size={14} /> Print</button>
            </div>
          );
        })()}
      </div>

      {/* PRINT VIEW — the print buttons pick the layout: estimate (default, also Ctrl+P) or order sheet */}
      <div className="ft-light hidden print:block text-black p-2">
        {sel && sel._full && (printMode === "order" ? (
          <div>
            <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-3">
              <div className="font-bold text-xl">Order sheet</div>
              <div className="text-sm">{sel.name} · {new Date().toLocaleDateString()}</div>
            </div>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="ft-eyebrow text-[8.5px] text-slate-500 border-b border-slate-400">
                  <th className="w-6 py-1" />
                  <th className="text-left font-semibold py-1 pr-2">Item</th>
                  <th className="text-left font-semibold py-1 pr-2">SKU</th>
                  <th className="text-left font-semibold py-1 pr-2">Area</th>
                  <th className="text-right font-semibold py-1">Order</th>
                </tr>
              </thead>
              <tbody>
                {sel.categories.flatMap((a, ai) => a.products.filter((p) => !rowBlank(p)).map((p) => { const c = printProduct(p, wSet); return (
                  <tr key={p.id} className="border-b border-slate-200 align-baseline">
                    <td className="py-1.5 text-center text-slate-400">☐</td>
                    <td className="py-1.5 pr-2"><b>{p.brandColor || TLBL[p.type]}</b> <span className="text-slate-500">{[p.brandColor ? TLBL[p.type] : "", c.size].filter(Boolean).join(", ")}</span></td>
                    <td className="py-1.5 pr-2 ft-mono text-[11px]">{p.sku}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{areaLabel(a, ai)}</td>
                    <td className="py-1.5 text-right font-semibold whitespace-nowrap">{c.qtyText}{c.C && c.C.order > 0 && <> = {sf1(c.orderedSf)} sf<span className="text-slate-400 font-normal text-[10.5px]"> ({c.C.exact.toFixed(2)})</span></>}</td>
                  </tr>
                ); }))}
                {matLines.map((m, i) => (
                  <tr key={"mat" + i} className="border-b border-slate-200 align-baseline">
                    <td className="py-1.5 text-center text-slate-400">☐</td>
                    <td className="py-1.5 pr-2">{m.product} <span className="text-slate-400 text-[10.5px]">{m.kind}</span></td>
                    <td className="py-1.5 pr-2 ft-mono text-[11px]">{m.sku || ""}</td>
                    <td className="py-1.5 pr-2 text-slate-500">all areas</td>
                    <td className="py-1.5 text-right font-semibold whitespace-nowrap">{m.order} {m.unit} <span className="text-slate-400 font-normal text-[10.5px]">({m.exact.toFixed(2)})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs mt-3 text-slate-600">Quantities and prices are estimates{wasteNote(jobWaste) ? `, incl. ${wasteNote(jobWaste)}` : ""}. Confirm against product specs and final measurements before ordering.</div>
          </div>
        ) : renderEstimatePaper())}
      </div>

      {/* Settings — PC-first workspace (issue 007); all writes still flow
          through setSettings / the import + backup handlers. */}
      {showSettings && (
        <LazyBoundary>
        <Suspense fallback={null}>
        <SettingsWorkspace onClose={() => setShowSettings(false)}
          settings={settings} setSettings={setSettings} stock={stock} stockReady={stockReady} gFamilies={gFamilies}
          importing={importing} importPriceBook={importPriceBook} importStockFile={importStockFile} pbRef={pbRef}
          exportBackup={exportBackup} importBackup={importBackup} fileRef={fileRef}
          inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} theme={theme} setTheme={setTheme}
          profile={profile} saveProfile={saveProfile} user={user}
          books={books} addBook={addBook} updateBook={updateBook} delBook={delBook} loadBookItems={loadBookItems} applyBookImport={applyBookImport}
          loadBookVersions={loadBookVersions} loadBookVersionSnapshot={loadBookVersionSnapshot} pinBookVersion={pinBookVersion} updateBookItem={updateBookItem} setBookItemsDisabled={setBookItemsDisabled} reviewBookItemFlags={reviewBookItemFlags} setStockItemsDisabled={setStockItemsDisabled} rollbackStock={rollbackStock} />
        </Suspense>
        </LazyBoundary>
      )}

      {showApps && (
        <LazyBoundary>
        <Suspense fallback={null}>
        <AppsWorkspace
          onClose={() => setShowApps(false)}
          stock={stock}
          labels={labels}
          presets={settings.apps?.labels?.presets || []}
          onAddLabel={addLabel}
          onAddLabelsBulk={addLabelsBulk}
          onUpdateLabel={updateLabel}
          onDeleteLabel={delLabel}
          onSavePreset={saveLabelPreset}
          sheoga={{
            markupDefault: normPricing(settings.pricing).sheogaMarkupPct,
            ventMarkupDefault: normPricing(settings.pricing).sheogaVentMarkupPct,
            currentName: sel?._full ? (sel.name || "Untitled project") : null,
            addToCurrent: (lines) => { if (!lines?.length || !sel) return; updateProject(sel.id, { categories: applySheogaToFirstArea(sel.categories, lines) }); setShowApps(false); },
            addToNew: (lines) => { if (!lines?.length) return; createQuickWithSheoga(lines); setShowApps(false); },
          }}
        />
        </Suspense>
        </LazyBoundary>
      )}

      {showTodos && (
        <Modal onClose={() => setShowTodos(false)} title="Issues & To-Do">
          <TeamTodos todos={todos} onAdd={addTodo} onToggle={toggleTodo} onDelete={delTodo} onReorder={reorderTodos} onClearDone={clearDoneTodos} inp={inp} />
        </Modal>
      )}

      {/* Sheoga vendor configurator (issue 023) — opened from a row's search
          ("she" pins the vendor row) or its "Sheoga — reconfigure" chip. Job
          size seeds from the row's typed footage; markup default from Settings
          → Price book. Add snapshots lineItems() onto the row (ADR 0003). */}
      {sheogaPop && sel && (() => {
        const row = sel.categories.find((x) => x.id === sheogaPop.aid)?.products.find((x) => x.id === sheogaPop.pid);
        if (!row) { return null; }
        return (
          <LazyBoundary>
          <Suspense fallback={null}>
          <SheogaConfigurator seed={sheogaPop.seed}
            initialSf={num(row.qty) > 0 && row.qtyType === "sqft" ? num(row.qty) : 0}
            markupDefault={normPricing(settings.pricing).sheogaMarkupPct}
            ventMarkupDefault={normPricing(settings.pricing).sheogaVentMarkupPct}
            basket={sel.sheogaBasket || []}
            onBasketChange={(next) => updateProject(sel.id, { sheogaBasket: next })}
            areaName={sel.categories.find((x) => x.id === sheogaPop.aid)?.name || "this area"}
            onMove={(lines) => addSheogaLines(sheogaPop.aid, sheogaPop.pid, lines)}
            onMoveEntries={(lines, nextBasket) => updateProject(sel.id, { categories: appendSheogaLines(sel.categories, sheogaPop.aid, lines), sheogaBasket: nextBasket })}
            onAdd={(lines) => { addSheogaLines(sheogaPop.aid, sheogaPop.pid, lines); setSheogaPop(null); setFocusQty(sheogaPop.pid); }}
            onClose={() => setSheogaPop(null)} />
          </Suspense>
          </LazyBoundary>
        );
      })()}

      {showOrderCopy && sel && sel._full && (() => {
        // Order entry reads RETAIL on every tier except Employee, which carries
        // through (spec 2026-07-16) — the salesperson keys builder/sale discounts
        // into the vendor order by hand.
        const oeProj = tv.tier === "employee" ? tv.proj : sel;
        const descLimit = normPricing(settings.pricing).descLimit;
        const rows = [];
        (oeProj.categories || []).forEach((a, ai) => a.products.forEach((p) => { if (!rowBlank(p)) rows.push(orderEntryRow(p, wSet, areaLabel(a, ai), descLimit)); }));
        const mats = matLines.map((m, i) => ({ id: "mat" + i, sku: m.sku || "", qty: m.order, qtyText: `${m.order} ${m.unit}`, name: m.product, kind: m.kind }));
        return <OrderEntryPanel name={sel.name} special={rows.filter((r) => r.special)} stock={[...rows.filter((r) => !r.special), ...mats]} descLimit={descLimit} onClose={() => setShowOrderCopy(false)} />;
      })()}

      {custModal && (() => {
        const c = data.people.find((x) => x.id === custModal);
        if (!c) return null;
        const projs = projectsOf(c.id);
        return (
          <Modal onClose={() => setCustModal(null)} title={c.name || "Customer"}>
            <div className="space-y-3">
              <div><label className={lbl}>Name</label><input value={c.name} onChange={(e) => updatePerson(c.id, { name: e.target.value })} placeholder="Customer name" className={inp} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>Phone</label><input value={c.phone} onChange={(e) => updatePerson(c.id, { phone: e.target.value })} className={inp} /></div>
                <div><label className={lbl}>Email</label><input value={c.email} onChange={(e) => updatePerson(c.id, { email: e.target.value })} className={inp} /></div>
              </div>
              <div><label className={lbl}>Mailing address</label><input value={c.address} onChange={(e) => updatePerson(c.id, { address: e.target.value })} className={inp} /></div>
              <div><label className={lbl}>Builder</label><BuilderCombo value={c.builderId} builders={data.builders} inp={inp} onSelect={(bid) => updatePerson(c.id, { builderId: bid })} onAddBuilder={(name) => addBuilderFor(c.id, name)} /></div>
              <div><label className={lbl}>Customer notes</label><textarea value={c.notes} onChange={(e) => updatePerson(c.id, { notes: e.target.value })} rows={2} className={inp} /></div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className={lbl + " mb-0"}>Projects ({projs.length})</label>
                <button onClick={() => { setCustModal(null); addProject(c.id); }} className="flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-indigo-700"><Plus size={13} /> New project</button>
              </div>
              {projs.length === 0 ? <div className="text-sm text-slate-400 rounded-md border border-dashed border-slate-200 px-3 py-2.5">No projects yet.</div> : (
                <div className="rounded-md border border-slate-200 divide-y divide-slate-100">
                  {projs.map((p) => (
                    <button key={p.id} onClick={() => { setCustModal(null); pickProject(p.id); }} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                      <FileText size={13} className="text-slate-300 shrink-0" />
                      <span className="text-sm truncate flex-1">{p.name || "Untitled project"}</span>
                      {p.updatedAt && <span className="ft-mono text-[11px] text-slate-400 shrink-0">{fmtAgo(p.updatedAt)}</span>}
                      <ChevronRight size={14} className="text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => { setCustModal(null); setConfirm({ kind: "person", id: c.id }); }} className="flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-red-500"><Trash2 size={14} /> Delete customer</button>
              <button onClick={() => setCustModal(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Done</button>
            </div>
          </Modal>
        );
      })()}

      {promoteId !== null && (() => {
        const proj = data.projects.find((p) => p.id === promoteId);
        if (!proj) return null;
        const term = promoteQ.trim();
        const tl = term.toLowerCase();
        const list = (term ? data.people.filter((c) => [c.name, c.phone, c.email, c.address].some((f) => (f || "").toLowerCase().includes(tl))) : sortPeople(data.people)).slice(0, 40);
        const m = matchName(data.people, term);
        const exact = m && m.kind === "exact";
        const close = () => { setPromoteId(null); setPromoteQ(""); };
        return (
          <Modal onClose={close} title="File under customer">
            <p className="text-sm text-slate-500 mb-3">Filing <b>{proj.name || "this quote"}</b> under a customer turns it into a normal job{proj.quick ? " — it leaves Quick Prices and starts keeping versions" : ""}.</p>
            <input autoFocus value={promoteQ} onChange={(e) => setPromoteQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") close(); if (e.key === "Enter" && term && !exact) promoteToNewCustomer(promoteId, term); }}
              placeholder="Search customers, or type a new name…" className={inp} />
            {list.length > 0 && (
              <div className="mt-3 rounded-md border border-slate-200 divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {list.map((c) => {
                  const n = projectsOf(c.id).length;
                  return (
                    <button key={c.id} onClick={() => promoteProject(promoteId, c.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                      <span className="ft-item-name text-sm font-medium truncate flex-1">{c.name || "Unnamed customer"}</span>
                      <span className="text-[11px] text-slate-400 shrink-0">{n} project{n === 1 ? "" : "s"}</span>
                      <ChevronRight size={14} className="text-slate-300 shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
            {term && !exact && (
              <button onClick={() => promoteToNewCustomer(promoteId, term)} className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-md bg-indigo-600 text-white px-3 py-2 text-sm font-semibold hover:bg-indigo-700"><Plus size={14} /> Create “{term}” &amp; file here</button>
            )}
            {term && m && !exact && <div className="mt-2 text-[12px] text-slate-400 px-1">Did you mean <b>{m.item.name}</b>? Pick it above to avoid a duplicate.</div>}
            {!term && list.length === 0 && <div className="mt-3 text-sm text-slate-400 rounded-md border border-dashed border-slate-200 px-3 py-2.5">No customers yet — type a name above to create one.</div>}
            <div className="flex justify-end mt-4"><button onClick={close} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button></div>
          </Modal>
        );
      })()}

      {importPreview && (() => {
        const { parsed, diff, warnings, sync, onDone } = importPreview;
        const total = diff.added.length + diff.changed.length + diff.missing.length;
        const money2 = (n) => (n == null ? "—" : money(n));
        const itemPrice = (it) => (it.priceSqft != null && it.type ? it.priceSqft : it.price);
        // Cancelling still advances the drop router's queue, but reports applied=false so a pooled file isn't dropped as if imported.
        const closePreview = () => { setImportPreview(null); onDone?.(false); };
        return (
          <Modal onClose={closePreview} title="Import price book">
            <p className="text-sm text-slate-600 mb-3"><b>{parsed.length}</b> items read · <b>{diff.added.length}</b> new · <b>{diff.changed.length}</b> changed · <b>{diff.missing.length}</b> no longer listed · {diff.unchanged.length} unchanged</p>
            {total === 0 && sync.changes.length === 0 && <p className="text-sm text-slate-400 mb-3">Everything already matches the current stock list — nothing to apply.</p>}
            {diff.changed.length > 0 && (
              <div className="mb-3">
                <label className={lbl}>Changed items</label>
                <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100 text-xs">
                  {diff.changed.slice(0, 60).map(({ item, prev, fields }) => (
                    <div key={item.sku} className="px-2.5 py-1.5 flex items-baseline gap-2">
                      <span className="ft-mono text-slate-400 shrink-0">{item.sku}</span>
                      <span className="truncate flex-1">{item.description}</span>
                      <span className="shrink-0 ft-mono">{fields.includes("price") || fields.includes("priceSqft") ? <>{money2(itemPrice(prev))} → <b>{money2(itemPrice(item))}</b></> : <span className="text-slate-400">{fields.join(", ") || "re-activated"}</span>}</span>
                    </div>
                  ))}
                  {diff.changed.length > 60 && <div className="px-2.5 py-1.5 text-slate-400">…and {diff.changed.length - 60} more</div>}
                </div>
              </div>
            )}
            {diff.missing.length > 0 && (
              <div className="mb-3">
                <label className={lbl}>No longer listed (marked inactive, never deleted)</label>
                <div className="text-xs text-slate-500 max-h-24 overflow-y-auto rounded-md border border-slate-200 px-2.5 py-1.5">{diff.missing.slice(0, 30).map((it) => it.sku).join(", ")}{diff.missing.length > 30 ? ` …and ${diff.missing.length - 30} more` : ""}</div>
              </div>
            )}
            {sync.changes.length > 0 && (
              <div className="mb-3">
                <label className={lbl}>Catalog price updates (grout / mortar / underlayment)</label>
                <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100 text-xs">
                  {sync.changes.map((c) => <div key={c.name} className="px-2.5 py-1.5 flex items-baseline gap-2"><span className="truncate flex-1">{c.name}</span><span className="shrink-0 ft-mono">{money(c.from)} → <b>{money(c.to)}</b></span><span className="ft-mono text-slate-400 shrink-0">SKU {c.sku}</span></div>)}
                </div>
              </div>
            )}
            {warnings.length > 0 && (
              <div className="mb-3">
                <label className={lbl}>Warnings</label>
                <div className="text-xs text-amber-600 space-y-1 max-h-28 overflow-y-auto">{warnings.slice(0, 12).map((w, i) => <div key={i}>{w}</div>)}{warnings.length > 12 && <div>…and {warnings.length - 12} more</div>}</div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={closePreview} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
              <button onClick={applyImport} disabled={total === 0 && sync.changes.length === 0} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">Apply import{total > 0 ? ` — ${diff.added.length} new · ${diff.changed.length} changed · ${diff.missing.length} retired` : ""}</button>
            </div>
          </Modal>
        );
      })()}

      {showVersions && sel && (
        <Modal onClose={() => setShowVersions(false)} title="Saved Versions">
          {(!sel.versions || sel.versions.length === 0) ? <p className="text-sm text-slate-400">No versions yet. Use "Version" to snapshot the current selections.</p> : (
            <div className="space-y-2">{sel.versions.map((v) => (<div key={v.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"><div className="flex-1 min-w-0"><div className="text-sm font-medium flex items-center gap-1.5 truncate">{v.label}{v.auto && <span className="ft-eyebrow text-[8.5px] tracking-[.1em] bg-slate-100 rounded px-1.5 py-0.5 shrink-0">Auto</span>}</div><div className="text-xs text-slate-400">{new Date(v.savedAt).toLocaleString()}</div></div><button onClick={() => loadVersion(v)} className="text-sm rounded-lg bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700">Restore</button><button onClick={() => delVersion(v.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={15} /></button></div>))}</div>
          )}
          <p className="text-xs text-slate-400 mt-4">Auto versions are saved when you leave a job after changing its selections — the newest {AUTO_KEEP} are kept. Named versions are kept until you delete them.</p>
        </Modal>
      )}

      {confirm && (confirm.kind === "person" ? (
        <Modal onClose={() => setConfirm(null)} title="Delete customer?">
          <p className="text-sm text-slate-500 mb-4">This removes the customer for everyone. Their projects are kept but become <b>unassigned</b> — reassign them to another customer afterward. Consider a backup export first.</p>
          <div className="flex justify-end gap-2"><button onClick={() => setConfirm(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button><button onClick={() => delPerson(confirm.id)} className="text-sm rounded-lg bg-red-600 text-white px-4 py-2 hover:bg-red-700">Delete</button></div>
        </Modal>
      ) : (
        <Modal onClose={() => setConfirm(null)} title="Delete project?">
          <p className="text-sm text-slate-500 mb-4">This permanently removes the project — with all its selections, versions, and attachments — for everyone. Consider a backup export first.</p>
          <div className="flex justify-end gap-2"><button onClick={() => setConfirm(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button><button onClick={() => delProject(confirm.id)} className="text-sm rounded-lg bg-red-600 text-white px-4 py-2 hover:bg-red-700">Delete</button></div>
        </Modal>
      ))}

      {newCust !== null && (() => {
        const m = matchName(data.people, newCust);
        const create = () => { const c = addPerson(newCust.trim()); setNewCust(null); setCustModal(c.id); return c; };
        const pickExisting = (id) => { setNewCust(null); setOpenCust((s) => ({ ...s, [id]: true })); setCustModal(id); };
        const n = m ? projectsOf(m.item.id).length : 0;
        return (
          <Modal onClose={() => setNewCust(null)} title="New customer">
            <p className="text-sm text-slate-500 mb-3">Type the customer's name. If they already exist, jump straight to them instead of making a duplicate.</p>
            <input autoFocus value={newCust} onChange={(e) => setNewCust(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { if (m) pickExisting(m.item.id); else if (newCust.trim()) create(); } if (e.key === "Escape") setNewCust(null); }}
              placeholder="e.g. Sarah Jones" className={inp} />
            {m && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-800">
                <div className="font-semibold mb-0.5">{m.kind === "exact" ? `A customer named "${m.item.name}" already exists` : `Did you mean "${m.item.name}"?`}</div>
                <div className="text-amber-700">{n} project{n === 1 ? "" : "s"}. Open them instead of creating a duplicate?</div>
                <div className="flex gap-2 mt-2.5 flex-wrap">
                  <button onClick={() => pickExisting(m.item.id)} className="rounded-md bg-amber-600 text-white px-3 py-1.5 text-[13px] font-medium hover:bg-amber-700">Use {m.item.name}</button>
                  <button onClick={create} className="rounded-md border border-amber-300 px-3 py-1.5 text-[13px] hover:bg-amber-100">Create separate customer</button>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setNewCust(null)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
              <button onClick={create} disabled={!newCust.trim()} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-40">Create customer</button>
            </div>
          </Modal>
        );
      })()}

      {toast && <div className="print:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-lg z-50">{toast}</div>}
    </div>
  );
}


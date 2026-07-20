import { Fragment, lazy, Suspense, useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, Trash2, Settings, Save, Printer, ClipboardList, FileText, Download, Upload, X, History, Check, Paperclip, Menu, LogOut, ChevronRight, ChevronDown, ChevronUp, Hand, Pencil, ListTodo, Phone, Mail, MapPin, Building2, StickyNote, Percent, BookOpen, Package, Paintbrush, Layers, Database, Link2, Link2Off, MoreHorizontal, Sun, Moon, Laptop, User, Lock, Pin, RotateCcw, AlertTriangle, Eye, EyeOff, Copy, Star, Tag, Flag, Zap, Folder, Clock, LayoutGrid } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { fetchAllRows } from "./fetchall.js";
import { LIST_SELECT, lightRow, normBook, SHARED_SETTINGS_ID, loadProjects, loadPeople, loadBuilders, loadStock, loadTodos, loadLabels, loadBooks, loadSettingsRow, resolveSharedSettings } from "./bootload.js";
import { bootTrace, traceRows } from "./boottrace.js";
import { normLabel } from "./labels.js";
import { num, ceilQty, wasteFor, projWaste, withProjWaste, normalizeSettings, withDerived, serializeSettings, groutExact, mortarExact, getGrout, getMortar, groutBaseList, cartonExact, getCarton, getPieceCarton, underlayExact, getUnderlay, getUnderlayInstall, materialWarnings, offeredGrouts, offeredMortars, offeredUnderlayments, resolveMaterialDefault, isOffered, setCatalogDefault, isDuplicateName, addCompany, addProduct, removeProduct, removeCompany, renameProduct, addCategory, updateCategory, removeCategory, isDuplicateCategoryName, isDuplicateAttachedName, offeredAttached, offeredCategories, getAttached, attachedList } from "./catalog.js";
import { normStockItem, stockData, findStock, stockPatch, stockDrift, diffStock, syncCatalogPrices, stockCompanionBase, stockBaseVariant, stockBaseCompanion, groutFamilies, groutColorItem, groutCaulkItem, groutSnapshotPatch, priceUnitOf, orderUnitOf } from "./stock.js";
import { parsePriceBook, parseMapped, mappedSkuRe, guessHeaderRow, bestDataSheet, columnsFromHeader, detectVtcEft } from "./pricebook.js";
import { computeFingerprint, fileFormat, routeFile, bundleByBook, sourceSlot, mergeSources, missingSources, stepPayloads, declareManualSource, undeclareManualSource } from "./dropimport.js";
import { parseVendorLink, entryProblems, entryFileName, bookmarkletSource, captureHandoff, clearHandoff, captureHandoffSession, clearHandoffSession, poolSession, sheetRecord, recordKey, applySesid, mergeEntries, newGroup, moveSheetInGroups, sheetMatchesGroup, rememberIntoGroups, setSheetBook, stripHandoffMark, decodeHandoff, decodeHandoffSession, poolPendingReview, pendingForSheet, sheetsForBook } from "./vendorfetch.js";
import { parsePdfPages } from "./pdfbook.js";
import { isManningtonCartons, parseManningtonPages } from "./manningtonbook.js";
import { parseOvf } from "./ovfbook.js";
import { parseMirage } from "./miragebook.js";
import { normBookItem, bookItemData, diffBookItems, pricedItem, markupGroups, orderPatch, orderDrift, editedInDiff, bookStaleness, DEFAULT_STALE_DAYS, specialOrderMargin, orderFloorFirst, rowCostSqft, itemProblems, supersedePairs, itemFlags, flagReviewBySku } from "./orderbook.js";
import { OrderEntryPanel } from "./orderentry.jsx";
import { isSpecialOrder, orderCopyText, orderDescription } from "./orderentry.js";
import { normTier, normPrintPricing, tierView, tierUnitPrice, employeeNoCost, tierTag, normPricing } from "./pricing.js";
import { normName, matchName } from "./names.js";
import { expand } from "./synonyms.js";
import { seedFromQuery as sheogaSeed, normBasketEntry, multiWidthLineItems } from "./sheoga.js";
import { STOCK_LOADING_MSG, STOCK_FAILED_MSG, skuSearchable, TYPES, TLBL, underlayLabel, TYPE_ACCENT, ROW_WASH, TOTAL_WASH, JOINTS, THICK, colorsFor, ATT_BUCKET, TIER_COLOR, TIER_LONG, tierBadgeText, AUTO_KEEP, QUICK_SWEEP_DAYS, BOOK_VERSION_KEEP, STOCK_BOOK_ID } from "./uiconst.js";
import { uid, money, sf1, miscQty, blobToDataURL, dataURLToBlob, wasteNote, wasteMeta, newProduct, newArea, areaLabel, rowBlank, catSig, newProject, newPerson, newBuilder, normA, normC, personData } from "./model.js";
import { lineTotal, printProduct, orderLineCost, printAreaFloor, PRINT_KINDS, PRINT_COLS, PRINT_COLS_UNIT, PRINT_COLS_NONE, KSHORT, ESTIMATE_PRINT_LAYOUT, u1, printMatList, orderEntryRow } from "./print.js";
import { readXlsxSheets, readPdfPages } from "./fileread.js";
import { LazyBoundary, FitSelect, DotMenu, BuilderCombo, MetaChip, SalespersonPop, SegBar, WasteBar, FilesPop, ThemeSwitch, MarginLine, Modal } from "./widgets.jsx";
import { SkuPicker, StockSearch, FamilySearch, SKU_SHOW } from "./search.jsx";
import { TypeSelect, GRID_COLS, GridPriceCell, GridSizeInput, GridProductBox, GridOmniSearch } from "./grid.jsx";
import { MobileSheet, MobileProductRow, MobileRowSheet } from "./mobile.jsx";
// Heavy secondary surfaces ship as their own chunks (ADR 0026 rule 5) so
// feature work on them stops growing the boot download. Both are conditional
// overlays; a null Suspense fallback reads as normal open latency.
const SheogaConfigurator = lazy(() => import("./SheogaConfigurator.jsx"));
const AppsWorkspace = lazy(() => import("./AppsWorkspace.jsx").then((m) => ({ default: m.AppsWorkspace })));

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
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const pbRef = useRef(null);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState("");
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
  const [saveOk, setSaveOk] = useState(false);
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
  const saveOkTimer = useRef(null);
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
        trace.span("books", () => loadBooks(supabase)).then(setBooks, () => { }),
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

  const ping = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const flashSaved = () => { if (saveOkTimer.current) clearTimeout(saveOkTimer.current); setSaveOk(true); saveOkTimer.current = setTimeout(() => setSaveOk(false), 2000); };

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
        <SettingsWorkspace onClose={() => setShowSettings(false)}
          settings={settings} setSettings={setSettings} stock={stock} stockReady={stockReady} gFamilies={gFamilies}
          importing={importing} importPriceBook={importPriceBook} importStockFile={importStockFile} pbRef={pbRef}
          exportBackup={exportBackup} importBackup={importBackup} fileRef={fileRef}
          inp={inp} lbl={lbl} types={TYPES} typeLabels={TLBL} theme={theme} setTheme={setTheme}
          profile={profile} saveProfile={saveProfile} user={user}
          books={books} addBook={addBook} updateBook={updateBook} delBook={delBook} loadBookItems={loadBookItems} applyBookImport={applyBookImport}
          loadBookVersions={loadBookVersions} loadBookVersionSnapshot={loadBookVersionSnapshot} pinBookVersion={pinBookVersion} updateBookItem={updateBookItem} setBookItemsDisabled={setBookItemsDisabled} reviewBookItemFlags={reviewBookItemFlags} setStockItemsDisabled={setStockItemsDisabled} rollbackStock={rollbackStock} />
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

// The shared team issue / to-do list (issue 006). Open items are ordered by
// priority — drag the handle to put the most important on top; done items drop
// to a struck-through section below. All writes flow up through the on* props.
function TeamTodos({ todos, onAdd, onToggle, onDelete, onReorder, onClearDone, inp }) {
  const [text, setText] = useState("");
  const [to, setTo] = useState(null); // insertion bar while dragging: { index, y }
  const listRef = useRef(null);
  const open = todos.filter((t) => !t.done).sort((a, b) => a.position - b.position);
  const doneList = todos.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const submit = () => { const v = text.trim(); if (!v) return; onAdd(v); setText(""); };

  // Pointer drag of an open row (mouse + touch): the handle captures the
  // pointer, the row follows vertically, and the other rows' midpoints decide
  // the insertion index. Data is written once, on drop, through onReorder.
  const startDrag = (e, index) => {
    if (e.button != null && e.button !== 0) return;
    const handle = e.currentTarget;
    const row = handle.closest("[data-todo-row]");
    const list = listRef.current;
    if (!row || !list) return;
    e.preventDefault();
    try { handle.setPointerCapture(e.pointerId); } catch (x) { }
    const startY = e.clientY;
    let target = index;
    Object.assign(row.style, { position: "relative", zIndex: 30, scale: "1.02", boxShadow: "0 10px 26px rgba(40,30,20,.18)" });
    document.body.style.userSelect = "none";
    const onMove = (ev) => {
      row.style.translate = `0 ${ev.clientY - startY}px`;
      const rows = [...list.querySelectorAll("[data-todo-row]")].filter((r) => r !== row);
      let idx = 0;
      for (const r of rows) { const rc = r.getBoundingClientRect(); if (ev.clientY > rc.top + rc.height / 2) idx++; }
      if (idx === target) return;
      target = idx;
      if (idx === index) return setTo(null); // dropping back where it came from
      const lr = list.getBoundingClientRect();
      const y = rows.length === 0 ? 0 : idx < rows.length ? rows[idx].getBoundingClientRect().top - lr.top - 5 : rows[rows.length - 1].getBoundingClientRect().bottom - lr.top + 3;
      setTo({ index: idx, y });
    };
    const finish = (commit) => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      document.body.style.userSelect = "";
      Object.assign(row.style, { position: "", zIndex: "", scale: "", boxShadow: "", translate: "" });
      setTo(null);
      if (commit && target !== index) onReorder(index, target);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev) => { if (ev.key === "Escape") finish(false); };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
  };

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Shared with the whole team — anyone can add bugs, feature ideas, or shop reminders. Drag the handle to put the most important on top; check an item off when it's handled.</p>
      <div className="flex gap-2 mb-3">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Add an issue or idea…" className={inp} />
        <button onClick={submit} disabled={!text.trim()} className="shrink-0 flex items-center gap-1 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 disabled:opacity-50"><Plus size={15} /> Add</button>
      </div>
      {open.length === 0 && doneList.length === 0 && <p className="text-sm text-slate-400">Nothing on the list yet. (If new items won't save, run supabase/todos.sql once.)</p>}
      <div ref={listRef} className="relative space-y-1.5">
        {to && <div className="absolute left-1 right-1 h-1 rounded-full bg-indigo-600 pointer-events-none z-10" style={{ top: to.y }} />}
        {open.map((t, i) => (
          <div key={t.id} data-todo-row className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
            <button onPointerDown={(e) => startDrag(e, i)} title="Drag to reorder" className="shrink-0 mt-0.5 -m-1 p-1 rounded touch-none cursor-grab text-slate-300 hover:text-slate-500"><Hand size={14} /></button>
            <button onClick={() => onToggle(t.id)} title="Mark done" className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full border-2 border-slate-300 hover:border-indigo-600 flex items-center justify-center text-transparent hover:text-indigo-600"><Check size={11} strokeWidth={3} /></button>
            <div className="flex-1 min-w-0">
              <div className="text-sm leading-snug break-words">{t.text}</div>
              {(t.createdBy || t.createdAt) && <div className="text-[11px] text-slate-400 mt-0.5">{[t.createdBy, t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ""].filter(Boolean).join(" · ")}</div>}
            </div>
            <button onClick={() => onDelete(t.id)} title="Delete" className="shrink-0 mt-0.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      {doneList.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="ft-eyebrow text-[9px]">Done ({doneList.length})</div>
            <button onClick={onClearDone} className="text-[11px] text-slate-400 hover:text-red-500">Clear done</button>
          </div>
          <div className="space-y-1.5">
            {doneList.map((t) => (
              <div key={t.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                <button onClick={() => onToggle(t.id)} title="Reopen — puts it back on top" className="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700"><Check size={11} strokeWidth={3} /></button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-snug break-words line-through text-slate-400">{t.text}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{[t.createdBy, t.doneAt ? "done " + new Date(t.doneAt).toLocaleDateString() : ""].filter(Boolean).join(" · ")}</div>
                </div>
                <button onClick={() => onDelete(t.id)} title="Delete" className="shrink-0 mt-0.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// The shared grout/mortar catalog editor: a Company → Product tree. Each company
// and product has an enabled checkbox (show/hide for the job dropdowns); a
// product's numbers are shown and editable only while it is enabled, but stay
// stored when off. All edits flow up through onChange(newCatalog).
// The PC-first Settings workspace (issue 007): near-fullscreen, left-nav
// sections, master→detail catalog editing. Pure UI — every write still flows
// through setSettings and the import/backup handlers passed in from App.
// --- Price book library (ADR 0009, Phase 1) ---------------------------------
//
// The Settings "Price book" section grown into a library: the stock workbook
// plus registry books (stock- and order-kind). Order books import via a saved
// column mapping and store a vendor COST; a flat default markup turns that into
// a browse-time selling price (the markup editor and pick snapshot are Phase 2).
// A session-local "hide costs" toggle masks every cost/margin figure for
// over-the-shoulder moments — presentation only, never stored, never printed.

const bookFieldOptions = [
  ["", "— ignore —"], ["sku", "SKU"], ["cost", "Cost"], ["description", "Description"],
  ["mfg", "Manufacturer"], ["productLine", "Product line"], ["color", "Color"], ["style", "Style"],
  ["unit", "Unit (U/M)"], ["priceUnit", "Price unit (cost basis)"], ["orderUnit", "Order unit (No Broken)"],
  ["size", "Size"], ["thickness", "Thickness"], ["sfPerUnit", "SF per carton"], ["pcPerUnit", "Pieces per carton"],
  ["coverage", "Coverage"], ["leadTime", "Lead time"], ["msrp", "MSRP / consumer"], ["brand", "Brand"],
  ["section", "Section"], ["note", "Notes"], ["type", "Flooring type"], ["flag", "Status flag"],
];
const FLAG_SEMANTICS = [["", "— ignore —"], ["discontinued", "Discontinued"], ["freight", "Extra freight"], ["madeToOrder", "Made to order"], ["transitioning", "Transitioning"]];

// guessBookField / guessHeaderRow moved to src/pricebook.js (pure + tested);
// bookFieldOptions / FLAG_SEMANTICS above stay here as UI dropdown lists.

// Amber chip for a stale book (§8.3): last imported longer ago than the
// staleness threshold. A months-old vendor cost list quietly misprices jobs, so
// the age is surfaced wherever the book is named.
function StaleChip({ days }) {
  return (
    <span title={`Last imported ${days} days ago — vendors re-issue cost lists roughly quarterly; re-import to be sure prices are current`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <AlertTriangle size={11} /> Stale · {days}d
    </span>
  );
}

// The multi-file drop router (ADR 0009 PR C). Reads each dropped file once,
// routes it to a book (or the shop workbook), lets the user fix unmatched files,
// then steps through each file's normal import preview one at a time. Registry
// files reuse BookImportWizard (pre-read); the shop workbook reuses the App-level
// stock preview. No new write path — each apply is the book's existing one.
// One book's completeness gap at the routing step (ADR 0025): what it is short
// of, a place to drop it, and what happens if you go ahead without it. Exported
// for the preview harness.
export function GateGap({ book, have, total, missing, onAdd, inp }) {
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

export function ImportRouter({ files, preferTarget, targets, sourceKeys, linkedSlots, onFileDone, books, applyBookImport, updateBook, loadBookItems, importStockFile, onClose, types, typeLabels, inp, lbl, hideCosts }) {
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
      const fp = computeFingerprint(parsed);
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
  const flat = (rows || []).filter((r) => !r.error && r.target && r.target !== "skip");
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

  if (phase === "route") {
    const bookOpts = [["skip", "Skip this file"], ["stock", "Shop workbook (stock)"], ...registryBooks.map((b) => [b.id, b.name || "Untitled"])];
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
            <button onClick={() => { setQi(0); setPhase("run"); }} disabled={!runnable.length} className={"text-sm rounded-lg text-white px-4 py-2 disabled:opacity-50 " + (gaps.length ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700")}>
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

// Vendor sheet fetch (ADR 0019): the bookmarklet (or a pasted link) supplies
// portal price-list links; the Netlify relay fetches each sheet's bytes; the
// results become a File[] handed to the SAME multi-file drop router a
// drag-drop uses, so routing/diff/apply are unchanged.
// --- Vendor sheet fetch (ADR 0019, 0020) ------------------------------------
// The old "Fetch vendor sheets" modal grew into a page (a tab in the Price book
// library): remembered sheets organized into sign-in groups, each re-fetchable
// on demand with per-sheet progress. The fetch engine (relay + retries +
// streamed progress) is factored out so a group's "Re-download all" and a
// single row's re-download share it.

// Prefer the Supabase Edge Function (minutes-long window — a big sheet the
// portal builds on demand can outlast a Netlify function's ceiling); fall back
// to the Netlify relay only when the Edge twin isn't deployed (404) or is
// unreachable. A 5xx from a live Edge Function is retried in place, never
// downgraded to the shorter-window relay.
async function relayVendorFetch(entry, token) {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (base) {
    try {
      const r = await fetch(`${base}/functions/v1/vendor-fetch`, { method: "POST", headers: { authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, "content-type": "application/json" }, body: JSON.stringify(entry) });
      if (r.status !== 404) return r;
    } catch { /* unreachable — fall back */ }
  }
  return fetch("/api/vendor-fetch", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(entry) });
}

// Drain the response, reporting a 0..1 fraction when the portal sends a
// Content-Length. On-demand sheets are often chunked with none — then the bar
// stays indeterminate (fraction reported as null).
async function readSheetBytes(res, onFraction) {
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onFraction(Math.min(0.98, received / total));
  }
  const out = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

// Fetch one sheet through the relay with the portal's on-demand-build retries.
// onProgress gets { value, note } while fetching (value null = indeterminate).
// Resolves to { file } or { error }.
async function runFetch(entry, token, onProgress) {
  let msg = "network error";
  for (let t = 1; t <= 3; t++) {
    onProgress({ value: null, note: t === 1 ? "" : `portal is slow — retry ${t - 1} of 2…` });
    if (t > 1) await new Promise((r) => setTimeout(r, 2500));
    try {
      const res = await relayVendorFetch(entry, token);
      if (res.ok) {
        const bytes = await readSheetBytes(res, (v) => onProgress({ value: v, note: "" }));
        return { file: new File([bytes], entryFileName(entry), { type: "application/vnd.ms-excel" }) };
      }
      let err = "";
      try { err = (await res.json()).error || ""; } catch {}
      if (err === "session-expired") return { error: "portal session expired — paste a freshly opened sheet's link (or click the bookmark again)" };
      msg = err === "vendor-timeout"
        ? "the portal took too long to build this sheet — try again in a minute (it's usually quick the second time), or download it by hand and drop it in"
        : (err || `failed (${res.status})`);
      if (res.status < 500) return { error: msg }; // only slow/server errors are worth retrying
    } catch { msg = "network error"; }
  }
  return { error: msg };
}

// The bookmarklet setup steps (drag-to-bookmarks + copy), shared by the empty
// state and the "Set up one-click fetch" disclosure.
function VendorBookmarklet() {
  const bmSrc = bookmarkletSource();
  const [copied, setCopied] = useState(false);
  return (
    <ol className="text-sm text-slate-600 list-decimal ml-5 space-y-1.5">
      <li>Drag this button to your bookmarks bar:{" "}
        <a ref={(el) => { if (el) el.setAttribute("href", bmSrc); }} onClick={(e) => e.preventDefault()} className="inline-block rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium cursor-grab" title="Drag me to the bookmarks bar">⤓ FloorTrack sheets</a>
        {" "}<button onClick={() => { navigator.clipboard?.writeText(bmSrc).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} className="text-[11px] text-slate-400 underline hover:text-slate-600">{copied ? "copied" : "or copy the code"}</button>
        <span className="block text-[11px] text-slate-400">(copying: make a new bookmark and paste the code as its URL)</span>
      </li>
      <li>Log into the vendor portal (e.g. Virginia Tile connect24) — any page works once you're signed in.</li>
      <li>Click the bookmark — it copies your sign-in to the clipboard (no new tab). Come back here and hit <span className="font-medium text-slate-600">Paste sign-in</span> to unlock every saved sheet, ready to download. (On portals that list their sheets as links, it grabs those too.)</li>
    </ol>
  );
}

// The neat little sign-in box. The primary path is one button: click the
// bookmark on the portal (it copies your sign-in to the clipboard), come back
// here, hit "Paste sign-in". It reads the clipboard, folds the sign-in in, and
// every saved sheet for that portal lights up green, ready to download.
// A collapsed "paste a link instead" reveals the manual textarea fallback —
// needed to bootstrap menu-style portals (Downloads-page copy) and unchanged in
// behaviour: "Unlock" donates the link's session without saving the sheet,
// "Add to board" also remembers it. Both the button and the fallback accept a
// copied sign-in blob OR a plain price-list URL.
function SignInPaste({ onPasteSession, onUnlock, onAdd, inp }) {
  const [manual, setManual] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState(null); // { unlocked } on success | { err } otherwise
  const [busy, setBusy] = useState(false);
  const BAD = "That doesn't look like a FloorTrack sign-in or a price-list link.";

  const pasteFromClipboard = async () => {
    setBusy(true);
    let clip = "";
    try { clip = await navigator.clipboard.readText(); } catch {}
    setBusy(false);
    if (clip) { const r = onPasteSession(clip); if (r) { setNote(r); setManual(false); return; } }
    setManual(true);
    setNote({ err: clip
      ? "That clipboard text isn't a FloorTrack sign-in — click the bookmark on the portal first, or paste a sheet link below."
      : "Couldn't read the clipboard. Paste the copied text (or a sheet link) below, then Unlock." });
  };
  const unlock = () => { const r = onPasteSession(text) || onUnlock(text); if (r) { setText(""); setNote(r); } else setNote({ err: BAD }); };
  const add = () => { const r = onPasteSession(text); if (r) { setText(""); setNote(r); return; } if (onAdd(text)) { setText(""); setNote(null); } else setNote({ err: BAD }); };

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={pasteFromClipboard} disabled={busy} title="Reads the sign-in the bookmark copied to your clipboard" className="flex items-center gap-1.5 text-sm rounded-lg bg-indigo-600 text-white px-3 py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-50">
          <ClipboardList size={14} /> Paste sign-in
        </button>
        <button onClick={() => { setManual((v) => !v); setNote(null); }} className="text-[11px] text-slate-400 hover:text-slate-600 underline shrink-0">{manual ? "hide link box" : "paste a link instead"}</button>
      </div>
      {manual && (
        <div className="mt-2">
          <textarea value={text} onChange={(e) => { setText(e.target.value); if (note) setNote(null); }} rows={2} placeholder="https://connect24.virginiatile.com/…getPrettyPriceList…" className={inp + " font-mono text-[11px]"} />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button onClick={add} disabled={!text.trim()} title="Also save this sheet to the board" className="text-sm rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50">Add to board</button>
            <button onClick={unlock} disabled={!text.trim()} title="Unlock this sign-in's downloads — the sheet isn't saved" className="text-sm rounded-lg bg-indigo-600 text-white px-3 py-1.5 font-medium hover:bg-indigo-700 disabled:opacity-50">Unlock downloads</button>
          </div>
        </div>
      )}
      {note && (
        note.err ? (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
            <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
            <span>{note.err}</span>
          </div>
        ) : (
          <div className={"mt-2 flex items-start gap-1.5 text-xs " + (note.unlocked ? "text-emerald-700" : "text-slate-500")}>
            <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>{note.unlocked
              ? `Sign-in captured — ${note.unlocked} saved ${note.unlocked === 1 ? "sheet is" : "sheets are"} ready to download below.`
              : "Sign-in captured, but no saved sheets match it yet — use “paste a link instead” → “Add to board” to keep one."}</span>
          </div>
        )
      )}
    </>
  );
}

// A collapsible ⋯-menu section that points a sheet at a price book that
// already exists (the "merge" path — the sheet then presents as that book's
// row). Shared by the loose-sheet and linked-book rows. Excludes the book the
// sheet already feeds.
function bookLinkMenu({ books, sheet, onLinkBook, onDone, open, setOpen, label }) {
  return (
    <>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50">
        <ChevronRight size={13} className={"text-slate-400 transition-transform " + (open ? "rotate-90" : "")} /> {label}
      </button>
      {open && (
        <div className="max-h-40 overflow-y-auto bg-slate-50">
          {(books || []).length === 0 ? (
            <div className="pl-8 pr-3 py-1.5 text-[12px] text-slate-400">No price books yet</div>
          ) : (books || []).map((b) => (
            <button key={b.id} disabled={b.id === sheet.bookId} onClick={() => { onLinkBook(sheet, b.id); onDone(); }} className="w-full text-left pl-8 pr-3 py-1.5 text-[13px] hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent truncate">{b.name || "Untitled"}</button>
          ))}
        </div>
      )}
    </>
  );
}

// A linked sheet presents as its BOOK (ADR 0024): name + meta up front, the
// filename demoted to the ⋯ menu. Row click opens the book; the refresh
// control fetches the sheet and parks it for review (the pill).
export function VendorBookRow({ sheet, siblings = [], book, group, groups, books, prog, locked, mismatch, running, stale, pending, checked, onToggle, onRedownload, onReview, onRemove, onMove, onLinkBook, onUnlinkBook, onOpenBook }) {
  const feeds = [sheet, ...siblings];
  const [menu, setMenu] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const menuBtn = useRef(null);
  const others = groups.filter((g) => g.id !== group.id);
  const fetching = prog?.state === "fetching";
  const openMenu = (v) => { setMenu(v); if (!v) { setMoveOpen(false); setLinkOpen(false); } };
  const feedNote = siblings.length ? `${feeds.length} sheets · ` : "";
  const meta = pending ? "downloaded — changes waiting"
    : fetching ? `downloading ${entryFileName(sheet)}…`
    : `${feedNote}${book.data?.lastImport?.skus ? `${book.data.lastImport.skus} items · ` : ""}${sheet.lastFetched ? `fetched ${new Date(sheet.lastFetched).toLocaleDateString()}` : "not fetched yet"}`;
  return (
    <div className={"px-2.5 py-1.5 " + (checked ? "bg-indigo-50" : pending ? "bg-indigo-50/40" : stale?.stale ? "bg-amber-50" : "")}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="shrink-0" title="Select for batch download" />
        <BookOpen size={14} className="text-slate-400 shrink-0" />
        <button onClick={() => onOpenBook(book.id)} className="min-w-0 flex-1 text-left" title={`${book.name || "Untitled"} — open this price book (source sheet${feeds.length > 1 ? "s" : ""}: ${feeds.map(entryFileName).join(", ")})`}>
          <div className="text-[12.5px] font-medium truncate">{book.name || "Untitled"}</div>
          <div className="text-[10px] text-slate-400 truncate">{meta}</div>
        </button>
        {mismatch && <span className="shrink-0 leading-none" title="This sheet is from a different portal account — it needs its own sign-in link to download."><AlertTriangle size={12} className="text-amber-500" /></span>}
        {stale?.stale && !pending && <span className="shrink-0 leading-none" title={`Last imported ${stale.days} days ago — refresh to update.`}><AlertTriangle size={12} className="text-amber-500" /></span>}
        {prog?.state === "done" && !pending && <Check size={13} className="text-emerald-600 shrink-0" />}
        {prog?.state === "error" && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
        {pending && !fetching && (
          <button onClick={() => onReview(pending)} title={`${entryFileName(sheet)} is downloaded — open this book's import review`} className="shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-semibold px-2 py-px hover:bg-indigo-700">Review</button>
        )}
        {!fetching && !pending && <button onClick={() => onRedownload(sheet)} disabled={running} title={locked ? "Refresh this book's sheet (no live sign-in yet — a failed try says how to unlock)" : "Ready — refresh this book's sheet"} className={"p-0.5 disabled:opacity-40 shrink-0 " + (locked || prog?.state === "done" ? "text-slate-400 hover:text-indigo-600" : "ft-live")}><RotateCcw size={12} /></button>}
        <button ref={menuBtn} onClick={() => openMenu(!menu)} title="More" className="p-0.5 text-slate-400 hover:text-slate-600 shrink-0"><MoreHorizontal size={14} /></button>
        <DotMenu open={menu} onClose={() => openMenu(false)} anchorRef={menuBtn}>
          <div className="px-3 py-1 text-[11px] text-slate-400">
            Source sheet{feeds.length > 1 ? "s" : ""}:
            {feeds.map((f) => <div key={recordKey(f)} className="text-slate-600 truncate" title={entryFileName(f)}>{entryFileName(f)}</div>)}
          </div>
          <button onClick={() => { onOpenBook(book.id); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><BookOpen size={13} className="text-slate-400" /> Open price book</button>
          <button onClick={() => { onUnlinkBook(sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><Link2Off size={13} className="text-slate-400" /> Unlink price book</button>
          {bookLinkMenu({ books, sheet, onLinkBook, onDone: () => openMenu(false), open: linkOpen, setOpen: setLinkOpen, label: "Link to a different book" })}
          {others.length > 0 && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => setMoveOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50">
                <ChevronRight size={13} className={"text-slate-400 transition-transform " + (moveOpen ? "rotate-90" : "")} /> Move to another sign-in
              </button>
              {moveOpen && (
                <div className="max-h-40 overflow-y-auto bg-slate-50">
                  {others.map((g) => (
                    <button key={g.id} onClick={() => { onMove(sheet, group.id, g.id); openMenu(false); }} className="w-full text-left pl-8 pr-3 py-1.5 text-[13px] hover:bg-slate-100 truncate">{g.name}</button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button onClick={() => { onRemove(group.id, sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-red-600 hover:bg-red-50"><X size={13} /> Forget this sheet</button>
        </DotMenu>
      </div>
      {fetching && (
        <div className="pl-6 pr-1 pt-1">
          <div className={"ft-progress h-1" + (prog.value == null ? " ft-progress-indeterminate" : "")}>
            {prog.value != null && <div className="ft-progress-fill" style={{ width: `${Math.round(prog.value * 100)}%` }} />}
          </div>
        </div>
      )}
      {prog?.state === "error" && <div className="pl-6 pt-0.5 text-[10px] text-red-600" title={prog.note}>{prog.note}</div>}
    </div>
  );
}

// One remembered sheet on a dense board row: checkbox · filename · warn icons ·
// re-download · ⋯ menu. Clicking the name toggles selection for the batch bar.
// Downloads are never pre-locked (ADR 0021): a fetch without this portal's live
// session fails on the spot with a "sign in" note on the error sub-line. Amber
// icons flag a portal-account mismatch and a stale linked book (row tints amber
// too). The ⋯ menu creates/unlinks a price book, moves the sheet to another
// sign-in (collapsible list), or forgets it.
function VendorSheetRow({ sheet, group, groups, books, prog, locked, mismatch, running, stale, bookName, checked, onToggle, onRedownload, onRemove, onMove, onCreateBook, onLinkBook, onUnlinkBook, pending, onReview }) {
  const [menu, setMenu] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const menuBtn = useRef(null);
  const others = groups.filter((g) => g.id !== group.id);
  const fetching = prog?.state === "fetching";
  const openMenu = (v) => { setMenu(v); if (!v) { setMoveOpen(false); setLinkOpen(false); } };
  const linkItem = bookLinkMenu({ books, sheet, onLinkBook, onDone: () => openMenu(false), open: linkOpen, setOpen: setLinkOpen, label: "Link to an existing price book…" });
  return (
    <div className={"px-2.5 py-1.5 " + (checked ? "bg-indigo-50" : stale?.stale ? "bg-amber-50" : "")}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="shrink-0" title="Select for batch download" />
        <button onClick={onToggle} className="text-[12.5px] truncate min-w-0 flex-1 text-left" title={entryFileName(sheet) + (bookName ? ` — feeds ${bookName}` : "")}>{entryFileName(sheet)}</button>
        {mismatch && <span className="shrink-0 leading-none" title="This sheet is from a different portal account — it needs its own sign-in link to download."><AlertTriangle size={12} className="text-amber-500" /></span>}
        {stale?.stale && !pending && <span className="shrink-0 leading-none" title={`${bookName || "Its price book"} was last imported ${stale.days} days ago — re-download this sheet to refresh it.`}><AlertTriangle size={12} className="text-amber-500" /></span>}
        {prog?.state === "done" && !pending && <Check size={13} className="text-emerald-600 shrink-0" />}
        {prog?.state === "error" && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
        {pending && !fetching && (
          <button onClick={() => onReview(pending)} title={`${entryFileName(sheet)} is downloaded — open its import review`} className="shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-semibold px-2 py-px hover:bg-indigo-700">Review</button>
        )}
        {!fetching && <button onClick={() => onRedownload(sheet)} disabled={running} title={locked ? "Download this sheet (no live sign-in yet — a failed try says how to unlock)" : "Ready — download this sheet"} className={"p-0.5 disabled:opacity-40 shrink-0 " + (locked || prog?.state === "done" ? "text-slate-400 hover:text-indigo-600" : "ft-live")}><RotateCcw size={12} /></button>}
        <button ref={menuBtn} onClick={() => openMenu(!menu)} title="More" className="p-0.5 text-slate-400 hover:text-slate-600 shrink-0"><MoreHorizontal size={14} /></button>
        <DotMenu open={menu} onClose={() => openMenu(false)} anchorRef={menuBtn}>
          {sheet.bookId ? (
            <>
              <div className="px-3 py-1 text-[11px] text-slate-400 truncate">Feeds <span className="text-slate-600">{bookName || "a deleted book"}</span></div>
              <button onClick={() => { onUnlinkBook(sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><Link2Off size={13} className="text-slate-400" /> Unlink price book</button>
            </>
          ) : (
            <>
              <button onClick={() => { onCreateBook(sheet); openMenu(false); }} disabled={running} title="Download this sheet and start a new price book from it" className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent"><Plus size={13} className="text-slate-400" /> Create price book from this sheet</button>
              {linkItem}
            </>
          )}
          {others.length > 0 && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => setMoveOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50">
                <ChevronRight size={13} className={"text-slate-400 transition-transform " + (moveOpen ? "rotate-90" : "")} /> Move to another sign-in
              </button>
              {moveOpen && (
                <div className="max-h-40 overflow-y-auto bg-slate-50">
                  {others.map((g) => (
                    <button key={g.id} onClick={() => { onMove(sheet, group.id, g.id); openMenu(false); }} className="w-full text-left pl-8 pr-3 py-1.5 text-[13px] hover:bg-slate-100 truncate">{g.name}</button>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button onClick={() => { onRemove(group.id, sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-red-600 hover:bg-red-50"><X size={13} /> Forget this sheet</button>
        </DotMenu>
      </div>
      {fetching && (
        <div className="pl-6 pr-1 pt-1">
          <div className={"ft-progress h-1" + (prog.value == null ? " ft-progress-indeterminate" : "")}>
            {prog.value != null && <div className="ft-progress-fill" style={{ width: `${Math.round(prog.value * 100)}%` }} />}
          </div>
        </div>
      )}
      {prog?.state === "error" && <div className="pl-6 pt-0.5 text-[10px] text-red-600" title={prog.note}>{prog.note}</div>}
    </div>
  );
}

// One sign-in as a slim board column: name · download-all · a ⋯ menu holding
// rename / sign-in link / delete, then single-line sheet rows. Sheets move
// between sign-ins from a row's ⋯ menu (the pointer-drag went away with the
// board layout — ADR 0021).
function VendorGroupCard({ group, groups, books, sheetSesid, sheetInfo, progress, running, selected, onToggleSheet, onRedownloadAll, onRedownloadSheet, onPatch, onDelete, onRemoveSheet, onMoveSheet, onCreateBook, onLinkBook, onUnlinkBook, onOpenBook, pendingFor, onReview, inp }) {
  const [menu, setMenu] = useState(false);
  const menuBtn = useRef(null);
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState(group.name);
  const [editUrl, setEditUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(group.loginUrl || "");
  const [confirmDel, setConfirmDel] = useState(false);

  const commitName = () => { const n = nameDraft.trim(); if (n && n !== group.name) onPatch(group.id, { name: n }); else setNameDraft(group.name); setEditName(false); };
  const commitUrl = () => { onPatch(group.id, { loginUrl: urlDraft.trim() }); setEditUrl(false); };
  const groupLive = group.sheets.length > 0 && group.sheets.some((s) => sheetSesid(s));

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-2.5 py-2 border-b border-slate-100">
        <div className="flex items-center gap-1">
          {editName ? (
            <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={commitName} onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setNameDraft(group.name); setEditName(false); } }} className={inp + " text-sm font-medium"} />
          ) : (
            <h3 className="text-[13px] font-semibold truncate flex-1 min-w-0" title={group.name}>{group.name}</h3>
          )}
          <button onClick={() => onRedownloadAll(group)} disabled={running || group.sheets.length === 0} title={groupLive ? "Ready — download every sheet in this sign-in" : "Download every sheet in this sign-in"} className={"p-1 disabled:opacity-40 shrink-0 " + (groupLive ? "ft-live" : "text-indigo-600 hover:text-indigo-700")}><Download size={14} /></button>
          <button ref={menuBtn} onClick={() => setMenu((v) => !v)} title="Sign-in options" className="p-1 text-slate-400 hover:text-slate-600 shrink-0"><MoreHorizontal size={14} /></button>
          <DotMenu open={menu} onClose={() => setMenu(false)} anchorRef={menuBtn} width={192}>
            <button onClick={() => { setNameDraft(group.name); setEditName(true); setMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><Pencil size={13} className="text-slate-400" /> Rename sign-in</button>
            <button onClick={() => { setUrlDraft(group.loginUrl || ""); setEditUrl(true); setMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><Link2 size={13} className="text-slate-400" /> {group.loginUrl ? "Edit" : "Add"} sign-in link</button>
            <div className="my-1 border-t border-slate-100" />
            <button onClick={() => { setConfirmDel(true); setMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-red-600 hover:bg-red-50"><Trash2 size={13} /> Delete sign-in…</button>
          </DotMenu>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 min-w-0">
          {group.loginUrl && <a href={group.loginUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline shrink-0"><Link2 size={11} /> Sign in</a>}
          <span className="truncate">{group.sheets.length} sheet{group.sheets.length === 1 ? "" : "s"}</span>
        </div>
        {editUrl && (
          <input autoFocus value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} onBlur={commitUrl} onKeyDown={(e) => { if (e.key === "Enter") commitUrl(); if (e.key === "Escape") setEditUrl(false); }} placeholder="https://portal-sign-in…" className={inp + " text-[11px] mt-1.5"} />
        )}
      </div>
      {confirmDel && (
        <div className="flex items-center gap-2 flex-wrap px-2.5 py-2 text-xs bg-red-50 border-b border-red-100">
          <span className="flex-1 text-red-600">Delete "{group.name}" and forget its {group.sheets.length} sheet{group.sheets.length === 1 ? "" : "s"}? Saved estimates are unaffected.</span>
          <button onClick={() => { onDelete(group.id); setConfirmDel(false); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
          <button onClick={() => setConfirmDel(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-white shrink-0">Cancel</button>
        </div>
      )}
      {group.sheets.length === 0 ? (
        <p className="px-2.5 py-2 text-[11px] text-slate-400">No sheets yet — paste a link above, or move one here from a row's ⋯ menu.</p>
      ) : (() => {
        const linked = group.sheets.filter((s) => sheetInfo(s).book);
        const loose = group.sheets.filter((s) => !sheetInfo(s).book);
        // One row per BOOK, not per sheet: a book fed by several sheets (Mirage's
        // flooring + trim + product chart) would otherwise repeat down the column
        // once per file. The row reports the extra sheets and acts on all of them.
        const byBook = [];
        for (const s of linked) {
          const info = sheetInfo(s);
          const hit = byBook.find((b) => b.book?.id === info.book?.id);
          if (hit) hit.sheets.push(s); else byBook.push({ book: info.book, stale: info.stale, sheets: [s] });
        }
        const rowProps = (s) => ({ sheet: s, group, groups, books, prog: progress[recordKey(s)], locked: !sheetSesid(s), mismatch: !sheetMatchesGroup(s, group), running, pending: pendingFor(s), checked: selected.has(recordKey(s)), onToggle: () => onToggleSheet(s), onRedownload: onRedownloadSheet, onReview, onRemove: onRemoveSheet, onMove: onMoveSheet, onLinkBook });
        return (
          <div className="divide-y divide-slate-100">
            {byBook.map(({ book, stale, sheets }) => {
              const all = sheets.every((s) => selected.has(recordKey(s)));
              return (
                <VendorBookRow key={book?.id || recordKey(sheets[0])} {...rowProps(sheets[0])} siblings={sheets.slice(1)} book={book} stale={stale}
                  checked={all}
                  onToggle={() => sheets.forEach((s) => { if (selected.has(recordKey(s)) === all) onToggleSheet(s); })}
                  onRedownload={() => sheets.forEach((s) => onRedownloadSheet(s))}
                  onUnlinkBook={onUnlinkBook} onOpenBook={onOpenBook} />
              );
            })}
            {loose.length > 0 && linked.length > 0 && <div className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Loose sheets</div>}
            {loose.map((s) => { const info = sheetInfo(s); return (
              <VendorSheetRow key={recordKey(s)} {...rowProps(s)} stale={info.stale} bookName={null} onCreateBook={onCreateBook} onUnlinkBook={onUnlinkBook} />
            ); })}
          </div>
        );
      })()}
    </div>
  );
}

function useVendorFetch({ settings, setSettings, books, vendorPending, vendorSession, onSessionUsed, onPool, addBook }) {
  const [sesidPool, setSesidPool] = useState(vendorPending || []); // live-session pool (sesids) from full links
  const [sessions, setSessions] = useState([]); // bare bookmarklet sessions (host|user -> sesid), unlock only
  const [sessionNote, setSessionNote] = useState(null); // "sign-in captured" banner after a bookmarklet grab
  const [progress, setProgress] = useState({});
  const [running, setRunning] = useState(false);

  const staleDays = settings.ops?.staleDays || DEFAULT_STALE_DAYS;
  const groups = settings.ops?.vendorGroups || [];
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const writeGroups = (next) => setSettings({ ops: { ...(settings.ops || {}), vendorGroups: next } });

  // Fold a bookmarklet / paste hand-off into both the live-session pool (which
  // unlocks re-downloads) and the groups (so a freshly captured sheet appears
  // under its sign-in). Idempotent, so a repeat hand-off is a no-op.
  useEffect(() => {
    if (!vendorPending || !vendorPending.length) return;
    setSesidPool((p) => mergeEntries(p, vendorPending));
    const next = rememberIntoGroups(groupsRef.current, vendorPending.map(sheetRecord));
    if (JSON.stringify(next) !== JSON.stringify(groupsRef.current)) writeGroups(next);
    clearHandoff();
  }, [vendorPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fold a bookmarklet's bare session grab into the unlock pool without ever
  // remembering a sheet (the whole point of grabbing the token instead of a
  // link). Report how many saved sheets it just unlocked, then clear the hand-off.
  useEffect(() => {
    if (!vendorSession) return;
    setSessions((prev) => poolSession(prev, vendorSession, groupsRef.current));
    const unlocked = groupsRef.current.reduce((n, g) => n + g.sheets.filter((s) => s.host === vendorSession.host && (!vendorSession.user || s.user === vendorSession.user)).length, 0);
    setSessionNote({ unlocked });
    onSessionUsed && onSessionUsed();
  }, [vendorSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveSesid = {};
  for (const e of sesidPool) { const k = `${e.host}|${e.user}`; if (!liveSesid[k]) liveSesid[k] = e.sesid; }
  for (const s of sessions) { liveSesid[`${s.host}|${s.user}`] = s.sesid; } // a fresh bookmarklet grab outranks stale link tokens
  const sheetSesid = (s) => liveSesid[`${s.host}|${s.user}`];

  // Staleness of the price book a sheet feeds: amber once the linked book's last
  // import is past the owner-set threshold (the same one the book list uses).
  const bookById = {};
  for (const b of books || []) bookById[b.id] = b;
  const sheetInfo = (s) => {
    const book = s.bookId ? bookById[s.bookId] : null;
    return { book, stale: book ? bookStaleness(book.data?.lastImport?.at, staleDays) : null };
  };

  const parseLinks = (text) => (text || "").split(/\s+/).map(parseVendorLink).filter((e) => e && !entryProblems(e));

  // The clipboard sign-in blob the bookmarklet copies (marked base64 of
  // {v:1,links,session}). Fold its session into the unlock pool AND remember any
  // links it carried, then report how many saved sheets are now live. Returns
  // null when the text isn't a sign-in blob, so the caller can fall back to
  // treating it as a plain price-list URL.
  const pasteSignIn = (text) => {
    const raw = stripHandoffMark(text);
    const links = decodeHandoff(raw) || [];
    const session = decodeHandoffSession(raw);
    if (!links.length && !session) return null;
    if (session) setSessions((prev) => poolSession(prev, session, groupsRef.current));
    if (links.length) setSesidPool((p) => mergeEntries(p, links));
    const nextGroups = links.length ? rememberIntoGroups(groupsRef.current, links.map(sheetRecord)) : groupsRef.current;
    if (nextGroups !== groupsRef.current && JSON.stringify(nextGroups) !== JSON.stringify(groupsRef.current)) writeGroups(nextGroups);
    const portals = new Set(links.map((e) => `${e.host}|${e.user}`));
    if (session) {
      if (session.user) portals.add(`${session.host}|${session.user}`);
      else for (const g of nextGroups) for (const s of g.sheets) if (s.host === session.host) portals.add(`${s.host}|${s.user}`);
    }
    const unlocked = nextGroups.reduce((n, g) => n + g.sheets.filter((s) => portals.has(`${s.host}|${s.user}`)).length, 0);
    return { unlocked };
  };

  // Temp unlock: pool the pasted link's live session token so every remembered
  // sheet for its sign-in becomes fetchable, without saving the pasted sheet.
  const unlockPasted = (text) => {
    const found = parseLinks(text);
    if (!found.length) return null;
    setSesidPool((p) => mergeEntries(p, found));
    const portals = new Set(found.map((e) => `${e.host}|${e.user}`));
    const unlocked = groups.reduce((n, g) => n + g.sheets.filter((s) => portals.has(`${s.host}|${s.user}`)).length, 0);
    return { unlocked };
  };
  const addPasted = (text) => {
    const found = parseLinks(text);
    if (!found.length) return false;
    setSesidPool((p) => mergeEntries(p, found));
    writeGroups(rememberIntoGroups(groups, found.map(sheetRecord)));
    return true;
  };

  const patchGroup = (id, patch) => writeGroups(groups.map((g) => g.id === id ? { ...g, ...patch } : g));
  const delGroup = (id) => writeGroups(groups.filter((g) => g.id !== id));
  const addGroup = () => writeGroups([...groups, newGroup()]);
  const removeSheet = (groupId, sheet) => writeGroups(groups.map((g) => g.id === groupId ? { ...g, sheets: g.sheets.filter((s) => recordKey(s) !== recordKey(sheet)) } : g));
  const moveSheet = (sheet, fromId, toId) => writeGroups(moveSheetInGroups(groupsRef.current, sheet, fromId, toId));

  // Downloads are never pre-locked (ADR 0021): run() takes plain sheet records
  // and resolves each one's live session itself — a sheet whose portal has no
  // fresh link yet fails on its own row with a note saying how to unlock,
  // instead of a disabled button. The sesid mechanic is unchanged (ADR 0019).
  const NO_SESSION = "no live sign-in — sign in on this portal and click the bookmark (or paste a fresh link), then retry";
  const run = async (picks) => {
    const list = (picks || []).filter(Boolean);
    if (!list.length || running) return;
    setRunning(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const fetched = [], ok = [];
    let failures = 0;
    for (const s of list) {
      const k = recordKey(s);
      const ses = sheetSesid(s);
      if (!ses) { failures++; setProgress((m) => ({ ...m, [k]: { state: "error", note: NO_SESSION } })); continue; }
      const e = applySesid(s, ses);
      setProgress((m) => ({ ...m, [k]: { state: "fetching", value: null, note: "" } }));
      const res = await runFetch(e, token, (p) => setProgress((m) => ({ ...m, [k]: { state: "fetching", value: p.value, note: p.note } })));
      if (res.file) { fetched.push({ sheet: sheetRecord(e), file: res.file }); ok.push(e); setProgress((m) => ({ ...m, [k]: { state: "done" } })); }
      else { failures++; setProgress((m) => ({ ...m, [k]: { state: "error", note: res.error } })); }
    }
    if (ok.length) {
      writeGroups(rememberIntoGroups(groupsRef.current, ok.map((e) => ({ ...sheetRecord(e), lastFetched: Date.now() }))));
    }
    setRunning(false);
    if (fetched.length) onPool(fetched);
    return ok.map((e) => recordKey(e));
  };

  // "Create price book from this sheet": download the one sheet, spin up a new
  // order book named from it, link the sheet to it (so future re-downloads keep
  // that book fresh and the stale flag has a book to watch), and hand the file
  // to the normal import review targeted at the new book.
  const createBookFromSheet = async (sheet) => {
    if (running || !addBook) return;
    const k = recordKey(sheet);
    const ses = sheetSesid(sheet);
    if (!ses) { setProgress((m) => ({ ...m, [k]: { state: "error", note: NO_SESSION } })); return; }
    setRunning(true);
    setProgress((m) => ({ ...m, [k]: { state: "fetching", value: null, note: "" } }));
    const { data } = await supabase.auth.getSession();
    const res = await runFetch(applySesid(sheet, ses), data.session?.access_token, (p) => setProgress((m) => ({ ...m, [k]: { state: "fetching", value: p.value, note: p.note } })));
    setRunning(false);
    if (!res.file) { setProgress((m) => ({ ...m, [k]: { state: "error", note: res.error } })); return; }
    setProgress((m) => ({ ...m, [k]: { state: "done" } }));
    const id = await addBook({ kind: "order", name: entryFileName(sheet).replace(/\.xls$/i, "") });
    let next = rememberIntoGroups(groupsRef.current, [{ ...sheetRecord(sheet), lastFetched: Date.now() }]);
    writeGroups(setSheetBook(next, sheet, id));
    onPool([{ sheet: { ...sheetRecord(sheet), bookId: id }, file: res.file }]);
  };
  const unlinkSheetBook = (sheet) => writeGroups(setSheetBook(groupsRef.current, sheet, null));
  // Point a sheet at a book that already exists (the "merge" path): the sheet
  // starts feeding that book, so it presents as that book's row and re-downloads
  // keep it fresh — no duplicate book minted. Same write path as unlink.
  const linkSheetBook = (sheet, bookId) => writeGroups(setSheetBook(groupsRef.current, sheet, bookId));

  return { groups, writeGroups, sheetSesid, sheetInfo, progress, running, run, createBookFromSheet, linkSheetBook, unlinkSheetBook, patchGroup, delGroup, addGroup, removeSheet, moveSheet, pasteSignIn, unlockPasted, addPasted, sessionNote, setSessionNote };
}

function VendorFetchPage({ vf, books, pending, onReview, onOpenBook, leadColumn, inp }) {
  const [selSheets, setSelSheets] = useState(() => new Set()); // recordKeys picked for the batch bar
  const { groups, sheetSesid, sheetInfo, progress, running, sessionNote, setSessionNote } = vf;
  const clearKeys = (keys) => setSelSheets((prev) => { const n = new Set(prev); for (const k of keys || []) n.delete(k); return n; });
  const runAnd = async (picks) => clearKeys(await vf.run(picks));
  const toggleSheet = (sheet) => setSelSheets((prev) => { const n = new Set(prev); const k = recordKey(sheet); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const removeSheet = (groupId, sheet) => { vf.removeSheet(groupId, sheet); setSelSheets((prev) => { const n = new Set(prev); n.delete(recordKey(sheet)); return n; }); };
  const redownloadAll = (g) => runAnd(g.sheets);
  const redownloadSheet = (s) => runAnd([s]);
  const downloadSelected = () => runAnd(groups.flatMap((g) => g.sheets.filter((s) => selSheets.has(recordKey(s)))));

  return (
    <div>
      {sessionNote && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
          <Check size={14} className="text-emerald-600 shrink-0" />
          <span className="flex-1 text-emerald-800">{sessionNote.unlocked
            ? `Sign-in captured from the bookmark — ${sessionNote.unlocked} saved ${sessionNote.unlocked === 1 ? "sheet is" : "sheets are"} ready to download.`
            : "Sign-in captured, but there are no saved sheets for it yet — paste a sheet link with “Add to board” to start one."}</span>
          <button onClick={() => setSessionNote(null)} title="Dismiss" className="p-0.5 text-emerald-600 hover:text-emerald-800 shrink-0"><X size={13} /></button>
        </div>
      )}

      <div className="mt-3 grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
        {leadColumn}
        {groups.length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-6 text-center">
            <Download size={22} className="mx-auto text-slate-300" />
            <h3 className="mt-2 text-sm font-medium text-slate-600">No sign-ins yet</h3>
            <p className="mt-1 text-xs text-slate-400">Paste a portal sign-in above and click the bookmark on a vendor portal, or paste a price-list link. Sheets land here grouped by sign-in, ready to fetch and re-fetch.</p>
          </div>
        ) : (
          groups.map((g) => (
            <VendorGroupCard key={g.id} group={g} groups={groups} books={books} sheetSesid={sheetSesid} sheetInfo={sheetInfo} progress={progress} running={running} selected={selSheets} onToggleSheet={toggleSheet} onRedownloadAll={redownloadAll} onRedownloadSheet={redownloadSheet} onPatch={vf.patchGroup} onDelete={vf.delGroup} onRemoveSheet={removeSheet} onMoveSheet={vf.moveSheet} onCreateBook={vf.createBookFromSheet} onLinkBook={vf.linkSheetBook} onUnlinkBook={vf.unlinkSheetBook} onOpenBook={onOpenBook} pendingFor={(s) => pendingForSheet(pending, s)} onReview={onReview} inp={inp} />
          ))
        )}
        <button onClick={vf.addGroup} className="rounded-xl border border-dashed border-slate-300 min-h-[5.5rem] flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:bg-slate-50"><Plus size={14} /> New sign-in</button>
      </div>

      {selSheets.size > 0 && (
        <div className={`fixed ${pending.length ? "bottom-[4.25rem]" : "bottom-5"} left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-xl pl-4 pr-2 py-2`}>
          <span className="text-sm font-semibold whitespace-nowrap">{selSheets.size} selected</span>
          <button onClick={downloadSelected} disabled={running} className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">Download selected</button>
          <button onClick={() => setSelSheets(new Set())} title="Clear selection" className="p-1.5 text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

// Books with no portal sheet — the shop workbook plus hand-kept/unlinked
// registry books. First column of the library board (ADR 0024).
function InHouseColumn({ books, groups, stockCount, stockStale, bookStale, onOpen }) {
  const linkedIds = new Set();
  for (const g of groups) for (const s of g.sheets || []) if (s.bookId) linkedIds.add(s.bookId);
  const inHouse = books.filter((b) => !linkedIds.has(b.id));
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-2.5 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <h3 className="text-[13px] font-semibold">In-house</h3>
        <div className="text-[11px] text-slate-400 mt-0.5">no portal — imported by hand</div>
      </div>
      <div className="divide-y divide-slate-100">
        <button onClick={() => onOpen("stock")} className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50">
          <BookOpen size={14} className="text-slate-400 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium truncate">Shop workbook</span>
            <span className="block text-[10px] text-slate-400">{stockCount || "—"} items</span>
          </span>
          {stockStale.stale && <AlertTriangle size={12} className="text-amber-500 shrink-0" aria-label={`Stale — imported ${stockStale.days} days ago`} />}
        </button>
        {inHouse.map((b) => (
          <button key={b.id} onClick={() => onOpen(b.id)} className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50">
            <Database size={14} className="text-slate-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium truncate">{b.name || "Untitled"}</span>
              <span className="block text-[10px] text-slate-400">{b.kind === "stock" ? "stock" : "special order"}{b.active ? "" : " · off"}</span>
            </span>
            {bookStale(b).stale && <AlertTriangle size={12} className="text-amber-500 shrink-0" aria-label={`Stale — imported ${bookStale(b).days} days ago`} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// "Paste sign-in" popover: the add-a-sign-in box (paste row + bookmark setup)
// tucked behind a header button so the board stays the focus (ADR 0024).
function PasteSignInPopover({ vf, setupOpen, setSetupOpen, inp, lbl }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className={`flex items-center gap-1.5 text-xs rounded-md border px-2.5 py-1.5 ${open ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
        <Hand size={13} /> Paste sign-in
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-80 max-w-[calc(100vw-2rem)] z-50 rounded-xl border border-slate-200 bg-white shadow-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <label className={lbl + " mb-0"}>Add a sign-in</label>
            <button onClick={() => setSetupOpen((v) => !v)} className="text-[11px] text-indigo-600 hover:underline shrink-0">{setupOpen ? "Hide setup" : "Set up bookmark"}</button>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-2">Click the bookmark on a vendor portal, then paste it here — no new tab.</p>
          <SignInPaste onPasteSession={vf.pasteSignIn} onUnlock={vf.unlockPasted} onAdd={vf.addPasted} inp={inp} />
          {setupOpen && (
            <div className="mt-3 border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-500 mb-2">One bookmark copies your portal sign-in to the clipboard — paste it here to unlock every saved sheet for download:</p>
              <VendorBookmarklet />
              <p className="text-[11px] text-slate-400 mt-2">First time on a portal, or the bookmark can't reach your sign-in? Open one sheet, copy its link from the browser's Downloads page (Ctrl+J → right-click → Copy link address), then use “paste a link instead” → “Add to board” to save it.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PriceBookLibrary({ books, stock, stockReady, addBook, updateBook, delBook, loadBookItems, applyBookImport, loadBookVersions, loadBookVersionSnapshot, pinBookVersion, updateBookItem, setBookItemsDisabled, reviewBookItemFlags, setStockItemsDisabled, rollbackStock, importing, importPriceBook, importStockFile, pbRef, settings, setSettings, gFamilies, inp, lbl, types, typeLabels }) {
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

      {dropped && <ImportRouter files={dropped.files} preferTarget={dropped.prefer} targets={dropped.targets} sourceKeys={dropped.sourceKeys} linkedSlots={bookFetchSlots} onFileDone={fileDone} books={books} applyBookImport={applyBookImport} updateBook={updateBook} loadBookItems={loadBookItems} importStockFile={importStockFile} onClose={() => setDropped(null)} types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={hideCosts} />}

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

export function SourceSheetStrip({ sources, pendingSources, stale: st, lastImportAt, pendingOf, liveOf, onRefresh, onReview }) {
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
export function AddFileNotice({ knownSlot }) {
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
        const detected = detectVtcEft(parsed);
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

  const mapping = { sheet: sheetName, headerRow: headerRow >= 0 ? headerRow : undefined, columns, skuPattern, flags, groupBy: groupBy || undefined, defaultType: defaultType || undefined };
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
  const fingerprint = sheet ? (({ headerSig, titleSig }) => ({ format: fmt, headerSig, titleSig }))(computeFingerprint({ sheets: sheets || [] })) : null;
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

// The Materials & add-ons library's built-in categories (spec 2026-07-15,
// PR 1). Locked: math and floor scope live in code; only their catalog
// content and chip default are team-editable. Custom add-on categories
// join this list in a later PR.
const MATERIAL_CATEGORIES = [
  { id: "grout", label: "Grout", kind: "grouts", icon: Paintbrush, applies: "Tile", math: "Volumetric — scales with tile size, joint & thickness" },
  { id: "mortar", label: "Mortar", kind: "mortars", icon: Package, applies: "Tile", math: "Tiered coverage by the tile's longest side" },
  { id: "underlay", label: "Underlayment", kind: "underlayments", icon: Layers, applies: "Per product — the flooring-type chips on each product", math: "Flat sq ft coverage · optional install materials" },
];

function SettingsWorkspace({ onClose, settings, setSettings, stock, stockReady, gFamilies, importing, importPriceBook, importStockFile, pbRef, exportBackup, importBackup, fileRef, inp, lbl, types, typeLabels, theme, setTheme, profile, saveProfile, user, books, addBook, updateBook, delBook, loadBookItems, applyBookImport, loadBookVersions, loadBookVersionSnapshot, pinBookVersion, updateBookItem, setBookItemsDisabled, reviewBookItemFlags, setStockItemsDisabled, rollbackStock }) {
  const catalog = settings.catalog;
  const onChange = (c) => setSettings({ catalog: c });
  const [section, setSection] = useState("materials");
  const [cat, setCat] = useState("grout"); // which Materials & add-ons category is open
  // Master→detail selection: an existing product, or (via `adding`) an
  // add-draft under a company. View state only, never persisted.
  const [sel, setSel] = useState(null); // { companyId, kind, productId }
  const [newCompany, setNewCompany] = useState("");
  const [adding, setAdding] = useState(null); // { companyId, kind }
  const [draft, setDraft] = useState({});
  const [error, setError] = useState("");
  const [confirmDel, setConfirmDel] = useState(null); // { companyId, kind, productId }
  const [menuFor, setMenuFor] = useState(null); // company id with the ⋯ menu open
  const menuBtns = useRef({}); // company id -> its ⋯ button, the open menu's DotMenu anchor
  const [showOthers, setShowOthers] = useState(false); // "Not in this section" group
  const [rename, setRename] = useState(null); // { value, error } — renaming the selected product
  const [coRename, setCoRename] = useState(null); // { id, value } — renaming a company inline
  const [addingCat, setAddingCat] = useState(false); // New-category modal
  const [catDraft, setCatDraft] = useState({ name: "", floorTypes: [], math: "coverage" });
  const [catError, setCatError] = useState("");
  const [catRename, setCatRename] = useState(null); // { value, error } — renaming the open custom category
  const [confirmDelCat, setConfirmDelCat] = useState(false);

  // Spread the whole catalog, not just companies, so sibling fields
  // (defaults, removedSeeds) survive a company/product edit.
  const setCompany = (cid, patch) => onChange({ ...catalog, companies: catalog.companies.map((co) => co.id === cid ? { ...co, ...patch } : co) });
  const setProduct = (cid, kind, pid, patch) => onChange({ ...catalog, companies: catalog.companies.map((co) => co.id === cid ? { ...co, [kind]: co[kind].map((p) => p.id === pid ? { ...p, ...patch } : p) } : co) });
  const setInstallItem = (cid, u, mid, patch) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).map((m) => m.id === mid ? { ...m, ...patch } : m) });
  const delInstallItem = (cid, u, mid) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).filter((m) => m.id !== mid) });
  const newInstallItem = (kind) => kind === "mortar" ? { id: uid(), kind: "mortar", product: "", coverage: "" } : { id: uid(), kind: "custom", name: "", coverage: "", unit: "units", price: "", sku: "" };
  const addInstallItem = (cid, u, kind) => setProduct(cid, "underlayments", u.id, { install: [...(u.install || []), newInstallItem(kind)] });
  // Switching a row's kind rebuilds it (the field sets don't overlap), keeping
  // only the id and coverage.
  const setInstallKind = (cid, u, mid, kind) => setProduct(cid, "underlayments", u.id, { install: (u.install || []).map((m) => m.id !== mid || m.kind === kind ? m : { ...newInstallItem(kind), id: m.id, coverage: m.coverage }) });
  const mortarNames = catalog.companies.flatMap((c) => c.mortars.map((m) => m.name));

  const kindLabel = (kind) => kind === "grouts" ? "grout" : kind === "mortars" ? "mortar" : kind === "attached" ? (customCat?.name || "add-on") : "underlayment";
  // The team's chip default for a kind, compared name-wise the way jobs resolve.
  const isDefaultMaterial = (kind, name) => String(catalog.defaults?.[{ grouts: "grout", mortars: "mortar", underlayments: "underlay" }[kind]] || "").trim().toLowerCase() === String(name || "").trim().toLowerCase();
  // An attached product's chip default lives on ITS category (only reachable
  // while that category is the open one, so customCat is the right scope).
  const isCategoryDefault = (p) => !!customCat && String(customCat.default || "").trim().toLowerCase() === String(p?.name || "").trim().toLowerCase() && customCat.default !== "";
  const startAdd = (companyId, kind) => { setAdding({ companyId, kind }); setSel(null); setConfirmDel(null); setRename(null); setDraft(kind === "attached" ? { name: "", coverage: "", unit: "units", price: "", sku: "", categoryId: cat } : kind === "grouts" ? { name: "", coverage: "", unit: "units", price: "", sku: "", book: "", base: null } : kind === "mortars" ? { name: "", tier1: "", tier2: "", tier3: "", unit: "units", price: "", sku: "" } : { name: "", coverage: "", unit: "rolls", price: "", sku: "", types: [] }); setError(""); };
  const cancelAdd = () => { setAdding(null); setError(""); };
  const pickProduct = (companyId, kind, productId) => { setSel({ companyId, kind, productId }); setAdding(null); setConfirmDel(null); setRename(null); };
  const submitAdd = () => {
    const name = (draft.name || "").trim();
    if (!name) { setError("Product name is required."); return; }
    const dup = adding.kind === "attached" ? isDuplicateAttachedName(catalog, draft.categoryId, name) : isDuplicateName(catalog, adding.kind, name);
    if (dup) { setError(`A ${kindLabel(adding.kind)} named "${name}" already exists.`); return; }
    onChange(addProduct(catalog, adding.companyId, adding.kind, { ...draft, name }));
    setAdding(null); setError("");
  };
  // A new company starts empty, so it would land in the collapsed "Not in this
  // section" group — open the add form for it right away so it doesn't seem to
  // vanish.
  const submitCompany = () => { const name = newCompany.trim(); if (!name) return; const next = addCompany(catalog, name); onChange(next); setNewCompany(""); setShowOthers(true); startAdd(next.companies[next.companies.length - 1].id, kindsFor[0]); };
  const openNewCategory = () => { setAddingCat(true); setCatDraft({ name: "", floorTypes: [], math: "coverage" }); setCatError(""); };
  const submitCategory = () => {
    const name = catDraft.name.trim();
    if (!name) { setCatError("Category name is required."); return; }
    if (isDuplicateCategoryName(catalog, name)) { setCatError(`A category named "${name}" already exists.`); return; }
    const next = addCategory(catalog, { ...catDraft, name });
    onChange(next);
    setAddingCat(false); setSel(null); setAdding(null); setConfirmDelCat(false); setCatRename(null);
    setCat(next.categories[next.categories.length - 1].id);
  };
  const openCat = (id) => { setCat(id); setSel(null); setAdding(null); setConfirmDel(null); setMenuFor(null); setShowOthers(false); setRename(null); setCoRename(null); setCatRename(null); setConfirmDelCat(false); };
  // The book rarely carries coverage, so most items still need it typed in —
  // mortars always do (three tiers can't come from one number). The pick keeps
  // the item's SKU on the product (ADR 0006), and a Laticrete pigment brings
  // its default base unit along (editable before and after adding).
  const fillFromStock = (it) => setDraft((d) => ({
    ...d,
    name: it.product || it.description,
    sku: it.sku,
    ...(it.price != null ? { price: String(it.price) } : it.priceSqft != null ? { price: String(it.priceSqft) } : {}),
    ...(adding.kind !== "mortars" && it.coverage != null ? { coverage: String(it.coverage) } : {}),
    ...(adding.kind === "grouts" ? { base: stockBaseCompanion(it, stock) } : {}),
    // A pick from the Grout & Caulk color matrix also suggests the color
    // family link (ADR 0007) — the grout offers that family's colors.
    ...(adding.kind === "grouts" && it.sheet === "Grout & Caulk" && it.product && it.color ? { book: it.product } : {}),
  }));

  const box = (on, onClick, title) => (
    <button onClick={onClick} title={title} className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${on ? "bg-indigo-600 text-white" : "border border-slate-300"}`}>{on && <Check size={12} />}</button>
  );
  const delButton = (co, kind, p) => (
    <button onClick={() => setConfirmDel({ companyId: co.id, kind, productId: p.id })} title={`Delete ${p.name}`} className="text-slate-300 hover:text-red-500 shrink-0"><Trash2 size={13} /></button>
  );
  const delConfirm = (co, kind, p) => confirmDel && confirmDel.companyId === co.id && confirmDel.kind === kind && confirmDel.productId === p.id && (
    <div className="flex items-center gap-2 mt-1.5 text-xs">
      <span className="text-red-600 flex-1">Delete "{p.name}"? Saved jobs that use it keep the name but stop calculating. To just hide it from new jobs, uncheck it instead.</span>
      <button onClick={() => { onChange(removeProduct(catalog, co.id, kind, p.id)); setConfirmDel(null); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
      <button onClick={() => setConfirmDel(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
    </div>
  );
  const numField = (label, value, onVal) => (
    <div><label className={lbl}>{label}</label><input type="number" value={value} onChange={(e) => onVal(e.target.value)} className={inp} /></div>
  );
  const txtField = (label, value, onVal) => (
    <div><label className={lbl}>{label}</label><input value={value} onChange={(e) => onVal(e.target.value)} className={inp} /></div>
  );
  // Which flooring types an underlayment is offered for. No chips selected = all
  // types (the empty-tag convention in the catalog).
  const typeChips = (selected, onVal, list = types) => {
    const sel = selected || [];
    const toggle = (t) => onVal(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t]);
    return (
      <div><label className={lbl}>Offered for {sel.length === 0 && <span className="text-slate-400 font-normal normal-case tracking-normal">(all types)</span>}</label>
        <div className="flex flex-wrap gap-1">{list.map((t) => <button key={t} onClick={() => toggle(t)} className={`text-xs rounded-md px-2 py-1 border ${sel.includes(t) ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{typeLabels[t]}</button>)}</div>
      </div>
    );
  };
  const floorTypeList = types.filter((t) => t !== "misc");
  const selCo = sel ? catalog.companies.find((c) => c.id === sel.companyId) : null;
  const selProd = selCo ? (selCo[sel.kind] || []).find((p) => p.id === sel.productId) : null;
  const addCo = adding ? catalog.companies.find((c) => c.id === adding.companyId) : null;
  const customCat = (catalog.categories || []).find((c) => c.id === cat);
  const kindsFor = customCat ? ["attached"] : [{ grout: "grouts", mortar: "mortars", underlay: "underlayments" }[cat]];
  // The products a company shows in the current section — attached rows are
  // additionally scoped to the open custom category.
  const prodsOf = (co, kind) => kind === "attached" ? (co.attached || []).filter((p) => p.categoryId === cat) : (co[kind] || []);
  const countAll = (co) => co.grouts.length + co.mortars.length + (co.underlayments?.length || 0) + (co.attached?.length || 0);
  // A company "belongs" to a section by having products of its kinds — the rest
  // sit in a collapsed group so e.g. underlayment-only brands stay out of
  // Grout & colors. Deleting a company's last grout drops it out of the
  // section the same way.
  const inSection = (co) => kindsFor.some((k) => prodsOf(co, k).length > 0);
  const famFor = (g) => (g.book ? gFamilies.find((f) => f.product.toLowerCase() === g.book.toLowerCase()) : null);
  const masterHint = (kind, p) => kind === "grouts"
    ? (p.book ? (famFor(p) ? `${famFor(p).colors.length} colors · book` : "book link missing") : "standard colors")
    : kind === "mortars" || kind === "attached" ? [p.unit, p.sku ? `SKU ${p.sku}` : ""].filter(Boolean).join(" · ")
      : ((p.types || []).length ? p.types.map((t) => typeLabels[t]).join(", ") : "all types") + ((p.install || []).length ? ` · ${p.install.length} install` : "");
  const SECTIONS = [
    { id: "profile", label: "Your details", icon: User, hint: profile.name || "salesperson" },
    { id: "general", label: "General", icon: Percent, hint: "waste %" },
    { id: "book", label: "Price book", icon: BookOpen, hint: books.length ? `${1 + books.length} books` : stock.length ? `${stock.filter((s) => s.active).length} SKUs` : "empty" },
    { id: "materials", label: "Materials & add-ons", icon: Layers, hint: String(catalog.companies.reduce((n, c) => n + c.grouts.length + c.mortars.length + (c.underlayments?.length || 0) + (c.attached?.length || 0), 0)) },
    { id: "backup", label: "Backup & restore", icon: Database, hint: settings.ops?.lastBackup ? new Date(settings.ops.lastBackup.at).toLocaleDateString() : "" },
  ];

  const companyHeader = (co) => (
    <div className="px-3 py-1 flex items-center gap-2">
      {box(co.enabled, () => setCompany(co.id, { enabled: !co.enabled }), co.enabled ? "Hide all of this company's products" : "Show this company's products")}
      {coRename?.id === co.id ? (
        <input autoFocus value={coRename.value} onChange={(e) => setCoRename({ id: co.id, value: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") { const n = coRename.value.trim(); if (n) setCompany(co.id, { name: n }); setCoRename(null); } if (e.key === "Escape") setCoRename(null); }}
          onBlur={() => setCoRename(null)} placeholder="Enter to save" className={inp + " flex-1 min-w-0 !py-0.5 !text-xs"} />
      ) : (
        <span className={`ft-eyebrow text-[9px] flex-1 truncate ${co.enabled ? "" : "opacity-50"}`}>{co.name}</span>
      )}
      <button ref={(el) => { menuBtns.current[co.id] = el; }} onClick={() => setMenuFor(menuFor === co.id ? null : co.id)} title="Company options" className={`shrink-0 ${menuFor === co.id ? "text-slate-600" : "text-slate-300 hover:text-slate-600"}`}><MoreHorizontal size={14} /></button>
      <DotMenu open={menuFor === co.id} onClose={() => setMenuFor(null)} anchorRef={{ get current() { return menuBtns.current[co.id]; } }} width={192}>
        {kindsFor.map((kind) => (
          <button key={kind} onClick={() => { setMenuFor(null); startAdd(co.id, kind); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"><Plus size={12} className="text-slate-400" /> Add {kindLabel(kind)}</button>
        ))}
        <button onClick={() => { setMenuFor(null); setCoRename({ id: co.id, value: co.name }); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"><Pencil size={12} className="text-slate-400" /> Rename company</button>
        {countAll(co) === 0 && <button onClick={() => { setMenuFor(null); onChange(removeCompany(catalog, co.id)); }} className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"><Trash2 size={12} /> Delete company</button>}
      </DotMenu>
    </div>
  );

  const detailHeader = (co, kind, p, tag) => {
    const submitRename = () => {
      const name = (rename?.value || "").trim();
      if (!name) { setRename({ ...rename, error: "Name is required." }); return; }
      if (name.toLowerCase() !== p.name.trim().toLowerCase() && (kind === "attached" ? isDuplicateAttachedName(catalog, p.categoryId, name) : isDuplicateName(catalog, kind, name))) { setRename({ ...rename, error: `A ${kindLabel(kind)} named "${name}" already exists.` }); return; }
      onChange(renameProduct(catalog, co.id, kind, p.id, name));
      setRename(null);
    };
    return (
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="ft-eyebrow text-[9px] mb-1">{co.name} · {tag}</div>
          {rename ? (
            <div className="max-w-md">
              <div className="flex items-center gap-2">
                <input autoFocus value={rename.value} onChange={(e) => setRename({ value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRename(null); }} className={inp + " font-medium"} />
                <button onClick={submitRename} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700 shrink-0">Save</button>
                <button onClick={() => setRename(null)} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 shrink-0">Cancel</button>
              </div>
              {rename.error && <div className="text-xs text-red-500 mt-1">{rename.error}</div>}
              <p className="text-[11px] text-amber-600 mt-1.5">Jobs resolve materials by name — saved jobs keep the old name and stop calculating until this product is re-picked on them.</p>
            </div>
          ) : (
            <h2 className="ft-serif text-3xl leading-tight">{p.name}
              <button onClick={() => setRename({ value: p.name })} title={`Rename ${p.name}`} className="ml-2.5 text-slate-300 hover:text-slate-600 align-middle"><Pencil size={15} /></button>
            </h2>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 pt-1">
          {((kind === "attached" ? isCategoryDefault(p) : isDefaultMaterial(kind, p.name))
            ? <span title={kind === "attached" ? `Rows turning on the ${customCat?.name} chip start with this product` : kind === "underlayments" ? "Rows turning on the underlayment chip start with this product" : "New tile rows start with this material"} className="flex items-center gap-1 text-xs font-medium text-indigo-600"><Star size={12} className="fill-current" /> Default</span>
            : <button onClick={() => onChange(kind === "attached" ? updateCategory(catalog, p.categoryId, { default: p.name }) : setCatalogDefault(catalog, kind, p.name))} title={kind === "attached" ? `Make this the product the ${customCat?.name} chip starts with` : kind === "underlayments" ? "Make this the product the underlayment chip starts with" : "Make this the default new tile rows start with"} className="text-xs text-slate-400 hover:text-indigo-600">Set as default</button>)}
          <label className="flex items-center gap-1.5 text-xs text-slate-500">{box(p.enabled, () => setProduct(co.id, kind, p.id, { enabled: !p.enabled }), p.enabled ? "Hide from job dropdowns" : "Offer in job dropdowns")} offered on jobs</label>
          {delButton(co, kind, p)}
        </div>
      </div>
    );
  };

  // Shown while no product is selected: the built-in category's locked
  // identity plus its one team-editable knob, the chip default. Underlay's
  // blank option = "first offered", today's pre-default behavior.
  const renderCategoryPane = () => {
    const meta = MATERIAL_CATEGORIES.find((c) => c.id === cat);
    const offered = cat === "grout" ? offeredGrouts(catalog)
      : cat === "mortar" ? offeredMortars(catalog)
        : catalog.companies.flatMap((co) => (co.underlayments || []).filter((u) => isOffered(co, u)).map((u) => u.name));
    const current = String(catalog.defaults?.[cat] || "");
    const Icon = meta.icon;
    return (
      <div className="max-w-xl">
        <p className="ft-eyebrow text-[10px] text-slate-400">Materials &amp; add-ons · built-in</p>
        <h2 className="ft-serif text-3xl leading-tight mt-1 flex items-center gap-2.5"><Icon size={22} className="text-slate-400" /> {meta.label} <Lock size={14} className="text-slate-300" /></h2>
        <div className="mt-5 space-y-2 text-sm">
          <div className="flex gap-2"><span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400 pt-0.5">Applies to</span><span className="text-slate-500">{meta.applies}</span></div>
          <div className="flex gap-2"><span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400 pt-0.5">Quantity</span><span className="text-slate-500">{meta.math}</span></div>
        </div>
        <div className="mt-6 max-w-xs">
          <label className={lbl}>Default product</label>
          <select value={offered.includes(current) ? current : ""} onChange={(e) => onChange(setCatalogDefault(catalog, meta.kind, e.target.value))} className={inp}>
            {cat === "underlay" ? <option value="">— first offered —</option> : !offered.includes(current) && <option value="">Select…</option>}
            {offered.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <p className="text-[11px] text-slate-400 mt-1.5">{cat === "underlay" ? "Pre-selected when a row's underlayment chip is turned on." : "New tile rows start with this product."}</p>
        </div>
        <p className="text-xs text-slate-400 mt-8">Pick a product on the left to edit its numbers — or add one under its company.</p>
      </div>
    );
  };

  // The custom-category counterpart: everything the built-in pane locks is
  // editable here (spec 2026-07-15, PR 2). Job chips arrive with PR 3.
  const renderCustomCategoryPane = () => {
    const c = customCat;
    const offered = offeredAttached(catalog, c.id);
    const productCount = catalog.companies.reduce((n, co) => n + (co.attached || []).filter((p) => p.categoryId === c.id).length, 0);
    const submitCatRename = () => {
      const name = (catRename?.value || "").trim();
      if (!name) { setCatRename({ ...catRename, error: "Name is required." }); return; }
      if (isDuplicateCategoryName(catalog, name, c.id)) { setCatRename({ ...catRename, error: `A category named "${name}" already exists.` }); return; }
      onChange(updateCategory(catalog, c.id, { name }));
      setCatRename(null);
    };
    return (
      <div className="max-w-xl">
        <p className="ft-eyebrow text-[10px] text-slate-400">Materials &amp; add-ons · add-on</p>
        {catRename ? (
          <div className="max-w-md mt-1">
            <div className="flex items-center gap-2">
              <input autoFocus value={catRename.value} onChange={(e) => setCatRename({ value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitCatRename(); if (e.key === "Escape") setCatRename(null); }} className={inp + " font-medium"} />
              <button onClick={submitCatRename} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700 shrink-0">Save</button>
              <button onClick={() => setCatRename(null)} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
            {catRename.error && <div className="text-xs text-red-500 mt-1">{catRename.error}</div>}
          </div>
        ) : (
          <h2 className="ft-serif text-3xl leading-tight mt-1 flex items-center gap-2.5"><Tag size={22} className="text-slate-400" /> {c.name}
            <button onClick={() => setCatRename({ value: c.name })} title={`Rename ${c.name}`} className="text-slate-300 hover:text-slate-600"><Pencil size={15} /></button>
          </h2>
        )}
        <div className="mt-5 space-y-5 max-w-md">
          <div>
            {typeChips(c.floorTypes, (v) => onChange(updateCategory(catalog, c.id, { floorTypes: v })), floorTypeList)}
            <p className="text-[11px] text-slate-400 mt-1">Which product rows offer this add-on's chip. None selected = every type.</p>
          </div>
          <div>
            <label className={lbl}>Quantity</label>
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-sm">
              {[["coverage", "Coverage"], ["manual", "Manual"]].map(([k, t]) => (
                <button key={k} onClick={() => onChange(updateCategory(catalog, c.id, { math: k }))} className={`px-3.5 py-2 font-medium ${c.math === k ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{t}</button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{c.math === "coverage" ? "One unit covers a set sq ft — quantities scale off the row's area plus waste, with a per-row manual override." : "A typed per-row quantity (starts at 1) — no area math."}</p>
          </div>
          <div className="max-w-xs">
            <label className={lbl}>Default product</label>
            <select value={offered.includes(c.default) ? c.default : ""} onChange={(e) => onChange(updateCategory(catalog, c.id, { default: e.target.value }))} className={inp}>
              <option value="">— first offered —</option>
              {offered.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5">Pre-selected when a row's {c.name} chip is turned on.</p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">{box(c.enabled, () => onChange(updateCategory(catalog, c.id, { enabled: !c.enabled })), c.enabled ? "Hide this add-on's chip from job rows" : "Offer this add-on's chip on job rows")} offered on jobs</label>
        </div>
        <p className="text-xs text-slate-400 mt-6">Job rows pick these up in an upcoming update — for now this builds the catalog.</p>
        <div className="mt-8 pt-5 border-t border-slate-100">
          {confirmDelCat ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-600 flex-1">Delete "{c.name}"{productCount ? ` and its ${productCount} product${productCount === 1 ? "" : "s"}` : ""} from every company? Jobs that use them keep the name but stop calculating. To just hide the chip, uncheck "offered on jobs" instead.</span>
              <button onClick={() => { onChange(removeCategory(catalog, c.id)); setConfirmDelCat(false); setSel(null); setCat("grout"); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
              <button onClick={() => setConfirmDelCat(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelCat(true)} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12} /> Delete category</button>
          )}
        </div>
      </div>
    );
  };

  const renderGroutDetail = (co, g) => {
    const family = famFor(g);
    return (
      <div key={g.id}>
        {detailHeader(co, "grouts", g, "Grout")}
        {delConfirm(co, "grouts", g)}
        <div className="flex flex-wrap items-end gap-2.5 mt-4">
          <div className="w-36">{numField("Cov. sq ft/unit", g.coverage, (v) => setProduct(co.id, "grouts", g.id, { coverage: v }))}</div>
          <div className="w-24">{txtField("Unit", g.unit, (v) => setProduct(co.id, "grouts", g.id, { unit: v }))}</div>
          <div className="w-28">{numField("$/unit", g.price, (v) => setProduct(co.id, "grouts", g.id, { price: v }))}</div>
          <div className="w-36">{txtField("SKU", g.sku || "", (v) => setProduct(co.id, "grouts", g.id, { sku: v }))}</div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">Coverage is calibrated here — the book doesn't carry one. Grout scales for tile size, joint and thickness from the 12×12×3/8" / 1/8" baseline.</p>
        <div className="mt-6 flex items-baseline justify-between gap-3">
          <div className="font-medium text-sm">Colors &amp; SKUs</div>
          {family && <span className="text-[11px] text-slate-400">picking a color on a job stamps that color's SKU on the estimate</span>}
        </div>
        {g.book ? (family ? (
          <div className="mt-2 rounded-lg border border-slate-200 p-3 max-h-72 overflow-y-auto">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-0.5">
              {family.colors.map((c) => (
                <div key={c.sku} className="flex items-baseline gap-2 text-xs py-0.5 min-w-0">
                  <span className="truncate">{c.color}</span>
                  <span className="ft-mono text-[10px] text-slate-400 ml-auto shrink-0">{c.sku}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 rounded-md border border-amber-200 px-3 py-2"><Link2Off size={12} className="shrink-0" /> Linked to "{g.book}", which isn't in the imported book — re-import the price book or re-link below.</div>
        )) : (
          <p className="mt-2 text-xs text-slate-400">No color link — jobs offer the standard color list and grout lines print without a per-color SKU.</p>
        )}
        <div className="mt-2 flex items-center gap-2 max-w-xl">
          {gFamilies.length > 0 ? <FamilySearch families={gFamilies} inp={inp} onPick={(f) => setProduct(co.id, "grouts", g.id, { book: f.product })} />
            : <p className="text-[11px] text-slate-400 flex-1">Import the price book to link a color family.</p>}
          {g.book && <button onClick={() => setProduct(co.id, "grouts", g.id, { book: "" })} className="text-xs text-slate-400 hover:text-red-500 shrink-0">Unlink colors</button>}
        </div>
        <div className="mt-6 max-w-2xl">
          <label className={lbl}>Base unit <span className="text-slate-400 font-normal normal-case tracking-normal">(a two-part grout's base — ordered with the kits and shown in the order summary; "per" = kits one base covers)</span></label>
          {g.base ? (
            <div className="grid gap-1.5 items-end grid-cols-[1.6fr_.9fr_.6fr_.7fr_.7fr_auto]">
              {txtField("Name", g.base.name, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, name: v } }))}
              {txtField("SKU", g.base.sku, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, sku: v } }))}
              {numField("Per", g.base.per, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, per: v } }))}
              {txtField("Unit", g.base.unit, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, unit: v } }))}
              {numField("$/unit", g.base.price, (v) => setProduct(co.id, "grouts", g.id, { base: { ...g.base, price: v } }))}
              <button onClick={() => setProduct(co.id, "grouts", g.id, { base: null })} title="Remove base unit" className="text-slate-300 hover:text-red-500 pb-2"><X size={14} /></button>
            </div>
          ) : (
            <div>
              {stock.length > 0 && <StockSearch stock={stock} inp={inp} placeholder="Search the book for the base unit…" onPick={(it) => setProduct(co.id, "grouts", g.id, { base: { sku: it.sku, name: it.description || it.product, unit: it.unit || "units", price: it.price ?? 0, per: 1 } })} />}
              <button onClick={() => setProduct(co.id, "grouts", g.id, { base: { sku: "", name: "", unit: "units", price: "", per: 1 } })} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Base unit</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMortarDetail = (co, m) => (
    <div key={m.id}>
      {detailHeader(co, "mortars", m, "Mortar")}
      {delConfirm(co, "mortars", m)}
      <div className="flex flex-wrap items-end gap-2.5 mt-4">
        <div className="w-28">{numField('Tile < 8"', m.tier1, (v) => setProduct(co.id, "mortars", m.id, { tier1: v }))}</div>
        <div className="w-28">{numField('8"–15"', m.tier2, (v) => setProduct(co.id, "mortars", m.id, { tier2: v }))}</div>
        <div className="w-28">{numField('> 15"', m.tier3, (v) => setProduct(co.id, "mortars", m.id, { tier3: v }))}</div>
        <div className="w-24">{txtField("Unit", m.unit, (v) => setProduct(co.id, "mortars", m.id, { unit: v }))}</div>
        <div className="w-28">{numField("$/unit", m.price, (v) => setProduct(co.id, "mortars", m.id, { price: v }))}</div>
        <div className="w-36">{txtField("SKU", m.sku || "", (v) => setProduct(co.id, "mortars", m.id, { sku: v }))}</div>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">Coverage sq ft per unit, tiered by the tile's longest side.</p>
    </div>
  );

  const renderUnderlayDetail = (co, u) => (
    <div key={u.id}>
      {detailHeader(co, "underlayments", u, "Underlayment")}
      {delConfirm(co, "underlayments", u)}
      <div className="flex flex-wrap items-end gap-2.5 mt-4">
        <div className="w-36">{numField("Cov. sq ft/unit", u.coverage, (v) => setProduct(co.id, "underlayments", u.id, { coverage: v }))}</div>
        <div className="w-24">{txtField("Unit", u.unit, (v) => setProduct(co.id, "underlayments", u.id, { unit: v }))}</div>
        <div className="w-28">{numField("$/unit", u.price, (v) => setProduct(co.id, "underlayments", u.id, { price: v }))}</div>
        <div className="w-36">{txtField("SKU", u.sku || "", (v) => setProduct(co.id, "underlayments", u.id, { sku: v }))}</div>
      </div>
      <div className="mt-4">{typeChips(u.types, (v) => setProduct(co.id, "underlayments", u.id, { types: v }))}</div>
      <div className="mt-6 max-w-3xl">
        <label className={lbl}>Install materials <span className="text-slate-400 font-normal normal-case tracking-normal">(added when a job checks "Install materials"; mortar rows pull unit &amp; price from that mortar and combine with the job's mortar totals)</span></label>
        <div className="space-y-1.5">
          {(u.install || []).map((m) => (
            <div key={m.id} className={`grid gap-1.5 items-end ${m.kind === "mortar" ? "grid-cols-[auto_1.6fr_1fr_auto]" : "grid-cols-[auto_1.3fr_.8fr_.6fr_.6fr_.9fr_auto]"}`}>
              <div><label className={lbl}>Type</label>
                <div className="flex rounded-md border border-slate-200 overflow-hidden text-[11px]">{[["mortar", "Mortar"], ["custom", "Other"]].map(([k, l]) => <button key={k} onClick={() => setInstallKind(co.id, u, m.id, k)} className={`px-1.5 py-1.5 ${m.kind === k ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{l}</button>)}</div>
              </div>
              {m.kind === "mortar" ? (
                <div><label className={lbl}>Mortar</label>
                  <select value={m.product} onChange={(e) => setInstallItem(co.id, u, m.id, { product: e.target.value })} className={inp}>
                    {!m.product && <option value="">Select…</option>}
                    {(m.product && !mortarNames.includes(m.product) ? [m.product, ...mortarNames] : mortarNames).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              ) : (
                txtField("Name", m.name, (v) => setInstallItem(co.id, u, m.id, { name: v }))
              )}
              {numField("Cov. sq ft/unit", m.coverage, (v) => setInstallItem(co.id, u, m.id, { coverage: v }))}
              {m.kind !== "mortar" && txtField("Unit", m.unit, (v) => setInstallItem(co.id, u, m.id, { unit: v }))}
              {m.kind !== "mortar" && numField("$/unit", m.price, (v) => setInstallItem(co.id, u, m.id, { price: v }))}
              {m.kind !== "mortar" && txtField("SKU", m.sku || "", (v) => setInstallItem(co.id, u, m.id, { sku: v }))}
              <button onClick={() => delInstallItem(co.id, u, m.id)} title="Remove install material" className="text-slate-300 hover:text-red-500 pb-2"><X size={14} /></button>
            </div>
          ))}
          <div className="flex gap-3">
            <button onClick={() => addInstallItem(co.id, u, "mortar")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Mortar</button>
            <button onClick={() => addInstallItem(co.id, u, "custom")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"><Plus size={12} /> Other (screws, tape…)</button>
          </div>
          {stock.length > 0 && <StockSearch stock={stock} inp={inp} placeholder="Add from the price book — screws, tape, sealer… (keeps the SKU for the order summary)" onPick={(it) => setProduct(co.id, "underlayments", u.id, { install: [...(u.install || []), { id: uid(), kind: "custom", name: it.description || it.product, coverage: it.coverage != null ? String(it.coverage) : "", unit: it.unit || "units", price: it.price != null ? String(it.price) : "", sku: it.sku }] })} />}
        </div>
      </div>
    </div>
  );
  const renderAttachedDetail = (co, p) => (
    <div key={p.id}>
      {detailHeader(co, "attached", p, customCat?.name || "Add-on")}
      {delConfirm(co, "attached", p)}
      <div className="flex flex-wrap items-end gap-2.5 mt-4">
        {customCat?.math === "coverage" && <div className="w-36">{numField("Cov. sq ft/unit", p.coverage, (v) => setProduct(co.id, "attached", p.id, { coverage: v }))}</div>}
        <div className="w-24">{txtField("Unit", p.unit, (v) => setProduct(co.id, "attached", p.id, { unit: v }))}</div>
        <div className="w-28">{numField("$/unit", p.price, (v) => setProduct(co.id, "attached", p.id, { price: v }))}</div>
        <div className="w-36">{txtField("SKU", p.sku || "", (v) => setProduct(co.id, "attached", p.id, { sku: v }))}</div>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">{customCat?.math === "coverage" ? "One unit covers this many sq ft — quantities scale off the row's area plus waste." : "Ordered by a typed per-row quantity — no coverage math."} A SKU lets price-book imports refresh the price.</p>
    </div>
  );
  const renderAddForm = () => addCo && (
    <div className="max-w-xl">
      <div className="ft-eyebrow text-[9px] mb-1">{addCo.name}</div>
      <h2 className="ft-serif text-3xl leading-tight">New {kindLabel(adding.kind)}</h2>
      <div className="mt-4 space-y-2">
        {stock.length > 0 && <StockSearch stock={stock} onPick={fillFromStock} inp={inp} />}
        <input autoFocus placeholder="Product name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") cancelAdd(); }} className={inp} />
        {adding.kind === "attached" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {customCat?.math === "coverage" && numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
            {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
            {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
            {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
          </div>
        ) : adding.kind === "grouts" ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
              {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
              {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
              {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
            </div>
            {draft.book && (
              <div className="flex items-center gap-2 text-xs text-slate-500 rounded-md border border-indigo-100 bg-indigo-50/40 px-2.5 py-1.5">
                <Link2 size={12} className="shrink-0" /><span className="flex-1">Colors &amp; per-color SKUs from <b>{draft.book}</b></span>
                <button onClick={() => setDraft({ ...draft, book: "" })} title="Don't link colors" className="text-slate-300 hover:text-red-500 shrink-0"><X size={13} /></button>
              </div>
            )}
            {draft.base && (
              <div className="flex items-center gap-2 text-xs text-slate-500 rounded-md border border-indigo-100 bg-indigo-50/40 px-2.5 py-1.5">
                <span className="flex-1">Also orders <b>{draft.base.name}</b>{draft.base.sku ? <span className="ft-mono text-slate-400"> · {draft.base.sku}</span> : ""} — 1 per kit (editable after adding)</span>
                <button onClick={() => setDraft({ ...draft, base: null })} title="Don't attach a base unit" className="text-slate-300 hover:text-red-500 shrink-0"><X size={13} /></button>
              </div>
            )}
          </>
        ) : adding.kind === "mortars" ? (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {numField('Tile < 8"', draft.tier1, (v) => setDraft({ ...draft, tier1: v }))}
            {numField('8"–15"', draft.tier2, (v) => setDraft({ ...draft, tier2: v }))}
            {numField('> 15"', draft.tier3, (v) => setDraft({ ...draft, tier3: v }))}
            {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
            {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
            {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
              {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
              {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
              {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
            </div>
            {typeChips(draft.types, (v) => setDraft({ ...draft, types: v }))}
          </>
        )}
        {error && <div className="text-xs text-red-500">{error}</div>}
        <div className="flex gap-2 pt-1">
          <button onClick={submitAdd} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700">Add</button>
          <button onClick={cancelAdd} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print:hidden fixed inset-0 z-50 p-2 md:p-5" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <h3 className="ft-serif text-2xl">Settings</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <nav className="px-2 space-y-0.5">
            {SECTIONS.map(({ id, label, icon: Icon, hint }) => (
              <button key={id} onClick={() => { setSection(id); setSel(null); setAdding(null); setConfirmDel(null); setMenuFor(null); setShowOthers(false); setRename(null); setCoRename(null); }} className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left ${section === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon size={15} className={section === id ? "" : "text-slate-400"} />
                <span className="flex-1">{label}</span>
                {hint && <span className={`text-[10px] ${section === id ? "text-white/70" : "text-slate-400"}`}>{hint}</span>}
              </button>
            ))}
          </nav>
          <div className="mt-auto p-4 text-[11px] text-slate-400 border-t border-slate-100 space-y-0.5">
            {settings.ops?.lastImport && <div>Book imported {new Date(settings.ops.lastImport.at).toLocaleDateString()}{settings.ops.lastImport.by ? ` by ${settings.ops.lastImport.by}` : ""}</div>}
            {settings.ops?.lastBackup && <div>Last backup {new Date(settings.ops.lastBackup.at).toLocaleDateString()}</div>}
          </div>
        </aside>

        {section === "materials" ? (
          <>
            <div className="w-44 shrink-0 border-r border-slate-200 overflow-y-auto py-3 px-2 space-y-0.5">
              <div className="ft-eyebrow text-[10px] text-slate-400 px-1.5 mb-1">Materials</div>
              {MATERIAL_CATEGORIES.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => openCat(id)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left ${cat === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  <Icon size={14} className={cat === id ? "" : "text-slate-400"} />
                  <span className="flex-1 truncate">{label}</span>
                  <Lock size={10} className={cat === id ? "text-white/60" : "text-slate-300"} />
                </button>
              ))}
              <div className="ft-eyebrow text-[10px] text-slate-400 px-1.5 pt-3 mb-1">Add-ons</div>
              {(catalog.categories || []).length === 0 && <p className="px-1.5 text-[11px] text-slate-400">None yet.</p>}
              {(catalog.categories || []).map((c) => (
                <button key={c.id} onClick={() => openCat(c.id)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left ${cat === c.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  <Tag size={14} className={cat === c.id ? "" : "text-slate-400"} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {!c.enabled && <span className={`text-[10px] ${cat === c.id ? "text-white/70" : "text-slate-400"}`}>off</span>}
                </button>
              ))}
              <button onClick={openNewCategory} className="w-full flex items-center gap-1.5 text-xs rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-slate-500 hover:bg-slate-50 mt-1"><Plus size={12} /> New category</button>
            </div>
            <div className="w-72 shrink-0 border-r border-slate-200 overflow-y-auto py-2">
              <p className="px-3 pb-1.5 text-[11px] text-slate-400">Uncheck a company or product to hide it from the job dropdowns — it stays stored, and jobs that already use it are unaffected.</p>
              {catalog.companies.filter(inSection).map((co) => (
                <div key={co.id} className="mb-1">
                  {companyHeader(co)}
                  {kindsFor.flatMap((kind) => prodsOf(co, kind).map((p) => { const active = sel && sel.companyId === co.id && sel.kind === kind && sel.productId === p.id; return (
                    <button key={p.id} onClick={() => pickProduct(co.id, kind, p.id)} className={`w-full text-left pl-9 pr-2.5 py-1.5 flex items-center gap-2 border-l-2 ${active ? "border-indigo-600 bg-indigo-50/40" : "border-transparent hover:bg-slate-50"}`}>
                      <span className="min-w-0 flex-1">
                        <span className={`flex items-center gap-1 text-sm ${p.enabled ? "font-medium" : "text-slate-400"}`}><span className="truncate">{p.name}</span>{(kind === "attached" ? isCategoryDefault(p) : isDefaultMaterial(kind, p.name)) && <Star size={10} className="fill-current text-indigo-500 shrink-0" title="Chip default" />}</span>
                        <span className="block text-[10px] text-slate-400 truncate">{masterHint(kind, p)}</span>
                      </span>
                      <ChevronRight size={13} className="text-slate-300 shrink-0" />
                    </button>
                  ); }))}
                </div>
              ))}
              {(() => { const others = catalog.companies.filter((co) => !inSection(co)); return others.length > 0 && (
                <div className="mt-1 border-t border-slate-100 pt-1">
                  <button onClick={() => setShowOthers(!showOthers)} className="w-full px-3 py-1 flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600">
                    <ChevronRight size={11} className={`transition-transform ${showOthers ? "rotate-90" : ""}`} />
                    <span className="flex-1 text-left">Companies with no {kindsFor[0] === "attached" ? `${kindLabel("attached")} products` : `${kindLabel(kindsFor[0])}s`}</span>
                    <span>{others.length}</span>
                  </button>
                  {showOthers && others.map((co) => <div key={co.id}>{companyHeader(co)}</div>)}
                </div>
              ); })()}
              <div className="px-3 pt-2 mt-1 border-t border-slate-100 flex gap-2 items-center">
                <input placeholder="New company" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitCompany(); }} className={inp + " flex-1"} />
                <button onClick={submitCompany} className="text-xs rounded-md border border-slate-200 px-2 py-2 hover:bg-slate-50 flex items-center gap-1 shrink-0"><Plus size={12} /> Add</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              {adding ? renderAddForm()
                : selProd && sel.kind === "grouts" ? renderGroutDetail(selCo, selProd)
                  : selProd && sel.kind === "mortars" ? renderMortarDetail(selCo, selProd)
                    : selProd && sel.kind === "attached" ? renderAttachedDetail(selCo, selProd)
                      : selProd ? renderUnderlayDetail(selCo, selProd)
                        : customCat ? renderCustomCategoryPane() : renderCategoryPane()}
            </div>
          </>
        ) : section === "profile" ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="ft-serif text-3xl">Your details</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">Your contact info prints at the top of the estimate ("Your salesperson") so the customer knows who to reach. It's saved with your login — each person on the team sets their own.</p>
            <div className="mt-5 space-y-3 max-w-md">
              <div><label className={lbl}>Name</label><input value={profile.name} onChange={(e) => saveProfile({ name: e.target.value })} placeholder="Your name" className={inp} /></div>
              <div><label className={lbl}>Phone</label><input value={profile.phone} onChange={(e) => saveProfile({ phone: e.target.value })} placeholder="Phone number" className={inp} /></div>
              <div><label className={lbl}>Email</label><input value={profile.email} onChange={(e) => saveProfile({ email: e.target.value })} placeholder={user.email || "Email"} className={inp} /></div>
            </div>
            <p className="text-xs text-slate-400 mt-4">Signed in as {user.email}. Leave a field blank to keep it off the estimate.</p>
          </div>
        ) : section === "general" ? (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="ft-serif text-3xl">General</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl">Calibrate coverage to your real-world results and set unit prices. Grout scales automatically for tile size, joint, and thickness from a 12×12×3/8" / 1/8"-joint baseline.</p>
            <div className="mt-5 flex gap-6">
              <div><label className={lbl}>Tile waste (%)</label><input type="number" value={settings.waste.tile} onChange={(e) => setSettings({ waste: { ...settings.waste, tile: e.target.value } })} className={inp + " w-28"} /></div>
              <div><label className={lbl}>Flooring waste (%)</label><input type="number" value={settings.waste.floor} onChange={(e) => setSettings({ waste: { ...settings.waste, floor: e.target.value } })} className={inp + " w-28"} /><div className="text-[11px] text-slate-400 mt-1">Hardwood, vinyl, laminate, carpet</div></div>
              <div className="text-[11px] text-slate-400 self-end pb-1 max-w-[15rem]">The rates a new project starts with. Each job carries its own waste from there — changing these never touches a project that already exists.</div>
            </div>
            <div className="mt-8 pt-6 border-t border-slate-100">
              <label className={lbl}>Appearance</label>
              <p className="text-[11px] text-slate-400 mt-1 mb-2.5 max-w-md">Applies on this device only. The printed estimate stays on white paper.</p>
              <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-sm">
                {[{ v: "system", label: "System", icon: Laptop }, { v: "light", label: "Light", icon: Sun }, { v: "dark", label: "Dark", icon: Moon }].map(({ v, label, icon: Icon }) => (
                  <button key={v} onClick={() => setTheme(v)} className={`flex items-center gap-1.5 px-3.5 py-2 font-medium ${theme === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}><Icon size={14} /> {label}</button>
                ))}
              </div>
            </div>
          </div>
        ) : section === "book" ? (
          <PriceBookLibrary books={books} stock={stock} stockReady={stockReady} addBook={addBook} updateBook={updateBook} delBook={delBook} loadBookItems={loadBookItems} applyBookImport={applyBookImport} loadBookVersions={loadBookVersions} loadBookVersionSnapshot={loadBookVersionSnapshot} pinBookVersion={pinBookVersion} updateBookItem={updateBookItem} setBookItemsDisabled={setBookItemsDisabled} reviewBookItemFlags={reviewBookItemFlags} setStockItemsDisabled={setStockItemsDisabled} rollbackStock={rollbackStock} importing={importing} importPriceBook={importPriceBook} importStockFile={importStockFile} pbRef={pbRef} settings={settings} setSettings={setSettings} gFamilies={gFamilies} inp={inp} lbl={lbl} types={types} typeLabels={typeLabels} />
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="ft-serif text-3xl">Backup &amp; restore</h2>
            <p className="text-xs text-slate-400 mt-2 max-w-xl">Download everything (customers, versions, settings, attachments) as one file. Restoring adds each customer from the file as a new entry — nothing existing is overwritten.</p>
            {settings.ops?.lastBackup && <p className="text-xs text-slate-400 mt-1">Last backup downloaded {new Date(settings.ops.lastBackup.at).toLocaleDateString()}{settings.ops.lastBackup.by ? ` by ${settings.ops.lastBackup.by}` : ""}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={exportBackup} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600"><Download size={14} /> Download backup</button>
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-sm rounded-md border border-slate-200 hover:bg-slate-50 px-3 py-1.5 text-slate-600"><Upload size={14} /> Restore backup</button>
              <input ref={fileRef} type="file" accept="application/json" onChange={importBackup} className="hidden" />
            </div>
          </div>
        )}
        {addingCat && (
          <Modal title="New category" onClose={() => setAddingCat(false)}>
            <label className={lbl}>Name</label>
            <input className={inp} value={catDraft.name} autoFocus placeholder="e.g. Trim, Sealer, Thresholds" onChange={(e) => setCatDraft({ ...catDraft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submitCategory()} />
            <div className="mt-3">{typeChips(catDraft.floorTypes, (v) => setCatDraft({ ...catDraft, floorTypes: v }), floorTypeList)}</div>
            <label className={lbl + " mt-3"}>Quantity</label>
            <div className="flex gap-2">
              {[["coverage", "Coverage", "Sq ft per unit — scales off the row's area plus waste"], ["manual", "Manual", "Typed per-row quantity — no area math"]].map(([k, t, d]) => (
                <button key={k} onClick={() => setCatDraft({ ...catDraft, math: k })} className={`flex-1 text-left rounded-lg border px-3 py-2 ${catDraft.math === k ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                  <div className="text-sm font-medium">{t}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{d}</div>
                </button>
              ))}
            </div>
            {catError && <div className="text-xs text-red-500 mt-2">{catError}</div>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAddingCat(false)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
              <button onClick={submitCategory} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Create category</button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

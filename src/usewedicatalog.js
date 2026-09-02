// The wedi catalog: live registry rows for BOTH halves through wediadapter.js,
// with the transcribed WEDI_STOCK and WEDI_SO tables as VISIBLE fallbacks
// (specs 2026-09-01 and 2026-09-02).
//
// LAZY-CHUNK-ONLY — this file imports wediadapter.js and wedi.js, so only a
// React.lazy popup may import it, never anything on the boot path.
//
// This is the ONLY place allowed to call setStockSource/clearStockSource/
// setSoSource/clearSoSource. The engine's source is module-level state shared
// by every wedi.js consumer — including comparekit.js, which the SCHLUTER
// popup's Compare tab reaches. Any new lazy entry point that reads wedi's
// catalog must call this hook first, or it will read whichever source the
// last popup happened to install. There are exactly two callers today:
// WediConfigurator's wrapper, and CompareTab (which runs it for the Schluter
// host, where nothing upstream installs anything).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adaptBookRows, adaptSoRows } from "./wediadapter.js";
import {
  catalog, setStockSource, clearStockSource, setSoSource, clearSoSource,
  stockSourceIs, soSourceIs, missingRequiredParts,
} from "./wedi.js";

/**
 * Ids of the active stock-kind books that say wedi.
 *
 * `\b`-anchored: an unanchored /wedi/i matches "Swedish", and a "Swedish oak"
 * stock book would then be selected, adapt to zero rows, and (before the
 * gate below was fixed) fly an on-the-book marker over the fallback table.
 */
export function pickWediBooks(books) {
  return (books || [])
    .filter((b) => b.kind === "stock" && b.active !== false
      && /\bwedi\b/i.test((b.name || "") + " " + ((b.data && b.data.brandLabel) || "")))
    .map((b) => b.id);
}

/** Ids of the active ORDER-kind books that say wedi — the pricelist book (8b). */
export function pickWediSoBooks(books) {
  return (books || [])
    .filter((b) => b.kind === "order" && b.active !== false
      && /\bwedi\b/i.test((b.name || "") + " " + ((b.data && b.data.brandLabel) || "")))
    .map((b) => b.id);
}

/** Fold per-book fetch results into rows, or null when ANY fetch failed. */
export function foldBookLists(lists) {
  if (!lists || lists.some((l) => l === null || l === undefined)) return null;
  return lists.flat().filter((it) => it.active !== false && !it.disabled);
}

/**
 * The gate, extracted as a pure function so its transition table can be unit
 * tested without a React renderer. Two subtleties, each of which was a live
 * stale-pricing bug in an earlier draft:
 *
 * - `loadedIds` must equal `targetIds`. Rows fetched for a previous book set —
 *   including the `[]` written when there was no book yet — must never satisfy
 *   the gate for a new one. Books metadata hydrating AFTER this popup mounts is
 *   the ordinary path, not a rare race.
 * - `onBook` keys off `adapted`, the POST-adapter rows, because that is what
 *   gets installed. A book whose rows all lack a wedi part number adapts to
 *   `[]`, and `setStockSource([])` collapses to the fallback — so gating on the
 *   pre-adapter count would fly an on-the-book marker over the transcribed
 *   table. A book that adapts to nothing is an empty book.
 */
export function gateOf({ targetIds, bookStockReady, loadedIds, rows, adapted }) {
  if (!targetIds) return { catReady: true, onBook: false };   // no book — fallback is legitimate
  const fresh = loadedIds === targetIds;
  const catReady = !!bookStockReady && fresh && rows !== null;
  return { catReady, onBook: catReady && !!(adapted && adapted.length) };
}

/**
 * "The book's fetch came back empty-handed", as distinct from "not in yet" —
 * extracted pure for the same reason gateOf is, since the difference decides
 * whether the popup offers a retry or sits on a spinner forever.
 *
 * `rows === null` alone does NOT say it: the hook also writes null while a book
 * exists but no loader has arrived, which is ordinary waiting. Only a settled
 * fetch sets `err`.
 */
export function bookErrorOf({ targetIds, loadedIds, err }) {
  return !!targetIds && loadedIds === targetIds && !!err;
}

/**
 * Install what the two gates decided, then apply the plausibility floor
 * (spec 2026-09-02, decision 6): if any SKU.* constant resolves on NEITHER
 * installed source, refuse the pricelist book first — it is the book the
 * floor exists for — then the stock book, until every part resolves. What
 * is refused falls back to its transcribed table, and the caption says so
 * with the part numbers. Returns the decision: the re-assert effect replays
 * it, the caption reads it.
 */
export function installSources({ stock, so }) {
  const apply = (s, o) => {
    if (s) setStockSource(s); else clearStockSource();
    if (o) setSoSource(o); else clearSoSource();
    return missingRequiredParts();
  };
  const missing = { stock: [], so: [] };
  let stockRows = stock && stock.length ? stock : null;
  let soRows = so && so.length ? so : null;
  let gone = apply(stockRows, soRows);
  if (gone.length && soRows) { missing.so = gone; soRows = null; gone = apply(stockRows, soRows); }
  if (gone.length && stockRows) { missing.stock = gone; stockRows = null; gone = apply(stockRows, soRows); }
  return { stock: stockRows, so: soRows, onBook: { stock: !!stockRows, so: !!soRows }, missing };
}

/** The Browse caption's suffix: which half is on its transcribed table, and why. */
export function fallbackCaption(onBook, missing) {
  const off = [];
  if (!onBook || !onBook.stock) off.push("stock table");
  if (!onBook || !onBook.so) off.push("pricelist");
  if (!off.length) return "";
  const parts = [...new Set([...((missing && missing.stock) || []), ...((missing && missing.so) || [])])];
  const shown = parts.length > 3 ? [...parts.slice(0, 3), "…"].join(", ") : parts.join(", ");
  return " · transcribed " + (off.length === 2 ? "tables" : off[0])
    + (parts.length ? ` (book is missing ${parts.length} required part${parts.length === 1 ? "" : "s"}: ${shown})` : "");
}

// One half's fetch state: the rows AND the id-set they were fetched for
// travel together, which is what makes a stale result detectable at render
// time (see gateOf). Both halves run this; the loader ref and nonce are shared.
function useHalf({ enabled, targetIds, loaderRef, hasLoader, nonce }) {
  const [loaded, setLoaded] = useState({ ids: null, rows: null, err: false });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const ids = targetIds ? targetIds.split("|") : [];
    if (!ids.length) { setLoaded({ ids: targetIds, rows: [], err: false }); return; }
    const load = loaderRef.current;
    if (!load) { setLoaded({ ids: targetIds, rows: null, err: false }); return; }  // book, no loader — WAIT
    Promise.all(ids.map((id) => load(id).catch(() => null)))
      // A failed fetch is null, NOT []: one failure among several nulls the
      // whole half — a partial catalog quotes wrong without looking wrong.
      .then((lists) => {
        if (!alive) return;
        const rows = foldBookLists(lists);
        setLoaded({ ids: targetIds, rows, err: rows === null });
      })
      .catch(() => { if (alive) setLoaded({ ids: targetIds, rows: null, err: true }); });
    return () => { alive = false; };
  }, [enabled, targetIds, hasLoader, nonce]);
  return [loaded, setLoaded];
}

/**
 * @param {object} p
 * @param {boolean} p.bookStockReady  the boot stock cache is up. The wedi book
 *   is fetched straight from `price_book_items`, NOT out of that cache — but it
 *   is the same readiness signal the rest of the pricing surface waits on, and
 *   holding the catalog until it is up keeps the popup from opening priced one
 *   way and re-pricing a beat later. Kept deliberately; it is not a leftover.
 * @param {Array}   p.books           book metadata (may hydrate after mount)
 * @param {Function} p.loadBookItems  async (bookId) => rows
 * @param {boolean} p.enabled  defaults true; false makes the hook INERT — no fetch, no
 *   install, no clear, `catReady:false`. For a caller that must obey the rules
 *   of hooks but whose host has already installed the source (CompareTab inside
 *   the wedi popup). Never pass `false` on a path that reads wedi prices.
 * @returns {{cat: Array, catReady: boolean, onBook: {stock: boolean, so: boolean},
 *   caption: string, bookError: boolean, retryBook: Function}}
 */
export function useWediCatalog({ bookStockReady, books, loadBookItems, enabled = true }) {
  // Held in a ref, keyed on whether a loader EXISTS — see the 8a note: the
  // loader is re-created every render and as a dependency re-fired a full
  // fetch (and a rebuild of the catalog) on every keystroke behind the popup.
  const loaderRef = useRef(loadBookItems);
  useEffect(() => { loaderRef.current = loadBookItems; });
  const hasLoader = !!loadBookItems;
  const [nonce, setNonce] = useState(0);

  const stockIds = pickWediBooks(books).join("|");
  const soIds = pickWediSoBooks(books).join("|");
  const [stockLoaded, setStockLoaded] = useHalf({ enabled, targetIds: stockIds, loaderRef, hasLoader, nonce });
  const [soLoaded, setSoLoaded] = useHalf({ enabled, targetIds: soIds, loaderRef, hasLoader, nonce });

  const stockAdapted = useMemo(() => (stockLoaded.rows ? adaptBookRows(stockLoaded.rows) : null), [stockLoaded.rows]);
  const soAdapted = useMemo(() => (soLoaded.rows ? adaptSoRows(soLoaded.rows) : null), [soLoaded.rows]);
  const stockGate = gateOf({ targetIds: stockIds, bookStockReady, loadedIds: stockLoaded.ids, rows: stockLoaded.rows, adapted: stockAdapted });
  const soGate = gateOf({ targetIds: soIds, bookStockReady, loadedIds: soLoaded.ids, rows: soLoaded.rows, adapted: soAdapted });
  const catReady = enabled && stockGate.catReady && soGate.catReady;

  // The install happens inside a useMemo so the catalog() below reads the
  // sources THIS render decided on (8a's reasoning); the effect after it puts
  // the decision back if React abandoned the render that made it.
  const plan = useMemo(
    () => (catReady ? installSources({ stock: stockGate.onBook ? stockAdapted : null, so: soGate.onBook ? soAdapted : null }) : null),
    [catReady, stockGate.onBook, soGate.onBook, stockAdapted, soAdapted]);
  const cat = useMemo(() => (plan ? catalog() : []), [plan]);
  useEffect(() => {
    if (!plan) return;
    if (!stockSourceIs(plan.stock) || !soSourceIs(plan.so)) installSources(plan);
  }, [plan]);

  const bookError = enabled && (
    bookErrorOf({ targetIds: stockIds, loadedIds: stockLoaded.ids, err: stockLoaded.err })
    || bookErrorOf({ targetIds: soIds, loadedIds: soLoaded.ids, err: soLoaded.err }));
  const retryBook = useCallback(() => {
    setStockLoaded({ ids: null, rows: null, err: false });
    setSoLoaded({ ids: null, rows: null, err: false });
    setNonce((n) => n + 1);
  }, []);

  const onBook = plan ? plan.onBook : { stock: false, so: false };
  const caption = plan ? fallbackCaption(plan.onBook, plan.missing) : "";
  return { cat, catReady, onBook, caption, bookError, retryBook };
}

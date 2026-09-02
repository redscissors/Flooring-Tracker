// The wedi stock catalog: live registry rows through wediadapter.js, with the
// transcribed WEDI_STOCK table as a VISIBLE fallback (spec 2026-09-01, and the
// owner's tightening of decision 3 on the same date).
//
// LAZY-CHUNK-ONLY — this file imports wediadapter.js and wedi.js, so only a
// React.lazy popup may import it, never anything on the boot path.
//
// This is the ONLY place allowed to call setStockSource/clearStockSource. The
// engine's source is module-level state shared by every wedi.js consumer —
// including comparekit.js, which the SCHLUTER popup's Compare tab reaches. Any
// new lazy entry point that reads wedi's catalog must call this hook first, or
// it will read whichever source the last popup happened to install. There are
// exactly two callers today: WediConfigurator's wrapper, and CompareTab (which
// runs it for the Schluter host, where nothing upstream installs anything).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adaptBookRows } from "./wediadapter.js";
import { catalog, setStockSource, clearStockSource, stockSourceIsBook } from "./wedi.js";

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
 */
export function useWediCatalog({ bookStockReady, books, loadBookItems, enabled = true }) {
  // The rows AND the id-set they were fetched for travel together — that
  // pairing is what makes a stale result detectable at render time. `err`
  // separates "the fetch came back empty-handed" from "no loader yet, still
  // waiting": both leave `rows` null, and only one of them is worth showing
  // the user a retry button for.
  const [loaded, setLoaded] = useState({ ids: null, rows: null, err: false });
  const [nonce, setNonce] = useState(0);
  const targetIds = pickWediBooks(books).join("|");

  // `loadBookItems` is a plain arrow re-created on every render of useBooks, and
  // App re-renders constantly — as a dependency it re-fired a full book fetch
  // (and a setStockSource, which nulls CAT/INDEX and rebuilds all 151 entries)
  // on every keystroke in the app behind the popup. It is held in a ref instead,
  // and the effect keys on whether a loader EXISTS. That still covers the bug
  // this dependency was added for: a loader arriving after mount flips
  // `hasLoader` false→true and re-runs the fetch, so the hook can't wedge at
  // catReady:false. Only identity churn is ignored, which is the point.
  const loaderRef = useRef(loadBookItems);
  useEffect(() => { loaderRef.current = loadBookItems; });
  const hasLoader = !!loadBookItems;

  // Keyed on the matching book ids, not run-once: an open-layer restore can
  // mount this popup before the books metadata hydrates, and the rows must
  // arrive when it does rather than being dropped for the session.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const ids = targetIds ? targetIds.split("|") : [];
    if (!ids.length) { setLoaded({ ids: targetIds, rows: [], err: false }); return; }
    const load = loaderRef.current;
    if (!load) { setLoaded({ ids: targetIds, rows: null, err: false }); return; }  // book, no loader — WAIT
    Promise.all(ids.map((id) => load(id).catch(() => null)))
      // A failed fetch is null, NOT []. Falling back on a failure is exactly
      // the stale-pricing hazard this gate exists to prevent, and one failure
      // among several nulls the whole result: a partial catalog is a book
      // missing SKUs, which quotes wrong without looking wrong.
      .then((lists) => {
        if (!alive) return;
        const rows = foldBookLists(lists);
        setLoaded({ ids: targetIds, rows, err: rows === null });
      })
      .catch(() => { if (alive) setLoaded({ ids: targetIds, rows: null, err: true }); });
    return () => { alive = false; };
  }, [enabled, targetIds, hasLoader, nonce]);

  const adapted = useMemo(() => (loaded.rows ? adaptBookRows(loaded.rows) : null), [loaded.rows]);
  const gate = gateOf({
    targetIds, bookStockReady, loadedIds: loaded.ids, rows: loaded.rows, adapted,
  });
  const catReady = enabled && gate.catReady;
  const onBook = enabled && gate.onBook;

  const cat = useMemo(() => {
    if (!catReady) return [];
    if (onBook) setStockSource(adapted);
    else clearStockSource();
    return catalog();
  }, [catReady, onBook, adapted]);

  // The install above happens inside a useMemo so that the `catalog()` on the
  // next line reads the source this render decided on. A memo can run in a
  // render React then ABANDONS, though, and module state does not roll back
  // with it — so the committed tree could be left reading a source it never
  // chose. This puts it back. Cheap by construction: it writes only when the
  // module actually disagrees, and it is the write that clears CAT/INDEX, so
  // an ordinary commit rebuilds nothing.
  useEffect(() => {
    if (!catReady) return;
    if (onBook) { if (!stockSourceIsBook()) setStockSource(adapted); }
    else if (stockSourceIsBook()) clearStockSource();
  }, [catReady, onBook, adapted]);

  const bookError = enabled && bookErrorOf({ targetIds, loadedIds: loaded.ids, err: loaded.err });

  const retryBook = useCallback(() => {
    setLoaded({ ids: null, rows: null, err: false });
    setNonce((n) => n + 1);
  }, []);

  return { cat, catReady, onBook, bookError, retryBook };
}

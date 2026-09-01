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
// it will read whichever source the last popup happened to install.
import { useEffect, useMemo, useState } from "react";
import { adaptBookRows } from "./wediadapter.js";
import { catalog, setStockSource, clearStockSource } from "./wedi.js";

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

export function useWediCatalog({ stockRows, bookStockReady, books, loadBookItems }) {
  // The rows AND the id-set they were fetched for travel together — that
  // pairing is what makes a stale result detectable at render time.
  const [loaded, setLoaded] = useState({ ids: null, rows: null });
  const targetIds = pickWediBooks(books).join("|");

  // Keyed on the matching book ids, not run-once: an open-layer restore can
  // mount this popup before the books metadata hydrates, and the rows must
  // arrive when it does rather than being dropped for the session.
  useEffect(() => {
    let alive = true;
    const ids = targetIds ? targetIds.split("|") : [];
    if (!ids.length) { setLoaded({ ids: targetIds, rows: [] }); return; }
    if (!loadBookItems) { setLoaded({ ids: targetIds, rows: null }); return; }  // book, no loader — WAIT
    Promise.all(ids.map((id) => loadBookItems(id).catch(() => null)))
      // A failed fetch is null, NOT []. Falling back on a failure is exactly
      // the stale-pricing hazard this gate exists to prevent, and one failure
      // among several nulls the whole result: a partial catalog is a book
      // missing SKUs, which quotes wrong without looking wrong.
      .then((lists) => { if (alive) setLoaded({ ids: targetIds, rows: foldBookLists(lists) }); })
      .catch(() => { if (alive) setLoaded({ ids: targetIds, rows: null }); });
    return () => { alive = false; };
  }, [targetIds, loadBookItems]);

  const adapted = useMemo(() => (loaded.rows ? adaptBookRows(loaded.rows) : null), [loaded.rows]);
  const { catReady, onBook } = gateOf({
    targetIds, bookStockReady, loadedIds: loaded.ids, rows: loaded.rows, adapted,
  });

  const cat = useMemo(() => {
    if (!catReady) return [];
    if (onBook) setStockSource(adapted);
    else clearStockSource();
    return catalog();
  }, [catReady, onBook, adapted]);

  return { cat, catReady, onBook };
}

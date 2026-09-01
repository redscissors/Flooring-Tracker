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

/** Ids of the active stock-kind books that say wedi. */
export function pickWediBooks(books) {
  return (books || [])
    .filter((b) => b.kind === "stock" && b.active !== false
      && /wedi/i.test((b.name || "") + " " + ((b.data && b.data.brandLabel) || "")))
    .map((b) => b.id);
}

export function useWediCatalog({ stockRows, bookStockReady, books, loadBookItems }) {
  const [bookRows, setBookRows] = useState(null);
  const targetIds = pickWediBooks(books).join("|");

  // Keyed on the matching book ids, not run-once: an open-layer restore can
  // mount this popup before the books metadata hydrates, and the rows must
  // arrive when it does rather than being dropped for the session.
  useEffect(() => {
    let alive = true;
    const ids = targetIds ? targetIds.split("|") : [];
    if (!ids.length) { setBookRows([]); return; }         // no book — fallback is legitimate
    if (!loadBookItems) { setBookRows(null); return; }     // book exists, no loader — WAIT
    Promise.all(ids.map((id) => loadBookItems(id).catch(() => null)))
      .then((lists) => {
        if (!alive) return;
        // A failed fetch is null, NOT []. Falling back on a failure is exactly
        // the stale-pricing hazard this gate exists to prevent.
        setBookRows(lists.some((l) => l === null) ? null
          : lists.flat().filter((it) => it.active !== false && !it.disabled));
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIds]);

  const hasBook = !!targetIds;
  // With a book, wait for its rows AND the boot cache. Without one, ready now.
  const catReady = hasBook ? (!!bookStockReady && bookRows !== null) : true;
  const onBook = hasBook && catReady && !!(bookRows && bookRows.length);

  const cat = useMemo(() => {
    if (!catReady) return [];
    if (onBook) setStockSource(adaptBookRows(bookRows));
    else clearStockSource();
    return catalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catReady, onBook, bookRows, stockRows]);

  return { cat, catReady, onBook };
}

// Shared registry->catalog assembly for the Schluter popup (task 3, phase 5):
// moved verbatim off SchluterConfigurator.jsx so the Compare tab building
// inside the wedi popup can build the same live Schluter catalog without
// duplicating the assembly. LAZY-CHUNK-ONLY — this file imports
// schluteradapter.js, so only a React.lazy popup may import it, never
// anything on the boot path.
import { useEffect, useMemo, useState } from "react";
import { catalogOf } from "./schluter.js";
import { adaptBookRows, dropStockTwins } from "./schluteradapter.js";

// --- the catalog: live registry rows through the adapter -------------------
// Stock side: the boot cache's stock-kind rows (bookStockReady gates it).
// Special-order side: any active order book that says Schluter, fetched on
// open (ADR 0026's re-fetch-on-open pattern; the EFT import lands here).
export function useSchluterCatalog({ stockRows, bookStockReady, books, loadBookItems }) {
  const [orderRows, setOrderRows] = useState(null);
  // keyed on the matching book ids, not run-once: an open-layer restore can
  // mount this popup before stage 2's books metadata hydrates, and the EFT
  // rows must arrive when it does rather than being dropped for the session
  const targetIds = (books || []).filter((b) => b.kind === "order" && b.active !== false
    && /schluter/i.test((b.name || "") + " " + (b.data?.brandLabel || ""))).map((b) => b.id).join("|");
  useEffect(() => {
    let alive = true;
    const ids = targetIds ? targetIds.split("|") : [];
    if (!ids.length || !loadBookItems) { setOrderRows([]); return; }
    Promise.all(ids.map((id) => loadBookItems(id).catch(() => [])))
      .then((lists) => { if (alive) setOrderRows(lists.flat().filter((it) => it.active !== false && !it.disabled)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIds]);

  const catReady = !!bookStockReady && orderRows !== null;
  const cat = useMemo(() => {
    if (!catReady) return [];
    const stockAdapted = adaptBookRows((stockRows || []).filter((it) => it.active !== false && !it.disabled), { stock: true });
    // stock wins the collision in any spelling — the EFT re-letters mfg codes
    const orderAdapted = dropStockTwins(adaptBookRows(orderRows, { stock: false }), stockAdapted);
    return catalogOf(stockAdapted.concat(orderAdapted));
  }, [catReady, stockRows, orderRows]);

  return { cat, catReady };
}

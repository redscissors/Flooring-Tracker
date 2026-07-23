import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { searchStock, relaxSearchWords } from "./stock.js";
import { suggestSeries } from "./booklink.js";
import { mergeSearch } from "./orderbook.js";
import { useAnchoredPanel, vPos } from "./widgets.jsx";

export const SKU_SHOW = 30;

// A stable id for a search hit across stock and every order book — the same
// string used as the React key and to dedupe the multi-select. Stock items have
// no bookId; two order books can legitimately reuse a SKU, so the book scopes it.
export const hitKey = (it) => (it.bookId || "stock") + "|" + it.sku;

// The product's face size for a search row — thickness is its own field, so a
// vendor that jammed it onto the L×W (e.g. "12x24x9mm") gets trimmed back to the
// face dimensions; a non-rectangular shape ("2\" Hex") passes through whole.
export const faceSize = (it) => {
  const s = String(it?.size || "").trim();
  const m = s.match(/^\s*(\d+(?:\.\d+)?\s*["']?\s*[x×]\s*\d+(?:\.\d+)?\s*["']?)/i);
  return (m ? m[1] : s).trim();
};

const SizeChip = ({ it }) => {
  const sz = faceSize(it);
  return sz ? <span className="ft-mono text-[11px] font-semibold text-slate-500 shrink-0">{sz}</span> : null;
};

// Below md (the phone layout) the SKU drops to the second line so the size
// and description get the full first line of the narrow popup.
const StockHit = ({ it }) => (
  <>
    <div className="flex items-baseline gap-2">
      <span className="hidden md:inline ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
      <SizeChip it={it} />
      <span className="text-xs font-medium flex-1 min-w-0 break-words text-slate-900">{it.description || it.product || it.section}</span>
    </div>
    <div className="flex items-baseline gap-2 text-[11px] text-slate-400">
      <span className="md:hidden ft-mono shrink-0">{it.sku}</span>
      <span className="truncate">{[it.brand && !it.description.includes(it.brand) ? it.brand : it.section].filter(Boolean).join(" · ")}</span>
      <span className="ml-auto shrink-0 ft-mono">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>
    </div>
  </>
);

// A book search hit (ADR 0009 §6): StockHit's shape plus the book badge, the
// lead time a salesperson needs before quoting, and a freight flag (highlight
// only — no charge math, §3.6). A stock-kind book's item (it.stockKind, the
// ERP exports that replaced the shop workbook — ADR 0027) badges as stock at
// its real shelf price; an order item's price is the live sell (cost × book
// markup). The snapshot happens only on pick.
const OrderHit = ({ it, bookName }) => (
  <>
    <div className="flex items-baseline gap-2">
      <span className="hidden md:inline ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
      <SizeChip it={it} />
      <span className="text-xs font-medium flex-1 min-w-0 break-words text-slate-900">{it.description || it.product}</span>
      <span className="ml-auto shrink-0 ft-mono text-[11px]">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>
    </div>
    <div className="flex items-baseline gap-1.5 text-[11px]">
      <span className="md:hidden ft-mono text-slate-400 shrink-0">{it.sku}</span>
      <span className={`shrink-0 rounded px-1 font-medium ${it.stockKind ? "bg-slate-100 text-slate-500" : "bg-indigo-50 text-indigo-600"}`}>{bookName(it.bookId)}{it.stockKind ? " · stock" : " · special order"}</span>
      {it.leadTime && <span className="text-slate-400 truncate">{it.leadTime}</span>}
      {it.freightFlag && <span className="shrink-0 rounded px-1 bg-amber-50 text-amber-700 font-medium">+ freight</span>}
    </div>
  </>
);

// One search-result body: a book item badges with its book (stock or special
// order); an item with no book (a projected grout-family row) renders plain,
// plus an "also on {book}" note when the same SKU also lives in an order book
// (the collision resolved to stock — mergeSearch §6).
export const Hit = ({ it, bookName = () => "special order" }) => (
  it.bookId ? (
    <>
      <OrderHit it={it} bookName={bookName} />
      {it.alsoOn?.length > 0 && <div className="text-[11px] text-slate-400">also on {it.alsoOn.map(bookName).join(", ")}</div>}
    </>
  ) : (
    <>
      <StockHit it={it} />
      {it.alsoOn?.length > 0 && <div className="text-[11px] text-slate-400">also on {it.alsoOn.map(bookName).join(", ")}</div>}
    </>
  )
);

export const matchSummary = (shown, total) => total > shown ? `Showing ${shown} of ${total} matches — keep typing to narrow` : `${total} match${total === 1 ? "" : "es"}`;

// A search panel is as wide as the field it hangs off — the omni-search field
// spans most of the row, and a long vendor description needs every character it
// can get — but never narrower than SEARCH_PANEL_MIN (a SKU cell is only a few
// characters wide) and never wider than the viewport.
export const SEARCH_PANEL_MIN = 416;
export const searchPanelBox = (pos) => {
  const room = window.innerWidth - 16;
  const width = Math.min(Math.max(pos.width, SEARCH_PANEL_MIN), room);
  return { ...vPos(pos), maxHeight: pos.maxH, width, left: Math.max(8, Math.min(pos.left, window.innerWidth - width - 8)) };
};

// Order-book search for the selection-row pickers (ADR 0009 §6). Stock stays
// instant from the in-memory list; special-order matches stream in behind them
// from a debounced server query (searchOrder — null when no order books exist,
// which keeps the whole feature inert until one is imported).
function useOrderResults(query, searchOrder, strictness, fallback) {
  const [state, setState] = useState({ primary: [], fallback: [] });
  useEffect(() => {
    const q = (query || "").trim();
    if (!q || !searchOrder) { setState({ primary: [], fallback: [] }); return; }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const primary = await searchOrder(q, strictness);
        // The looser retry costs a second query, so only when the strict pass
        // came back empty and the fallback is genuinely looser (else it can't
        // surface anything the primary didn't).
        const fb = (!primary.length && fallback != null && strictness != null && fallback < strictness) ? await searchOrder(q, fallback) : [];
        if (!stale) setState({ primary, fallback: fb });
      } catch { if (!stale) setState({ primary: [], fallback: [] }); }
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [query, searchOrder, strictness, fallback]);
  return state;
}

// Instant stock matches + streamed order matches, merged stock-first with the
// exact-SKU collision resolved to stock (mergeSearch), then capped for display.
// Each stock match is shallow-copied so mergeSearch's alsoOn tag never lands on
// the shared in-memory stock objects.
const mergeCombined = (stockMatches, orderRaw) => {
  const { stock: sMatches, order: oMatches } = mergeSearch(stockMatches.map((it) => ({ ...it })), orderRaw);
  return [...sMatches, ...oMatches];
};

// A quiet banner over the results when they came from the looser fallback pass
// (the set strictness matched nothing), so a near-match is never mistaken for
// an exact one. Amber is the app's "approximate/attention" semantic, not chrome.
export const NearMatchNote = () => (
  <div className="shrink-0 px-2.5 py-1 text-[10.5px] font-semibold border-b border-amber-200 bg-amber-50 text-amber-700">
    No exact match — showing closest spellings
  </div>
);

export function useMergedResults(active, stock, query, searchOrder, strictness, fallback) {
  const order = useOrderResults(active ? query : "", searchOrder, strictness, fallback);
  const primary = mergeCombined(active ? searchStock(stock, query, strictness) : [], order.primary);
  if (primary.length) return { results: primary.slice(0, SKU_SHOW), total: primary.length, near: false };
  const useFb = active && fallback != null && strictness != null && fallback < strictness;
  const near = mergeCombined(useFb ? searchStock(stock, query, fallback) : [], order.fallback);
  return { results: near.slice(0, SKU_SHOW), total: near.length, near: near.length > 0 };
}

// Price book lookup for the Settings catalog's add-product form: picking an
// item pre-fills the draft (name, price, coverage when the book has one). No
// multi-select — catalog products are added one at a time.
export function StockSearch({ stock, onPick, inp, placeholder = "Search the price book to pre-fill (optional)…" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const matches = open ? searchStock(stock, q) : [];
  const results = matches.slice(0, SKU_SHOW);
  const pos = useAnchoredPanel(open, wrapRef, panelRef, () => setOpen(false));
  const pick = (it) => { onPick(it); setQ(`${it.sku} — ${it.description || it.product}`); setOpen(false); };
  return (
    <div ref={wrapRef} className="relative mb-1.5">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && results.length) { e.preventDefault(); pick(results[0]); } if (e.key === "Escape" && open && results.length) { e.preventDefault(); setOpen(false); } }}
        className={inp} placeholder={placeholder} />
      {open && pos && results.length > 0 && createPortal(
        <div ref={panelRef} style={{ ...vPos(pos), maxHeight: pos.maxH, left: pos.left, width: pos.width }} className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 flex flex-col">
          <div className="max-h-60 min-h-0 overflow-y-auto">
            {results.map((it) => (
              <button key={it.sku} onMouseDown={(e) => { e.preventDefault(); pick(it); }} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                <StockHit it={it} />
              </button>
            ))}
          </div>
          <div className="shrink-0 px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">{matchSummary(results.length, matches.length)}</div>
        </div>, document.body)}
    </div>
  );
}

// Collection-first picker for the family-seed modal: the query's stock-book
// matches cluster into candidate color series ("Permacolor Select — 40
// colors", booklink.js suggestSeries) listed above the plain rows, so a
// grout's color link grabs a whole collection in one pick. The single rows
// below stay the escape hatch for messy families the rule derivation can't
// cluster (e.g. DOIT's premixed grout).
export function SeriesSearch({ stock, itemsByBook, bookName = () => "book", onPickSeries, onPickRow, inp, initialQuery = "", placeholder = "Search the stock books…" }) {
  // The seed is often a retired-workbook family name whose brand word the ERP
  // descriptions never carry — relax it once (aiming for ≥2 rows, one hit is
  // usually just the base) so the box never opens dead.
  const [q, setQ] = useState(() => relaxSearchWords(stock, initialQuery, 2));
  const [open, setOpen] = useState(!!initialQuery.trim());
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const matches = useMemo(() => (open ? searchStock(stock, q) : []), [open, stock, q]);
  // Series derive off a slice of the hits: one query's matches overwhelmingly
  // share a frame, and deriveSeriesRule per hit is the costly part.
  const series = useMemo(() => suggestSeries(matches.slice(0, 12), itemsByBook), [matches, itemsByBook]);
  const results = matches.slice(0, SKU_SHOW);
  const pos = useAnchoredPanel(open, wrapRef, panelRef, () => setOpen(false));
  const pickSeries = (s) => { onPickSeries(s); setOpen(false); };
  const pickRow = (it) => { onPickRow(it); setOpen(false); };
  return (
    <div ref={wrapRef} className="relative mb-1.5">
      <input value={q} autoFocus onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (series.length || results.length)) { e.preventDefault(); series.length ? pickSeries(series[0]) : pickRow(results[0]); }
          if (e.key === "Escape" && open && (series.length || results.length || q.trim().length >= 2)) { e.preventDefault(); setOpen(false); }
        }}
        className={inp} placeholder={placeholder} />
      {open && pos && (series.length > 0 || results.length > 0 || q.trim().length >= 2) && createPortal(
        <div ref={panelRef} style={{ ...vPos(pos), maxHeight: pos.maxH, left: pos.left, width: pos.width }} className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 flex flex-col">
          <div className="max-h-72 min-h-0 overflow-y-auto">
            {series.length === 0 && results.length === 0 && (
              <div className="px-2.5 py-2 text-[11px] text-slate-400">No stock rows match — try fewer or different words (the exports rarely carry brand names, e.g. just "permacolor").</div>
            )}
            {series.map((s) => (
              <button key={`${s.bookId}|${s.rule.prefix}|${s.rule.suffix}`} onMouseDown={(e) => { e.preventDefault(); pickSeries(s); }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-indigo-50/60 border-b border-slate-100">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium truncate flex-1">{s.name}</span>
                  <span className="ft-mono text-[11px] text-indigo-600 shrink-0">{s.count} colors</span>
                </div>
                <div className="flex items-baseline gap-2 text-[11px] text-slate-400">
                  <span className="truncate">{s.sample.join(" · ")}{s.count > s.sample.length ? " · …" : ""}</span>
                  <span className="ml-auto shrink-0">{bookName(s.bookId)}</span>
                </div>
              </button>
            ))}
            {series.length > 0 && results.length > 0 && (
              <div className="px-2.5 py-1 text-[10px] font-medium text-slate-400 uppercase tracking-wide bg-slate-50/60 border-b border-slate-100">Single rows — seed a family by hand</div>
            )}
            {results.map((it) => (
              <button key={hitKey(it)} onMouseDown={(e) => { e.preventDefault(); pickRow(it); }} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                <StockHit it={it} />
              </button>
            ))}
          </div>
          {(series.length > 0 || results.length > 0) && (
            <div className="shrink-0 px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">
              {series.length > 0 && `${series.length} collection${series.length === 1 ? "" : "s"} · `}{matchSummary(results.length, matches.length)}
            </div>
          )}
        </div>, document.body)}
    </div>
  );
}

// Grout family lookup (ADR 0007): search the imported book's Grout & Caulk
// families to link a catalog grout's color source.
export function FamilySearch({ families, onPick, inp }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const t = q.trim().toLowerCase();
  const matches = open ? families.filter((f) => !t || `${f.brand} ${f.product}`.toLowerCase().includes(t)) : [];
  const pos = useAnchoredPanel(open, wrapRef, panelRef, () => setOpen(false));
  const pick = (f) => { onPick(f); setQ(""); setOpen(false); };
  return (
    <div ref={wrapRef} className="relative flex-1 min-w-0">
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" && matches.length) { e.preventDefault(); pick(matches[0]); } if (e.key === "Escape" && open && matches.length) { e.preventDefault(); setOpen(false); } }}
        className={inp} placeholder="Link colors — search the book's grout & caulk families…" />
      {open && pos && matches.length > 0 && createPortal(
        <div ref={panelRef} style={{ ...vPos(pos), maxHeight: Math.min(240, pos.maxH), left: pos.left, width: pos.width }} className="fixed rounded-md border border-slate-200 bg-white shadow-lg z-50 overflow-y-auto">
          {matches.map((f) => (
            <button key={f.product} onMouseDown={(e) => { e.preventDefault(); pick(f); }} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
              <div className="flex items-baseline gap-2"><span className="text-xs font-medium truncate flex-1">{f.product}</span><span className="ft-mono text-[11px] text-slate-400 shrink-0">{f.colors.length} colors</span></div>
              <div className="flex items-baseline gap-2 text-[11px] text-slate-400"><span className="truncate">{f.brand}</span>{f.price != null && <span className="ml-auto shrink-0 ft-mono">${f.price.toFixed(2)}</span>}</div>
            </button>
          ))}
        </div>, document.body)}
    </div>
  );
}

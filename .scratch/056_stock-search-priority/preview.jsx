// Preview harness for the exact-first, relevance-ranked item search
// (2026-07-27). Renders the REAL Hit row from search.jsx over the REAL
// searchStock / rankMerged output, so "before" is literally what the pickers
// showed (fuzzy primary, stock as a whole block) and "after" is what they show
// now. Served by the vite dev server; never shipped (lives in .scratch).
import React from "react";
import { createRoot } from "react-dom/client";
import { Hit, SKU_SHOW, matchSummary, NearMatchNote } from "../../src/search.jsx";
import { searchStock } from "../../src/stock.js";
import { mergeSearch, rankMerged } from "../../src/orderbook.js";
import "../../src/index.css";

const NAMES = { ohiva: "OHIVA", sheog: "SHEOG", doit: "DOIT", vtc: "Virginia Tile" };
const bookName = (id) => NAMES[id] || "special order";

// The stock books' rows from the reported search — every one of these is a
// 0.333 trigram near-miss on "hanoi" (they merely start "ha"), none of them
// contains the word.
const STOCK = [
  { sku: "28904", bookId: "ohiva", stockKind: true, description: "Mirage Red Oak Classic - New Haven W Brushed", priceSqft: 7.99, type: "hardwood" },
  { sku: "29490", bookId: "ohiva", stockKind: true, description: "Aquamix Cement Grout Haze Rmvr", price: 14.24 },
  { sku: "29497", bookId: "ohiva", stockKind: true, description: "Aquamix Grout Haze Clean-Up", price: 11.39 },
  { sku: "93790", bookId: "ohiva", stockKind: true, description: "Custom 380 Haystack Part A - Ceg-Lite Colorant", price: 33.29 },
  { sku: "93791", bookId: "ohiva", stockKind: true, description: "10.5oz Custom 380 Haystack - 100% Silicone Caulk", price: 19.19 },
  { sku: "26922", bookId: "sheog", stockKind: true, description: "4x10 Flush w/Frm Hard Maple - Wood Vent", price: 39.69, size: "4x10" },
  { sku: "26923", bookId: "sheog", stockKind: true, description: "4x12 Flush w/Frm Hard Maple - Wood Vent", price: 41.77, size: "4x12" },
  { sku: "31180", bookId: "doit", stockKind: true, description: "Halcyon Grey 12x24 Matte Porcelain", priceSqft: 3.09, type: "tile", size: "12x24" },
].map((it) => ({ ...it, active: true }));

// What the vendor book actually carries — the row the salesperson was after.
const ORDER = [
  { sku: "TL-4471", bookId: "vtc", description: "Hanoi Collection Hanoi White 2.5x8", priceSqft: 8.4, type: "tile", size: "2.5x8", leadTime: "2-3 weeks" },
  { sku: "TL-4472", bookId: "vtc", description: "Hanoi Collection Hanoi Sage 2.5x8", priceSqft: 8.4, type: "tile", size: "2.5x8", leadTime: "2-3 weeks" },
  { sku: "TL-4480", bookId: "vtc", description: "Hanoi Collection Bullnose White", price: 12.9, trim: true, leadTime: "2-3 weeks" },
].map((it) => ({ ...it, active: true }));

// Case 2 — everything here matches "mpb770" EXACTLY, so exact-first alone
// changes nothing; the ordering is the whole difference. (An ERP export really
// does carry the manufacturer code in the description tail, which is why the
// accessories match the query at all.)
const STOCK2 = [
  { sku: "44120", bookId: "ohiva", stockKind: true, description: "Mannington Adura Rigid Transition - fits MPB770VN1", price: 38.5, trim: true },
  { sku: "44121", bookId: "ohiva", stockKind: true, description: "Mannington MPB770 Color-Match Caulk 10.5oz", price: 17.25 },
].map((it) => ({ ...it, active: true }));

const ORDER2 = [
  { sku: "MPB770", bookId: "vtc", description: "Adura Max Napa Dry Cork 6x48 LVP", priceSqft: 4.29, type: "vinyl", size: "6x48", leadTime: "1-2 weeks" },
].map((it) => ({ ...it, active: true }));

const STRICTNESS = 0.3; // the team's current Settings value

// BEFORE — the fuzzy pass WAS the primary tier, and mergeSearch's output
// rendered as [...all stock, ...all order].
const before = (stock, order, q) => {
  const m = mergeSearch(searchStock(stock, q, STRICTNESS).map((it) => ({ ...it })), order);
  return [...m.stock, ...m.order];
};

// AFTER — exact first (no threshold), ranked across both spaces.
const after = (stock, order, q) => rankMerged(searchStock(stock, q).map((it) => ({ ...it })), order, q);

const Panel = ({ tone, title, note, rows, near }) => (
  <div className="flex-1 min-w-0">
    <div className={`text-[11px] font-semibold uppercase tracking-wide mb-1 ${tone}`}>{title}</div>
    <p className="text-[11px] text-slate-500 mb-2 leading-snug h-8">{note}</p>
    <div className="rounded-md border border-slate-200 bg-white shadow-lg flex flex-col overflow-hidden">
      {near && <NearMatchNote />}
      <div className="max-h-[420px] overflow-y-auto">
        {rows.length === 0 && <div className="px-2.5 py-2 text-[11px] text-slate-400">No matches</div>}
        {rows.slice(0, SKU_SHOW).map((it) => (
          <div key={(it.bookId || "stock") + "|" + it.sku} className="px-2.5 py-1.5 border-b border-slate-100 last:border-0">
            <Hit it={it} bookName={bookName} />
          </div>
        ))}
      </div>
      <div className="shrink-0 px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">
        {matchSummary(Math.min(rows.length, SKU_SHOW), rows.length)}
      </div>
    </div>
  </div>
);

// The Settings → Price book "Item search" card, markup lifted verbatim from
// pricebooklib.jsx so the reworded controls can be read in place.
const SettingsCard = () => (
  <div className="w-[168px] rounded-xl border border-slate-200 bg-white p-2 flex flex-col gap-1">
    <span className="ft-eyebrow text-[10px]">Item search</span>
    <p className="text-[10px] text-slate-400 leading-snug -mt-0.5">Exact matches always come first — in stock and special order alike. These tune the retry when nothing matches exactly.</p>
    <div className="flex flex-col gap-1 text-[11px] text-slate-600">
      <div>
        <div className="flex items-baseline justify-between gap-1.5">
          <span className="font-medium">Near-match</span>
          <span className="ft-mono text-[10px] font-semibold text-slate-500">Balanced · 0.30</span>
        </div>
        <input type="range" min="0.1" max="0.9" step="0.05" defaultValue={0.3} className="w-full h-1.5" style={{ accentColor: "var(--ft-brand)" }} />
        <div className="flex justify-between text-[10px] text-slate-400"><span>Loose</span><span>Strict</span></div>
      </div>
      <div className="mt-1 pt-1 border-t border-slate-100">
        <div className="flex items-baseline justify-between gap-1.5">
          <span className="font-medium">Wider retry</span>
          <span className="ft-mono text-[10px] font-semibold text-slate-500">Off</span>
        </div>
        <input type="range" min="0.1" max="0.9" step="0.05" defaultValue={0.9} className="w-full h-1.5" style={{ accentColor: "var(--ft-brand)" }} />
        <div className="flex justify-between text-[10px] text-slate-400"><span>Wider</span><span>Off</span></div>
      </div>
    </div>
  </div>
);

const Case = ({ q, blurb, stock, order, beforeNote, afterNote }) => (
  <div className="mb-8 max-w-5xl">
    <h2 className="text-sm font-semibold mb-1">Product-row search for “{q}”</h2>
    <p className="text-xs text-slate-500 mb-3">{blurb}</p>
    <div className="flex gap-5 items-start">
      <Panel tone="text-rose-600" title="Before" rows={before(stock, order, q)} near={false} note={beforeNote} />
      <Panel tone="text-emerald-700" title="After" rows={after(stock, order, q)} near={false} note={afterNote} />
    </div>
  </div>
);

function App() {
  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <Case q="hanoi" stock={STOCK} order={ORDER}
        blurb="Same eight stock rows, same three Virginia Tile rows, same 0.30 Settings value. The reported bug — exact-first is what fixes it."
        beforeNote="Fuzzy at 0.30 was the primary tier, and stock rendered as a whole block first — so eight near-misses that merely start “ha” outranked the vendor book’s actual Hanoi."
        afterNote="Exact first: none of the stock rows contain “hanoi”, so they are gone. What is left is ranked by relevance across both spaces." />
      <Case q="mpb770" stock={STOCK2} order={ORDER2}
        blurb="Every row here matches exactly, so exact-first changes nothing — the ordering is the whole difference."
        beforeNote="Stock was a whole block ahead of every order hit, so two accessories that merely mention the code outranked the product whose SKU it is."
        afterNote="The exact SKU leads, whichever space it came from. The two accessories tie on relevance, so the shelf keeps them — stock still wins every tie." />
      <div className="max-w-5xl">
        <div className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-slate-500">Settings → Price book</div>
        <SettingsCard />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

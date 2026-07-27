// Preview harness for the no-markup warning: the REAL board rows, the book
// header chip, and the markup editor, each in its warned and normal state —
// no Supabase.
// Dev-only entry (preview.html); not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { InHouseColumn, NoMarkupChip, StaleChip, VendorBookRow } from "./vendorpanel.jsx";
import { MarkupEditor } from "./pricebooklib.jsx";
import { bookNoMarkup } from "./orderbook.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const lbl = "ft-eyebrow text-[10px] mb-1 block";

const DAY = 86400000;
const group = { id: "g1", name: "Virginia Tile · C28895MM", host: "connect24.virginiatile.com", user: "C28895MM" };
const sheet = (filename, bookId) => ({ vendor: "dancik", host: group.host, uid: "1047", user: group.user, filename, bookId, lastFetched: Date.now() - 3 * DAY });

const BOOKS = [
  { id: "b1", kind: "order", name: "Virginia Tile — Core", active: true, data: { markups: { default: 45 }, lastImport: { at: Date.now() - 5 * DAY, skus: 4120 } } },
  { id: "b2", kind: "order", name: "Anatolia Tile", active: true, data: { lastImport: { at: Date.now() - 2 * DAY, skus: 880 } } },                       // never given a markup
  { id: "b3", kind: "order", name: "Mirage Hardwood", active: true, data: { markups: { default: 0, byGroup: { "Admiration": 0 } }, lastImport: { at: Date.now() - 200 * DAY, skus: 610 } } }, // zeroed AND stale
  { id: "b4", kind: "stock", name: "GLATI — stock export", active: true, data: { lastImport: { at: Date.now() - 9 * DAY, skus: 2200 } } },              // stock: never flagged
];

const ITEMS = [
  { sku: "A1", description: "12x24 porcelain", cost: 3.2, mfg: "CER", trim: false },
  { sku: "A2", description: "Bullnose", cost: 4.4, mfg: "CER", trim: true },
  { sku: "A3", description: "6x36 plank", cost: 2.8, mfg: "FLO", trim: false },
];

const noop = () => {};

function BoardColumn({ books }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-2.5 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <h3 className="text-[13px] font-semibold">{group.name}</h3>
        <div className="text-[11px] text-slate-400 mt-0.5">{books.length} sheets</div>
      </div>
      <div className="divide-y divide-slate-100">
        {books.map((b) => (
          <VendorBookRow key={b.id} sheet={sheet(`${b.name} EFT`, b.id)} book={b} group={group} groups={[group]} books={[b]}
            prog={null} locked={false} mismatch={false} running={false}
            stale={{ stale: (Date.now() - (b.data?.lastImport?.at || Date.now())) / DAY >= 120, days: 200 }}
            pending={null} checked={false}
            onToggle={noop} onRedownload={noop} onReview={noop} onRemove={noop} onMove={noop}
            onLinkBook={noop} onUnlinkBook={noop} onOpenBook={noop} />
        ))}
      </div>
    </div>
  );
}

function EditorCase({ book }) {
  const [markups, setMarkups] = useState(book.data?.markups || {});
  const live = { ...book, data: { ...book.data, markups } };
  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-lg font-medium">{book.name}</span>
        <span className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-slate-100 text-slate-500">Special order</span>
        {bookNoMarkup(live) && <NoMarkupChip />}
        <StaleChip days={200} />
      </div>
      <MarkupEditor book={live} items={ITEMS} onSave={setMarkups} inp={inp} lbl={lbl} />
    </div>
  );
}

function Harness() {
  return (
    <div className="min-h-screen p-8" style={{ background: "var(--ft-cream)", color: "var(--ft-text)" }}>
      <div className="max-w-5xl space-y-8">
        <div>
          <p className="ft-eyebrow text-[10px] mb-1">library board — a book with no markup turns red</p>
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))] items-start">
            <InHouseColumn books={BOOKS} groups={[]} bookStale={(b) => ({ stale: (Date.now() - (b.data?.lastImport?.at || Date.now())) / DAY >= 120, days: 200 })} onOpen={noop} />
            <BoardColumn books={BOOKS.slice(0, 3)} />
          </div>
        </div>
        <div>
          <p className="ft-eyebrow text-[10px] mb-1">book page — no markup anywhere in the config</p>
          <EditorCase book={BOOKS[1]} />
        </div>
        <div>
          <p className="ft-eyebrow text-[10px] mb-1">book page — a markup set (same editor, no warning)</p>
          <EditorCase book={BOOKS[0]} />
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);

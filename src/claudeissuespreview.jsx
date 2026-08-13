// Preview harness for the central Claude issues build (issue 087): the REAL
// TeamTodos (both tabs), LineMenu, and FlagForClaude over local mock state —
// no Supabase. Dev-only entry (claude-issues-preview.html); not part of the
// app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { TeamTodos } from "./TeamTodos.jsx";
import { LineMenu } from "./linemenu.jsx";
import { FlagForClaude } from "./claudeflag.jsx";
import { normClaudeIssue, jobSource, bookSource } from "./claudeissues.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent";
const DAY = 86400000;

const SEED = [
  { id: "1", text: "Shows $0.00/sf at the Employee tier — markup group missing?", createdBy: "Marcus", createdAt: Date.now() - 2 * DAY, source: { kind: "book", bookId: "hc", bookName: "Home Collection", sku: "HC0838MB", snapshot: { sku: "HC0838MB", description: "Hex Mosaic Midnight 8×38", cost: 4.2 } } },
  { id: "2", text: "Coverage says 15.5 SF/CT but the carton label at the shop says 17.6.", createdBy: "Dana", createdAt: Date.now() - 3 * DAY, source: { kind: "job", custId: "c1", custName: "Ramirez, Elena", areaName: "Kitchen", productId: "p9", sku: "MPB770VN1", snapshot: { brandColor: "Restoration Fawn", sizeText: "7×48", priceSqft: "4.29" } } },
  { id: "3", text: "Print preview cuts off the freight line on 2-page estimates.", createdBy: "Dana", createdAt: Date.now() - 4 * DAY, source: { kind: "general" } },
  { id: "4", text: "Duplicate of the VN-suffix SKU — search shows both.", done: true, doneAt: Date.now() - 8 * DAY, createdBy: "Marcus", createdAt: Date.now() - 9 * DAY, source: { kind: "book", bookName: "Mirage", sku: "MI-RH0455" } },
].map(normClaudeIssue);

const TODOS = [
  { id: "t1", position: 0, text: "Order more 1/8\" tile spacers for the shop", done: false, doneAt: null, createdBy: "Dana", createdAt: Date.now() - DAY },
  { id: "t2", position: 1, text: "Call Mirage rep about the fall intro colors", done: false, doneAt: null, createdBy: "Marcus", createdAt: Date.now() - 3 * DAY },
];

const MOCK_PROJECT = { id: "c1", name: "Klein, Whitney" };
const MOCK_AREA = { name: "Master Bath" };
const MOCK_ROW = { id: "p1", type: "tile", sku: "HC1224AS", brandColor: "Aniston Silver Polished", sizeText: "12×24", priceSqft: "4.79", qtyType: "sqft", qty: "138", cartonSf: "15.5", bookId: "hc" };
const MOCK_BOOK = { id: "hc", name: "Home Collection" };
const MOCK_ITEM = { sku: "HC0838MB", description: "Hex Mosaic Midnight 8×38", mfg: "HOME", cost: 4.2, unit: "CT", sfPerUnit: 11.9 };

function App() {
  const [issues, setIssues] = useState(SEED);
  const [tab, setTab] = useState("claude");
  const [menu, setMenu] = useState(null);
  const [flag, setFlag] = useState(null);
  const nid = () => String(Date.now() + Math.random());
  const claude = {
    issues,
    onAdd: (text, source) => setIssues((c) => [normClaudeIssue({ id: nid(), text, source: source || { kind: "general" }, createdBy: "You", createdAt: Date.now() }), ...c]),
    onToggle: (id) => setIssues((c) => c.map((t) => t.id === id ? { ...t, done: !t.done, doneAt: t.done ? null : Date.now() } : t)),
    onDelete: (id) => setIssues((c) => c.filter((t) => t.id !== id)),
    onClearDone: () => setIssues((c) => c.filter((t) => !t.done)),
  };
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex gap-2 mb-4">
        <button data-stage="menu" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY + 12 })} className="text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5">Open line menu</button>
        <button data-stage="flag-job" onClick={() => setFlag({ source: jobSource(MOCK_PROJECT, MOCK_AREA, MOCK_ROW) })} className="text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5">Flag popover — job line</button>
        <button data-stage="flag-book" onClick={() => setFlag({ source: bookSource(MOCK_BOOK, MOCK_ITEM) })} className="text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5">Flag popover — book row</button>
      </div>
      <div className="max-w-xl bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="ft-serif text-2xl mb-4">Issues &amp; To-Do</h3>
        <TeamTodos todos={TODOS} onAdd={() => { }} onToggle={() => { }} onDelete={() => { }} onReorder={() => { }} onClearDone={() => { }} inp={inp}
          tab={tab} onTab={setTab} claude={claude} />
      </div>
      <LineMenu menu={menu} title="12×24 Aniston Silver Polished" subtitle="Master Bath"
        areas={[{ id: "a2", name: "Kitchen" }, { id: "a3", name: "Mudroom" }]} canDelete
        onClose={() => setMenu(null)} onDuplicate={() => { }} onMoveTo={() => { }}
        onFlag={() => setFlag({ source: jobSource(MOCK_PROJECT, MOCK_AREA, MOCK_ROW) })} onDelete={() => { }} />
      <FlagForClaude ctx={flag} onClose={() => setFlag(null)} onAdd={(text, source) => { claude.onAdd(text, source); setTab("claude"); }} />
    </div>
  );
}

createRoot(document.getElementById("preview")).render(<App />);

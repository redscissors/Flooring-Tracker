import { useMemo, useRef, useState } from "react";
import { X, Search, Plus, Trash2, Printer, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { LABEL_FIELDS, VARIANT_KEYS, newDraftFromPreset, normPreset, stockToLabelFields, perLetterSheet, sheetsForLabels, labelCardHTML, clampSize, isKeimHeader } from "./labels.js";
import { searchStock } from "./stock.js";
import SheogaConfigurator from "./SheogaConfigurator.jsx";
import keimLogo from "./assets/keim-logo-ink.png";

const uid = () => "l" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const surfaceColor = (s) => (s === "Wall" ? "#B5654A" : s === "Floor & Wall" ? "#7d6a8a" : "#5C6B73");
const LABEL_OF = Object.fromEntries(LABEL_FIELDS.map((f) => [f.key, f.label]));
const inp = "w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400";

// ── The dark label card, data-driven over `lines` (screen render) ──────────────
function LabelCard({ label, scale = 1 }) {
  const px = 96; // 1in ≈ 96 CSS px on screen
  const variantLines = label.twoVariant ? label.lines.filter((l) => l.show && VARIANT_KEYS.includes(l.key)) : [];
  const firstVariant = variantLines[0]?.key;
  const variantCol = (fields) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      {variantLines.map((l) => (
        <div key={l.key} style={{ marginTop: 6 }}>
          <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".08em", color: "#9a9a9a", fontWeight: 700, lineHeight: 1 }}>{LABEL_OF[l.key]}</div>
          <div style={{ lineHeight: 1.3, fontSize: l.size, fontFamily: l.key === "sku" ? "ui-monospace,monospace" : "inherit", wordBreak: "break-word" }}>{fields?.[l.key] || "—"}</div>
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ width: label.w * px * scale, height: label.h * px * scale }}>
      <div style={{ width: `${label.w}in`, height: `${label.h}in`, transform: `scale(${scale})`, transformOrigin: "top left", background: "#1A1A1A", color: "#fff", borderRadius: 3, padding: "0.12in", fontFamily: "'Inter',sans-serif", display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden" }}>
        {isKeimHeader(label.header)
          ? <img src={keimLogo} alt="Keim" style={{ height: 14, width: "auto", alignSelf: "flex-start", filter: "brightness(0) invert(1)" }} />
          : <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3em" }}>{label.header}</div>}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.2)", margin: "6px 0 2px" }} />
        {label.lines.filter((l) => l.show).map((l) => {
          const v = label.fields?.[l.key] || "";
          if (l.key === "name") return <div key={l.key} style={{ fontFamily: "'Oswald',sans-serif", fontSize: l.size, textTransform: "uppercase", letterSpacing: ".03em", lineHeight: 1.12, wordBreak: "break-word" }}>{v || "Tile Name"}</div>;
          if (l.key === "surface") return <span key={l.key} style={{ alignSelf: "flex-start", marginTop: 6, fontSize: 8, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: surfaceColor(v) }}>{v}</span>;
          if (label.twoVariant && VARIANT_KEYS.includes(l.key)) {
            if (l.key !== firstVariant) return null;
            return (
              <div key="variants" style={{ display: "flex", gap: 8 }}>
                {variantCol(label.fields)}
                <div style={{ width: 1, background: "rgba(255,255,255,.18)", marginTop: 6 }} />
                {variantCol(label.fields2)}
              </div>
            );
          }
          return (
            <div key={l.key} style={{ marginTop: 6 }}>
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".08em", color: "#9a9a9a", fontWeight: 700, lineHeight: 1 }}>{LABEL_OF[l.key]}</div>
              <div style={{ lineHeight: 1.3, fontSize: l.size, fontFamily: l.key === "sku" ? "ui-monospace,monospace" : "inherit" }}>{v || "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SKU lookup: single-pick fills the form, shift-click bulk-adds ──────────────
function SkuLookup({ stock, onPick, onBulk, placeholder = "Search SKU or name to fill…", hint = "Pick to fill · Shift-click to add as its own label" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => (open ? searchStock(stock, q).slice(0, 30) : []), [open, q, stock]);
  const choose = (it, shift) => {
    if (shift) { onBulk(it); }
    else { onPick(it); setQ(""); setOpen(false); }
  };
  return (
    <div className="relative mb-1">
      <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={inp + " pl-8"} placeholder={placeholder} />
      {open && results.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map((it) => (
            <button key={it.sku} onMouseDown={(e) => { e.preventDefault(); choose(it, e.shiftKey); }} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
              <div className="flex items-baseline gap-2">
                <span className="ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
                <span className="text-xs font-medium truncate flex-1">{it.description || it.product}</span>
                <span className="ft-mono text-[11px] text-slate-400 shrink-0">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>
              </div>
            </button>
          ))}
          <div className="px-2.5 py-1.5 text-[11px] text-slate-400 bg-slate-50/60 border-t border-slate-100">{hint}</div>
        </div>
      )}
    </div>
  );
}

export function AppsWorkspace({ onClose, stock, labels, presets, onAddLabel, onAddLabelsBulk, onUpdateLabel, onDeleteLabel, onSavePreset, sheoga }) {
  const [app, setApp] = useState("labels");
  // Sheoga (Apps hub): the basket stages locally — nothing touches a real
  // project until the salesperson picks a destination. A commit request parks
  // its lines in `pending` and raises the destination prompt when an order is
  // open (accidental wrong-order guard); with nothing open there's no ambiguity,
  // so it goes straight to a new quick price. pendingRef lets onClose ignore the
  // popup's own auto-close (SheogaConfigurator closes itself after a bundle
  // move) so a pending choice never unmounts the configurator and loses the build.
  const [sheogaBasket, setSheogaBasket] = useState([]);
  const [pending, setPendingState] = useState(null);
  const pendingRef = useRef(null);
  const setPending = (v) => { pendingRef.current = v; setPendingState(v); };
  const requestCommit = (lines, nextBasket) => {
    if (!lines || !lines.length) return;
    if (sheoga?.currentName) setPending({ lines, nextBasket });
    else commitTo("new", lines, nextBasket);
  };
  const commitTo = (where, lines, nextBasket) => {
    if (where === "current") sheoga.addToCurrent(lines); else sheoga.addToNew(lines);
    setSheogaBasket(nextBasket || []);
    setPending(null);
  };
  const first = presets[0] || normPreset({ id: "sample-tag" });
  const [draft, setDraft] = useState(() => newDraftFromPreset(first));
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [listSearch, setListSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  // ── draft editing ──
  const patchDraft = (p) => setDraft((d) => ({ ...d, ...p }));
  const setField = (k, v) => setDraft((d) => ({ ...d, fields: { ...d.fields, [k]: v } }));
  const setField2 = (k, v) => setDraft((d) => ({ ...d, fields2: { ...d.fields2, [k]: v } }));
  // Turning two-variant on widens a still-narrow label so both columns fit
  // (v3 went 1.5 -> 2in); turning it off leaves the width alone.
  const setTwoVariant = (on) => setDraft((d) => ({ ...d, twoVariant: on, w: on ? Math.max(d.w, 2) : d.w }));
  const setLine = (key, p) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => l.key === key ? { ...l, ...p } : l) }));
  const bumpSize = (key, dir) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => l.key === key ? { ...l, size: clampSize(l.size + dir) } : l) }));
  const moveLine = (idx, dir) => setDraft((d) => {
    const lines = [...d.lines]; const j = idx + dir;
    if (j < 0 || j >= lines.length) return d;
    [lines[idx], lines[j]] = [lines[j], lines[idx]];
    return { ...d, lines };
  });

  const applyPreset = (p) => { setDraft(newDraftFromPreset(p)); setEditingId(null); };
  const fillFrom = (item) => setDraft((d) => ({ ...d, sku: item.sku || null, fields: { ...d.fields, ...stockToLabelFields(item) } }));
  const bulkFrom = (item) => onAddLabelsBulk([{ ...draft, sku: item.sku || null, fields: { ...draft.fields, ...stockToLabelFields(item) } }]);
  const fillFrom2 = (item) => setDraft((d) => {
    const f = stockToLabelFields(item);
    return { ...d, fields2: Object.fromEntries(VARIANT_KEYS.map((k) => [k, f[k] || ""])) };
  });

  const save = () => {
    if (!draft.fields.name.trim() && !draft.sku) return;
    if (editingId) onUpdateLabel(editingId, draft); else onAddLabel(draft);
    setDraft(newDraftFromPreset(presets.find((p) => p.id === draft.presetId) || first));
    setEditingId(null);
  };
  const startNew = () => { setDraft(newDraftFromPreset(presets.find((p) => p.id === draft.presetId) || first)); setEditingId(null); };
  const editLabel = (l) => { setDraft({ presetId: l.presetId, w: l.w, h: l.h, header: l.header, lines: l.lines.map((x) => ({ ...x })), fields: { ...l.fields }, twoVariant: !!l.twoVariant, fields2: { ...l.fields2 }, sku: l.sku }); setEditingId(l.id); };
  const saveAsPreset = () => {
    const name = window.prompt("Name this size preset:", "");
    if (!name) return;
    onSavePreset(normPreset({ id: uid(), name, w: draft.w, h: draft.h, header: draft.header, lines: draft.lines }));
  };

  // ── set: filter + sort ──
  const view = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    let out = labels.filter((l) => sizeFilter === "all" || l.presetId === sizeFilter);
    if (q) out = out.filter((l) => [l.fields.name, l.fields.sku, l.fields.grout, l.twoVariant ? l.fields2?.sku : ""].join(" ").toLowerCase().includes(q));
    out = [...out].sort(sortBy === "az"
      ? (a, b) => (a.fields.name || "").localeCompare(b.fields.name || "")
      : (a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  }, [labels, listSearch, sizeFilter, sortBy]);

  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectedLabels = labels.filter((l) => selected.has(l.id));

  const print = (list) => {
    if (!list.length) return;
    const w = window.open("", "_blank");
    if (!w) return;
    // Absolute URL: the popup is about:blank, so the Vite asset path won't resolve relatively.
    const logoSrc = new URL(keimLogo, window.location.href).href;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Labels</title>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>@page{margin:0.3in;size:letter}body{margin:0;display:flex;flex-wrap:wrap;gap:0.15in}body>div{break-inside:avoid}</style></head>
      <body>${list.map((l) => labelCardHTML(l, { logoSrc })).join("")}</body></html>`);
    w.document.close();
    const imgs = Array.from(w.document.images).filter((im) => !im.complete);
    Promise.all(imgs.map((im) => new Promise((res) => { im.onload = im.onerror = res; })))
      .then(() => setTimeout(() => { w.focus(); w.print(); }, 400));
  };

  const previewLabel = { ...draft, id: "preview" };

  return (
    <div className="print:hidden fixed inset-0 z-50 p-2 md:p-5" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* nav rail */}
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <h3 className="ft-serif text-2xl">Apps</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <nav className="px-2 space-y-0.5">
            <button onClick={() => setApp("labels")} className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left ${app === "labels" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Label Generator</button>
            {sheoga && <button onClick={() => setApp("sheoga")} className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left ${app === "sheoga" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Sheoga configurator</button>}
            <div className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-400">More coming soon</div>
          </nav>
          <div className="mt-auto p-4 text-[11px] text-slate-400 border-t border-slate-100">A home for shop tools.</div>
        </aside>

        {/* main */}
        <div className="flex-1 flex flex-col min-w-0">
          {app === "labels" && (<>
          {/* preset strip */}
          <div className="flex items-end gap-3 px-5 py-3 border-b border-slate-100 overflow-x-auto">
            {presets.map((p) => {
              const active = draft.presetId === p.id;
              return (
                <button key={p.id} onClick={() => applyPreset(p)} className={`shrink-0 flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2 ${active ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200 hover:border-slate-300"}`}>
                  <div style={{ width: p.w * 24, height: p.h * 24, background: "#1A1A1A", borderRadius: 2 }} />
                  <div className="text-xs font-semibold">{p.name}</div>
                  <div className="text-[10px] text-slate-400">{p.w} × {p.h}″ · ≈{perLetterSheet(p)}/sheet</div>
                </button>
              );
            })}
            <button onClick={saveAsPreset} className="shrink-0 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-slate-500 hover:border-slate-400">
              <Plus size={20} className="text-indigo-500" /><span className="text-xs font-semibold">Save size</span>
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-[380px_1fr] min-h-0">
            {/* form */}
            <div className="border-r border-slate-100 p-5 overflow-y-auto">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Size &amp; header</div>
              <div className="flex items-end gap-2 mb-3">
                <label className="flex-1">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">Width (in)</div>
                  <input type="number" step="0.25" min="0.25" value={draft.w} onChange={(e) => patchDraft({ w: Math.max(0.25, parseFloat(e.target.value) || 0.25) })} className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm" />
                </label>
                <label className="flex-1">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">Height (in)</div>
                  <input type="number" step="0.25" min="0.25" value={draft.h} onChange={(e) => patchDraft({ h: Math.max(0.25, parseFloat(e.target.value) || 0.25) })} className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm" />
                </label>
                <div className="text-[10px] text-slate-400 pb-1.5 whitespace-nowrap">≈{perLetterSheet(draft)}/sheet</div>
              </div>
              <label className="block mb-4">
                <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">Header</div>
                <input value={draft.header} onChange={(e) => patchDraft({ header: e.target.value })} className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm" placeholder="Keim" />
                <div className="text-[10px] text-slate-400 mt-0.5">“Keim” (or blank) shows the Keim logo; anything else prints as text.</div>
              </label>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Fill from stock book</div>
              <SkuLookup stock={stock} onPick={fillFrom} onBulk={bulkFrom} />

              <label className="flex items-center gap-2 mt-3 text-xs text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={!!draft.twoVariant} onChange={(e) => setTwoVariant(e.target.checked)} className="accent-indigo-600" />
                <span className="font-semibold">Second SKU / size / price</span>
                <span className="text-slate-400">— two sizes on one label</span>
              </label>
              {draft.twoVariant && (
                <div className="mt-2 pl-3 border-l-2 border-slate-100">
                  <SkuLookup stock={stock} onPick={fillFrom2} onBulk={fillFrom2} placeholder="Search stock book to fill the 2nd column…" hint="Pick to fill the 2nd column" />
                  <div className="text-[10px] text-slate-400 mt-0.5 mb-1">SKU, Size, and Price get a “2nd” box below; both columns print side by side.</div>
                </div>
              )}

              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mt-5 mb-1">Label lines</div>
              <div className="text-[11px] text-slate-400 mb-2">Toggle, reorder, resize — then Save Label.</div>
              {draft.lines.map((l, idx) => {
                const meta = LABEL_FIELDS.find((f) => f.key === l.key);
                return (
                  <div key={l.key} className={`flex items-center gap-2 py-1.5 border-b border-slate-50 ${l.show ? "" : "opacity-50"}`}>
                    <div className="flex flex-col">
                      <button onClick={() => moveLine(idx, -1)} className="text-slate-300 hover:text-slate-600 leading-none"><ChevronUp size={13} /></button>
                      <button onClick={() => moveLine(idx, 1)} className="text-slate-300 hover:text-slate-600 leading-none"><ChevronDown size={13} /></button>
                    </div>
                    <button onClick={() => setLine(l.key, { show: !l.show })} className="w-7 h-7 shrink-0 flex items-center justify-center border border-slate-200 rounded-md text-indigo-600">
                      {l.show ? <Eye size={14} /> : <EyeOff size={14} className="text-slate-300" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{meta.label}</div>
                      {meta.kind === "surface" ? (
                        <div className="flex gap-1.5 mt-0.5">
                          {["Floor", "Wall", "Floor & Wall"].map((s) => (
                            <button key={s} onClick={() => setField("surface", s)} className={`flex-1 text-xs font-semibold py-1 rounded-md border ${draft.fields.surface === s ? "bg-slate-800 text-white border-slate-800" : "border-slate-200"}`}>{s}</button>
                          ))}
                        </div>
                      ) : (
                        <>
                          <input value={draft.fields[l.key]} onChange={(e) => setField(l.key, e.target.value)} className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm mt-0.5" />
                          {draft.twoVariant && VARIANT_KEYS.includes(l.key) && (
                            <input value={draft.fields2[l.key]} onChange={(e) => setField2(l.key, e.target.value)} placeholder="2nd" className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm mt-1" />
                          )}
                        </>
                      )}
                    </div>
                    {meta.kind !== "surface" && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => bumpSize(l.key, -1)} className="w-5 h-5 border border-slate-200 rounded text-slate-500 text-xs leading-none">−</button>
                        <span className="text-[10px] text-slate-400 w-4 text-center">{l.size}</span>
                        <button onClick={() => bumpSize(l.key, 1)} className="w-5 h-5 border border-slate-200 rounded text-slate-500 text-xs leading-none">+</button>
                      </div>
                    )}
                  </div>
                );
              })}

              <button onClick={saveAsPreset} className="mt-3 text-xs text-indigo-600 font-semibold underline">＋ Save these lines &amp; size as a preset</button>

              <div className="flex gap-2 mt-4">
                <button onClick={save} className="flex-1 bg-indigo-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-indigo-700">{editingId ? "Save Changes" : "Save Label"}</button>
                <button onClick={startNew} className="border border-slate-200 rounded-md px-4 text-sm font-semibold hover:bg-slate-50">New</button>
              </div>
            </div>

            {/* preview + set */}
            <div className="p-5 overflow-y-auto bg-slate-50/40">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Live preview</div>
                <div className="flex gap-2">
                  {selected.size > 0 && <button onClick={() => print(selectedLabels)} className="text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-200 bg-white flex items-center gap-1.5"><Printer size={13} /> Print Selected ({selected.size}) · {sheetsForLabels(selectedLabels)} sheet{sheetsForLabels(selectedLabels) === 1 ? "" : "s"}</button>}
                  {labels.length > 0 && <button onClick={() => print(view)} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-800 text-white flex items-center gap-1.5"><Printer size={13} /> Print All ({view.length}) · {sheetsForLabels(view)} sheet{sheetsForLabels(view) === 1 ? "" : "s"}</button>}
                </div>
              </div>

              <div className="mb-5"><LabelCard label={previewLabel} scale={Math.min(1, 210 / (draft.w * 96))} /></div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="text-[13px] font-bold">Label Set ({labels.length})</div>
                <div className="relative flex-1 min-w-[140px]">
                  <Search size={13} className="absolute left-2 top-2 text-slate-400" />
                  <input value={listSearch} onChange={(e) => setListSearch(e.target.value)} placeholder="Search name / SKU / grout" className="w-full border border-slate-200 rounded-md pl-7 pr-2 py-1 text-xs" />
                </div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-slate-200 rounded-md px-2 py-1 text-xs">
                  <option value="recent">Recent</option><option value="az">A–Z</option>
                </select>
              </div>
              <div className="flex gap-1.5 mb-3 flex-wrap">
                <button onClick={() => setSizeFilter("all")} className={`text-xs px-2.5 py-1 rounded-full border ${sizeFilter === "all" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200"}`}>All</button>
                {presets.map((p) => <button key={p.id} onClick={() => setSizeFilter(p.id)} className={`text-xs px-2.5 py-1 rounded-full border ${sizeFilter === p.id ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200"}`}>{p.name}</button>)}
              </div>

              {view.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-md p-8 text-center text-sm text-slate-400">{labels.length === 0 ? "No labels yet. Fill out the form and Save Label." : "No labels match."}</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {view.map((l) => (
                    <div key={l.id} className="relative group">
                      <button onClick={(e) => e.shiftKey ? toggleSel(l.id) : editLabel(l)} className={`block rounded ${selected.has(l.id) ? "ring-2 ring-offset-2 ring-indigo-500" : editingId === l.id ? "ring-2 ring-offset-2 ring-amber-500" : ""}`} title="Click to edit · Shift-click to select for printing">
                        <LabelCard label={l} scale={Math.min(0.6, 120 / (l.w * 96))} />
                      </button>
                      {selected.has(l.id) && <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">✓</div>}
                      <button onClick={() => { if (editingId === l.id) startNew(); onDeleteLabel(l.id); }} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-slate-200 text-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center" title="Delete"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          </>)}
          {app === "sheoga" && sheoga && (
            <SheogaConfigurator
              embedded
              markupDefault={sheoga.markupDefault}
              ventMarkupDefault={sheoga.ventMarkupDefault}
              basket={sheogaBasket}
              onBasketChange={setSheogaBasket}
              areaName={sheoga.currentName || "a new quick price"}
              onAdd={(lines) => requestCommit(lines, null)}
              onMove={(lines) => requestCommit(lines, null)}
              onMoveEntries={(lines, nextBasket) => requestCommit(lines, nextBasket)}
              onClose={() => { if (!pendingRef.current) setApp("labels"); }}
            />
          )}
        </div>
      </div>
      {pending && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(20,15,10,.5)" }} onClick={(e) => { e.stopPropagation(); setPending(null); }}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="ft-serif text-xl mb-1">Add to which project?</h3>
            <p className="text-sm text-slate-500 mb-4">{pending.lines.length} product line{pending.lines.length > 1 ? "s" : ""} ready to place.</p>
            <div className="space-y-2">
              <button onClick={() => commitTo("current", pending.lines, pending.nextBasket)} className="w-full text-left rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 px-3.5 py-2.5">
                <div className="text-sm font-semibold text-slate-800">Current project</div>
                <div className="text-xs text-slate-500 truncate">{sheoga.currentName}</div>
              </button>
              <button onClick={() => commitTo("new", pending.lines, pending.nextBasket)} className="w-full text-left rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 px-3.5 py-2.5">
                <div className="text-sm font-semibold text-slate-800">New quick price</div>
                <div className="text-xs text-slate-500">Start a fresh unnamed order</div>
              </button>
            </div>
            <button onClick={() => setPending(null)} className="mt-4 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

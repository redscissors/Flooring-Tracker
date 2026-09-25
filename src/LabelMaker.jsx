import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, Trash2, Printer, Eye, EyeOff, GripVertical, ChevronDown, RefreshCw, X } from "lucide-react";
import {
  LABEL_FIELDS, KIND_OF, VARIANT_KEYS, newDraftFromPreset, normPreset, stockToLabelFields, perLetterSheet, sheetsForLabels,
  labelCardHTML, clampSize, isKeimHeader, isSpacer, clampSpace, newSpacerLine, isPin, PIN_KEY, splitPinned, fitNameSize,
  faceArea, twoSizeDraft, restyleLabel, refreshPlan, builtinDefault, isBuiltinOverridden, BUILTIN_IDS,
} from "./labels.js";
import { searchStock } from "./stock.js";
import { skuKeys } from "./orderbook.js";
import { HelpTip, FitSelect, SearchPop, useAnchoredPanel, PopMenu } from "./widgets.jsx";
import keimLogo from "./assets/keim-logo-ink.png";

const uid = () => "l" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const surfaceColor = (s) => (s === "Wall" ? "#B5654A" : s === "Floor & Wall" ? "#7d6a8a" : "#5C6B73");
const LABEL_OF = Object.fromEntries(LABEL_FIELDS.map((f) => [f.key, f.label]));
const RUST = "#B5654A";
const AMBER = "#C8912E";
const inp = "w-full min-w-0 border border-slate-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400";
const eyebrow = "text-[10.5px] uppercase tracking-wider text-slate-400 font-bold";
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const priceNum = (s) => { const m = String(s || "").match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
// The set column's controls stop at a letter sheet's width (the page the
// labels print on) so a wide screen doesn't strand the search at the far edge;
// the cards themselves still use the full column.
const SHEET_W = "8.5in";
const SHORT = { name: "Name", grout: "Grout", custom1: "Line 1", custom2: "Line 2", custom3: "Line 3" };
const overflows = (card) => card.scrollHeight > card.clientHeight + 1;

// ── The dark label card (screen render) ────────────────────────────────────────
// Lines after the pin divider ride a bottom group; the name then shrinks until
// the card stops overflowing (fitNameSize — the print popup runs the same rule).
// `boxes` outlines every rendered line on screen only, never in print.
function LabelCard({ label, scale = 1, boxes = false, onFit }) {
  const px = 96;
  const cardRef = useRef(null);
  const nameRef = useRef(null);
  const start = label.lines.find((l) => l.key === "name" && l.show)?.size || 0;
  const [fit, setFit] = useState(start);
  const fitKey = JSON.stringify([label.w, label.h, label.header, label.lines, label.fields, label.fields2, label.twoVariant]);
  useLayoutEffect(() => {
    let live = true;
    const run = () => {
      const card = cardRef.current, nm = nameRef.current;
      if (!live) return;
      if (!card || !nm) { onFit?.(null); return; }
      const size = fitNameSize((v) => { nm.style.fontSize = v + "px"; return overflows(card); }, start);
      setFit(size);
      onFit?.({ from: start, to: size, stuck: overflows(card) });
    };
    run();
    document.fonts?.ready.then(run);
    return () => { live = false; };
  }, [fitKey, start]);

  const bx = boxes ? { outline: "1px dashed rgba(255,255,255,.35)", outlineOffset: -1 } : null;
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
  const render = (l) => {
    const v = label.fields?.[l.key] || "";
    if (isSpacer(l.key)) return <div key={l.key} style={{ height: l.size, flex: "0 0 auto", ...bx }} />;
    if (l.key === "name") return <div key={l.key} ref={nameRef} style={{ fontFamily: "'Oswald',sans-serif", fontSize: fit, textTransform: "uppercase", letterSpacing: ".03em", lineHeight: 1.12, wordBreak: "break-word", ...bx }}>{v || "Tile Name"}</div>;
    if (l.key === "surface") return v ? <span key={l.key} style={{ alignSelf: "flex-start", marginTop: 6, fontSize: 8, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: surfaceColor(v), ...bx }}>{v}</span> : null;
    if (KIND_OF[l.key] === "custom") return v ? <div key={l.key} style={{ marginTop: 6, lineHeight: 1.3, fontSize: l.size, wordBreak: "break-word", ...bx }}>{v}</div> : null;
    if (label.twoVariant && VARIANT_KEYS.includes(l.key)) {
      if (l.key !== firstVariant) return null;
      return (
        <div key="variants" style={{ display: "flex", gap: 8, ...bx }}>
          {variantCol(label.fields)}
          <div style={{ width: 1, background: "rgba(255,255,255,.18)", marginTop: 6 }} />
          {variantCol(label.fields2)}
        </div>
      );
    }
    return (
      <div key={l.key} style={{ marginTop: 6, ...bx }}>
        <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".08em", color: "#9a9a9a", fontWeight: 700, lineHeight: 1 }}>{LABEL_OF[l.key]}</div>
        <div style={{ lineHeight: 1.3, fontSize: l.size, fontFamily: l.key === "sku" ? "ui-monospace,monospace" : "inherit" }}>{v || "—"}</div>
      </div>
    );
  };
  const { body, bottom } = splitPinned(label.lines);
  return (
    <div style={{ width: label.w * px * scale, height: label.h * px * scale }}>
      <div ref={cardRef} style={{ width: `${label.w}in`, height: `${label.h}in`, transform: `scale(${scale})`, transformOrigin: "top left", background: "#1A1A1A", color: "#fff", borderRadius: 3, padding: "0.12in", fontFamily: "'Inter',sans-serif", display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden", textAlign: "left" }}>
        {isKeimHeader(label.header)
          ? <img src={keimLogo} alt="Keim" style={{ height: 14, width: "auto", alignSelf: "flex-start", filter: "brightness(0) invert(1)" }} />
          : <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3em" }}>{label.header}</div>}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.2)", margin: "6px 0 2px" }} />
        {body.map(render)}
        {bottom.length > 0 && (
          <div style={{ marginTop: "auto", flexShrink: 0, display: "flex", flexDirection: "column", ...(boxes ? { outline: "1px dashed rgba(143,176,108,.8)", outlineOffset: 1 } : null) }}>
            {bottom.map(render)}
          </div>
        )}
      </div>
    </div>
  );
}

// Quiet − n + font-size nudge: plain signs, no boxes (owner 2026-09-25).
function Nudge({ value, onStep, title = "Font size" }) {
  const sign = "w-3.5 text-center text-slate-400 hover:text-slate-800 leading-none text-[15px]";
  return (
    <div className="flex items-center justify-end select-none" title={title}>
      <button type="button" onClick={() => onStep(-1)} className={sign} aria-label="Smaller">−</button>
      <span className="min-w-[18px] text-center text-xs text-slate-500 tabular-nums">{value}</span>
      <button type="button" onClick={() => onStep(1)} className={sign} aria-label="Bigger">+</button>
    </div>
  );
}

const PinDivider = ({ children = "Bottom of label", className = "" }) => (
  <div className={"flex items-center gap-2 text-[9.5px] font-extrabold uppercase tracking-wider " + className} style={{ color: "var(--ft-brand-deep)" }}>
    <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: "color-mix(in oklab, var(--ft-brand) 45%, transparent)" }} />
    {children}
    <span className="flex-1 border-t-2 border-dashed" style={{ borderColor: "color-mix(in oklab, var(--ft-brand) 45%, transparent)" }} />
  </div>
);

// ── Stock-book lookup: click a name to fill; tick several to make one two-size
// label (bigger first) or a label each ───────────────────────────────────────────
function SkuLookup({ stock, onPick, onTwo, onAddMany, single = false, placeholder = "Search stock book to fill…" }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const close = () => { setOpen(false); setPicked([]); };
  const pos = useAnchoredPanel(open, wrapRef, panelRef, close);
  const results = useMemo(() => (open ? searchStock(stock, q).slice(0, 30) : []), [open, q, stock]);
  const toggle = (it) => setPicked((p) => (p.some((x) => x.sku === it.sku) ? p.filter((x) => x.sku !== it.sku) : [...p, it]));
  const done = () => { setQ(""); close(); };
  const two = picked.length === 2 ? twoSizeDraft(picked[0], picked[1]) : null;
  const order = two ? (two.swapped ? [picked[1], picked[0]] : picked) : [];
  const sizes = order.map((it) => stockToLabelFields(it).size);
  const readable = two && faceArea(sizes[0]) != null && faceArea(sizes[1]) != null && faceArea(sizes[0]) !== faceArea(sizes[1]);
  const badge = (it) => (two ? ["1st", "2nd"][order.findIndex((x) => x.sku === it.sku)] : null);
  return (
    <div ref={wrapRef} className="relative">
      <Search size={15} className="absolute left-2.5 top-2 text-slate-400" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        className={inp + " pl-8 ft-search"} placeholder={placeholder} />
      {open && pos && (results.length > 0 || picked.length > 0) && (
        <SearchPop pos={pos} fieldRef={wrapRef} panelRef={panelRef} className="flex flex-col" style={{ maxHeight: Math.min(340, pos.maxH) }}>
          <div className="overflow-y-auto min-h-0" onMouseDown={(e) => e.preventDefault()}>
            {results.map((it) => {
              const on = picked.some((x) => x.sku === it.sku);
              return (
                <div key={it.sku} className={`flex items-center gap-2 px-2.5 py-1.5 border-b border-slate-100 last:border-0 ${on ? "bg-[var(--ft-tint)]" : "hover:bg-slate-50"}`}>
                  {!single && <input type="checkbox" checked={on} onChange={() => toggle(it)} className="shrink-0 w-3.5 h-3.5" style={{ accentColor: "var(--ft-brand)" }} aria-label={`Pick ${it.sku}`} />}
                  <button onClick={(e) => { if (!single && e.shiftKey) { toggle(it); return; } onPick(it); done(); }} className="flex-1 min-w-0 flex items-baseline gap-2 text-left">
                    <span className="ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
                    <span className="text-xs font-medium truncate flex-1">{it.description || it.product}</span>
                    {badge(it)
                      ? <span className="shrink-0 text-[10px] font-extrabold text-white rounded-full px-1.5" style={{ background: "var(--ft-brand)" }}>{badge(it)}</span>
                      : <span className="ft-mono text-[11px] text-slate-400 shrink-0">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>}
                  </button>
                </div>
              );
            })}
          </div>
          {!single && picked.length > 0 && (
            <div className="shrink-0 border-t border-slate-200 px-2.5 py-2 flex items-center gap-2 flex-wrap text-xs" style={{ background: "var(--ft-sand)" }} onMouseDown={(e) => e.preventDefault()}>
              <b>{picked.length} picked</b>
              {two && <button onClick={() => { onTwo(picked[0], picked[1]); done(); }} className="font-semibold rounded-md px-2.5 py-1 bg-slate-800 text-white">One label, 2 sizes</button>}
              <button onClick={() => { onAddMany(picked); done(); }} className="font-semibold rounded-md px-2.5 py-1 border border-slate-300 bg-white">Add {plural(picked.length, "label")}</button>
              <button onClick={() => setPicked([])} className="ml-auto text-slate-500 underline">Clear</button>
              {two && <div className="basis-full text-[11px] text-slate-500">{readable ? `Bigger first: ${sizes[0]}, then ${sizes[1]}` : "Same size or no size to compare, so they keep the order you picked them"}</div>}
            </div>
          )}
        </SearchPop>
      )}
    </div>
  );
}

// ── Template chip + menu: pick a template, edit it, or start a new one ─────────
function TemplateMenu({ presets, current, editing, onPick, onEdit, onNew, onCloseEdit }) {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const swatch = (p, k = 22) => <span className="shrink-0 rounded-sm" style={{ background: "#1A1A1A", height: k, width: Math.max(8, Math.min(k * 1.4, (k * p.w) / p.h)) }} />;
  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 bg-white" style={{ borderColor: "var(--ft-tint-border)" }}>
        {swatch(current, 20)}
        <div className="flex-1 min-w-0 text-sm font-bold truncate">Editing “{editing.isNew ? "New template" : current.name}”</div>
        <button onClick={onCloseEdit} className="text-slate-400 hover:text-slate-800" title="Close without saving"><X size={15} /></button>
      </div>
    );
  }
  return (
    <>
      <button ref={btnRef} onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left hover:border-slate-300">
        {swatch(current)}
        <span className="flex-1 min-w-0 leading-tight">
          <span className="block text-sm font-bold truncate">{current.name}</span>
          <span className="block text-[11px] text-slate-400">{current.w} × {current.h}″ · ≈{perLetterSheet(current)}/sheet</span>
        </span>
        <ChevronDown size={15} className="text-slate-400" />
      </button>
      {open && btnRef.current && (
        <PopMenu at={{ anchor: btnRef.current }} width={280} onClose={() => setOpen(false)} className="p-1">
          <div className={eyebrow + " px-2 pt-1.5 pb-1"}>Templates</div>
          {presets.map((p) => (
            <button key={p.id} onClick={() => { setOpen(false); onPick(p); }} className={`w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[var(--ft-tint)] ${p.id === current.id ? "bg-[var(--ft-tint)]" : ""}`}>
              <span className="w-3.5 text-xs font-extrabold" style={{ color: "var(--ft-brand)" }}>{p.id === current.id ? "✓" : ""}</span>
              {swatch(p, 20)}
              <span className="flex-1 min-w-0 leading-tight">
                <span className="block text-sm truncate">{p.name}</span>
                <span className="block text-[11px] text-slate-400">{p.w} × {p.h}″ · ≈{perLetterSheet(p)}/sheet</span>
              </span>
            </button>
          ))}
          <div className="border-t border-slate-100 my-1" />
          <button onClick={() => { setOpen(false); onEdit(); }} className="w-full text-left rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-[var(--ft-tint)]"><span className="inline-block w-3.5 mr-2.5" />⚙ Edit “{current.name}”…</button>
          <button onClick={() => { setOpen(false); onNew(); }} className="w-full text-left rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-[var(--ft-tint)]"><span className="inline-block w-3.5 mr-2.5" />＋ New template…</button>
        </PopMenu>
      )}
    </>
  );
}

export function LabelMaker({ stock, bookStockReady = false, labels, presets, onAddLabel, onAddLabelsBulk, onUpdateLabel, onUpdateLabelsBulk, onDeleteLabel, onDeleteLabels, onSavePreset }) {
  const first = presets[0] || normPreset({ id: "sample-tag" });
  const [draft, setDraft] = useState(() => newDraftFromPreset(first));
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [listSearch, setListSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [showBoxes, setShowBoxes] = useState(false);
  const [fitInfo, setFitInfo] = useState(null);
  const [tplEdit, setTplEdit] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [review, setReview] = useState(null);
  const [doneBar, setDoneBar] = useState(null);
  const current = presets.find((p) => p.id === draft.presetId) || first;

  // ── draft editing ──
  const patchDraft = (p) => setDraft((d) => ({ ...d, ...p }));
  const setField = (k, v) => setDraft((d) => ({ ...d, fields: { ...d.fields, [k]: v } }));
  const setField2 = (k, v) => setDraft((d) => ({ ...d, fields2: { ...d.fields2, [k]: v } }));
  // Turning two-variant on widens a still-narrow label so both columns fit
  // (v3 went 1.5 -> 2in); turning it off restores the width it widened from.
  // `wBefore` is draft-only UI state — normLabel never persists it.
  const widen = (d, on) => (on
    ? { twoVariant: true, wBefore: d.twoVariant ? d.wBefore : d.w, w: Math.max(d.w, 2) }
    : { twoVariant: false, w: d.wBefore ?? d.w, wBefore: undefined });
  const setTwoVariant = (on) => setDraft((d) => ({ ...d, ...widen(d, on) }));
  const setW = (v) => setDraft((d) => (d.twoVariant ? { ...d, wBefore: v, w: Math.max(v, 2) } : { ...d, w: v }));
  const setLine = (key, p) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...p } : l)) }));
  const bumpSize = (key, dir) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, size: isSpacer(key) ? clampSpace(l.size + dir * 2) : clampSize(l.size + dir) } : l)) }));
  const addSpacer = () => setDraft((d) => ({ ...d, lines: [...d.lines, newSpacerLine()] }));
  const addPin = () => setDraft((d) => ({ ...d, lines: [...d.lines, { key: PIN_KEY, show: true, size: 0 }] }));
  const removeLine = (key) => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) }));
  const layoutOf = (p) => ({ presetId: p.id, w: p.w, h: p.h, header: p.header, lines: p.lines.map((l) => ({ ...l })) });

  // Drag reorder (template editor): the grip arms its row, dragging over
  // another row live-reorders, dragend settles.
  const [dragArm, setDragArm] = useState(null);
  const [dragKey, setDragKey] = useState(null);
  const dragTo = (overKey) => {
    if (!dragKey || dragKey === overKey) return;
    setDraft((d) => {
      const lines = [...d.lines];
      const from = lines.findIndex((l) => l.key === dragKey);
      const to = lines.findIndex((l) => l.key === overKey);
      if (from < 0 || to < 0) return d;
      const [moved] = lines.splice(from, 1);
      lines.splice(to, 0, moved);
      return { ...d, lines };
    });
  };
  const rowDnD = (l) => ({
    draggable: dragArm === l.key,
    onDragStart: (e) => { setDragKey(l.key); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", l.key); } catch { /* IE-style throw */ } },
    onDragEnter: () => dragTo(l.key),
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => e.preventDefault(),
    onDragEnd: () => { setDragKey(null); setDragArm(null); },
  });
  const dragHandle = (l) => (
    <button onMouseDown={() => setDragArm(l.key)} onMouseUp={() => setDragArm(null)}
      className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500" title="Drag to reorder">
      <GripVertical size={14} />
    </button>
  );

  // Switching template keeps what's typed.
  const applyPreset = (p) => {
    setDraft((d) => {
      const next = { ...d, ...layoutOf(p), wBefore: undefined, twoVariant: false };
      return d.twoVariant ? { ...next, ...widen(next, true) } : next;
    });
  };
  const fillFrom = (item) => setDraft((d) => ({ ...d, sku: item.sku || null, fields: { ...d.fields, ...stockToLabelFields(item) } }));
  const fillFrom2 = (item) => setDraft((d) => {
    const f = stockToLabelFields(item);
    return { ...d, fields2: Object.fromEntries(VARIANT_KEYS.map((k) => [k, f[k] || ""])) };
  });
  const fillTwo = (a, b) => {
    const t = twoSizeDraft(a, b);
    setDraft((d) => ({ ...d, ...widen(d, true), sku: t.sku, fields: { ...d.fields, ...t.fields }, fields2: { ...d.fields2, ...t.fields2 } }));
  };
  const addMany = (items) => onAddLabelsBulk(items.map((it) => ({ ...draft, sku: it.sku || null, fields: { ...draft.fields, ...stockToLabelFields(it) } })));

  const freshDraft = () => newDraftFromPreset(current);
  const save = () => {
    if (!draft.fields.name.trim() && !draft.sku) return;
    if (editingId) onUpdateLabel(editingId, draft); else onAddLabel(draft);
    setDraft(freshDraft());
    setEditingId(null);
  };
  const startNewLabel = () => { setDraft(freshDraft()); setEditingId(null); };
  const editLabel = (l) => {
    setDraft({ presetId: l.presetId, w: l.w, h: l.h, header: l.header, lines: l.lines.map((x) => ({ ...x })), fields: { ...l.fields }, twoVariant: !!l.twoVariant, fields2: { ...l.fields2 }, sku: l.sku });
    setEditingId(l.id);
  };

  // ── template editor: edits the draft's layout live; ✕ puts it back ──
  const openEditor = (isNew) => setTplEdit({ isNew, snap: { w: draft.w, wBefore: draft.wBefore, h: draft.h, header: draft.header, lines: draft.lines.map((l) => ({ ...l })) }, prompt: null });
  const closeEditor = (restore) => { if (restore && tplEdit) patchDraft(tplEdit.snap); setTplEdit(null); };
  const draftLayout = () => ({ w: draft.twoVariant ? (draft.wBefore ?? draft.w) : draft.w, h: draft.h, header: draft.header, lines: draft.lines });
  const afterSave = (preset) => {
    const onIt = labels.filter((l) => l.presetId === preset.id);
    if (onIt.length) setTplEdit((t) => ({ ...t, prompt: { preset, count: onIt.length } }));
    else setTplEdit(null);
  };
  const updateTemplate = () => {
    const preset = normPreset({ ...current, ...draftLayout() });
    onSavePreset(preset);
    afterSave(preset);
  };
  const saveAsNew = () => {
    const name = window.prompt("Name this template:", "");
    if (!name) return;
    const preset = normPreset({ id: uid(), name, ...draftLayout() });
    onSavePreset(preset);
    patchDraft({ presetId: preset.id });
    setTplEdit(null);
  };
  const resetTemplate = () => {
    const d = builtinDefault(current.id);
    if (!d) return;
    onSavePreset(d);
    setDraft((x) => { const next = { ...x, ...layoutOf(d), wBefore: undefined, twoVariant: false }; return x.twoVariant ? { ...next, ...widen(next, true) } : next; });
    afterSave(d);
  };
  const restyleAll = (preset) => {
    onUpdateLabelsBulk(labels.filter((l) => l.presetId === preset.id).map((l) => ({ id: l.id, patch: restyleLabel(l, preset) })));
    setTplEdit(null);
  };

  // ── set: filter + sort + selection ──
  const view = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    let out = labels.filter((l) => sizeFilter === "all" || l.presetId === sizeFilter);
    if (q) out = out.filter((l) => [l.fields.name, l.fields.sku, l.fields.grout, l.twoVariant ? l.fields2?.sku : ""].join(" ").toLowerCase().includes(q));
    return [...out].sort(sortBy === "az"
      ? (a, b) => (a.fields.name || "").localeCompare(b.fields.name || "")
      : (a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [labels, listSearch, sizeFilter, sortBy]);
  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectedLabels = labels.filter((l) => selected.has(l.id));
  const dropFromSelection = (ids) => {
    setSelected((s) => { const n = new Set(s); for (const id of ids) n.delete(id); return n; });
    if (ids.includes(editingId)) startNewLabel();
  };
  const deleteSelected = () => {
    const ids = selectedLabels.map((l) => l.id);
    onDeleteLabels(ids);
    dropFromSelection(ids);
    setConfirmDel(false);
  };
  const openReview = () => {
    setDoneBar(null);
    setReview({ plan: refreshPlan(selectedLabels, stock, skuKeys), del: new Set() });
  };
  const applyReview = () => {
    const { plan, del } = review;
    if (plan.changed.length) onUpdateLabelsBulk(plan.changed.map((c) => ({ id: c.id, patch: c.patch })));
    if (del.size) { onDeleteLabels([...del]); dropFromSelection([...del]); }
    if (plan.changed.some((c) => c.id === editingId)) startNewLabel();
    setDoneBar({ ids: plan.changed.map((c) => c.id), deleted: del.size });
    setReview(null);
  };

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
    // Names shrink in the popup itself, once its print fonts are in.
    const fitAll = () => {
      for (const card of w.document.querySelectorAll(".lc")) {
        const nm = card.querySelector(".lc-name");
        if (nm) fitNameSize((px) => { nm.style.fontSize = px + "px"; return overflows(card); }, parseFloat(nm.style.fontSize) || 13);
      }
    };
    const imgs = Array.from(w.document.images).filter((im) => !im.complete);
    Promise.all(imgs.map((im) => new Promise((res) => { im.onload = im.onerror = res; })))
      .then(() => new Promise((res) => setTimeout(res, 400)))
      .then(() => w.document.fonts?.ready)
      .then(() => { fitAll(); w.focus(); w.print(); });
  };
  const sheetsNote = (list) => { const n = sheetsForLabels(list); return plural(n, "sheet"); };

  const previewLabel = { ...draft, id: "preview" };
  const { body: formBody, bottom: formBottom } = splitPinned(draft.lines);
  const formLine = (l) => !isSpacer(l.key);

  const formRow = (l, pinned) => {
    const meta = LABEL_FIELDS.find((f) => f.key === l.key);
    const edge = pinned ? { borderLeft: "3px solid var(--ft-brand)" } : undefined;
    const two = draft.twoVariant && VARIANT_KEYS.includes(l.key);
    return (
      <div key={l.key} className="grid grid-cols-[70px_minmax(0,1fr)_50px] items-center gap-x-2 py-[3px]">
        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 truncate" title={meta.label}>{SHORT[l.key] || meta.label}</label>
        {meta.kind === "surface" ? (
          <div className="flex rounded-md border border-slate-200 overflow-hidden min-h-[30px]">
            {["Wall", "Floor & Wall"].map((s, i) => (
              <button key={s} onClick={() => setField("surface", draft.fields.surface === s ? "" : s)} title="Optional — tap again to remove the pill"
                className={`flex-1 text-xs font-semibold ${i ? "border-l border-slate-200" : ""} ${draft.fields.surface === s ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{s}</button>
            ))}
          </div>
        ) : two ? (
          <div className="grid grid-cols-2 gap-1">
            <input value={draft.fields[l.key]} onChange={(e) => setField(l.key, e.target.value)} placeholder="1st" className={inp} style={edge} />
            <input value={draft.fields2[l.key]} onChange={(e) => setField2(l.key, e.target.value)} placeholder="2nd" className={inp} style={edge} />
          </div>
        ) : (
          <input value={draft.fields[l.key]} onChange={(e) => setField(l.key, e.target.value)} placeholder={meta.kind === "custom" ? "Free text" : undefined} className={inp} style={edge} />
        )}
        {meta.kind === "surface" ? <div /> : <Nudge value={l.size} onStep={(dir) => bumpSize(l.key, dir)} />}
      </div>
    );
  };

  // ── right column bodies ──
  const editorPane = tplEdit && (
    <div style={{ maxWidth: SHEET_W }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-sm font-bold">{tplEdit.isNew ? "New template" : `Template: ${current.name}`}</div>
        <label className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer select-none" title="Outline each line on the preview to check spacing — never prints">
          <input type="checkbox" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} className="accent-indigo-600" />
          Line boxes
        </label>
      </div>
      {tplEdit.prompt ? (
        <div className="rounded-lg border p-3.5 bg-white" style={{ borderColor: "var(--ft-tint-border)" }}>
          <div className="text-sm font-bold">Saved “{tplEdit.prompt.preset.name}”.</div>
          <p className="text-sm text-slate-600 mt-1">Also restyle the {plural(tplEdit.prompt.count, "saved label")} on this template? Their text and prices stay; their own font nudges reset to the template's.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => restyleAll(tplEdit.prompt.preset)} className="text-sm font-semibold rounded-md bg-slate-800 text-white px-3 py-1.5">Restyle {tplEdit.prompt.count}</button>
            <button onClick={() => setTplEdit(null)} className="text-sm font-semibold rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Leave them</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-4">
          <div>
            <div className={eyebrow + " mb-1.5 flex items-center gap-1"}>Lines<HelpTip className="align-middle" tip={<>Drag to reorder and use the eye to show or hide a line. Lines dragged below the “Pinned to bottom” divider stick to the bottom of the card. If the text above runs into them, the tile name shrinks to fit.</>} /></div>
            <div className="rounded-lg border border-slate-200 bg-white px-1.5 py-1">
              {draft.lines.map((l) => {
                const rowCls = `flex items-center gap-1.5 px-1 py-1 border-b border-slate-50 last:border-0 ${l.show ? "" : "opacity-50"} ${dragKey === l.key ? "bg-indigo-50/70 rounded-md" : ""}`;
                if (isPin(l.key)) {
                  return (
                    <div key={l.key} {...rowDnD(l)} className="flex items-center gap-1.5 px-1 py-1.5">
                      {dragHandle(l)}
                      <PinDivider className="flex-1">Pinned to bottom</PinDivider>
                      <button onClick={() => removeLine(l.key)} className="w-5 h-5 shrink-0 flex items-center justify-center text-slate-300 hover:text-red-500" title="Remove the divider (nothing pinned)"><Trash2 size={12} /></button>
                    </div>
                  );
                }
                const eye = (
                  <button onClick={() => setLine(l.key, { show: !l.show })} className="w-6 h-6 shrink-0 flex items-center justify-center border border-slate-200 rounded-md text-indigo-600" title={l.show ? "Hide" : "Show"}>
                    {l.show ? <Eye size={13} /> : <EyeOff size={13} className="text-slate-300" />}
                  </button>
                );
                if (isSpacer(l.key)) {
                  return (
                    <div key={l.key} {...rowDnD(l)} className={rowCls}>
                      {dragHandle(l)}{eye}
                      <div className="flex-1 min-w-0"><div className="text-[11px] font-semibold text-slate-500">Filler space</div><div className="mt-0.5 rounded border border-dashed border-slate-300 bg-slate-50" style={{ height: Math.min(l.size, 14) }} /></div>
                      <Nudge value={l.size} onStep={(dir) => bumpSize(l.key, dir)} title="Height" />
                      <button onClick={() => removeLine(l.key)} className="w-5 h-5 shrink-0 flex items-center justify-center text-slate-300 hover:text-red-500" title="Remove filler"><Trash2 size={12} /></button>
                    </div>
                  );
                }
                return (
                  <div key={l.key} {...rowDnD(l)} className={rowCls}>
                    {dragHandle(l)}{eye}
                    <div className="flex-1 min-w-0 text-sm font-semibold truncate">{LABEL_OF[l.key]}</div>
                    {KIND_OF[l.key] !== "surface" && <Nudge value={l.size} onStep={(dir) => bumpSize(l.key, dir)} />}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-1.5">
              <button onClick={addSpacer} className="text-xs text-slate-500 font-semibold underline" title="A blank line that holds space open — drag it where you need the gap">＋ Filler space</button>
              {!draft.lines.some((l) => isPin(l.key)) && <button onClick={addPin} className="text-xs font-semibold underline" style={{ color: "var(--ft-brand-deep)" }}>＋ “Pinned to bottom” divider</button>}
            </div>
          </div>
          <div>
            <div className={eyebrow + " mb-1.5"}>Size &amp; header</div>
            <div className="grid grid-cols-[66px_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <span>Width</span><input type="number" step="0.25" min="0.25" value={draft.twoVariant ? (draft.wBefore ?? draft.w) : draft.w} onChange={(e) => setW(Math.max(0.25, parseFloat(e.target.value) || 0.25))} className={inp} />
              <span>Height</span><input type="number" step="0.25" min="0.25" value={draft.h} onChange={(e) => patchDraft({ h: Math.max(0.25, parseFloat(e.target.value) || 0.25) })} className={inp} />
              <span className="flex items-center gap-0.5">Header<HelpTip className="align-middle" tip={<>“Keim” (or blank) shows the Keim logo; anything else prints as text.</>} /></span>
              <input value={draft.header} onChange={(e) => patchDraft({ header: e.target.value })} className={inp} placeholder="Keim" />
            </div>
            <div className="text-[11px] text-slate-400 mt-1.5">≈{perLetterSheet(draftLayout())} per letter sheet</div>
            <div className="flex flex-col gap-1.5 mt-4">
              {!tplEdit.isNew && <button onClick={updateTemplate} className="text-sm font-semibold rounded-md bg-slate-800 text-white px-3 py-1.5">Update “{current.name}”</button>}
              <button onClick={saveAsNew} className="text-sm font-semibold rounded-md border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50">Save as new…</button>
              {!tplEdit.isNew && BUILTIN_IDS.has(current.id) && isBuiltinOverridden(current) && (
                <button onClick={resetTemplate} className="text-xs font-semibold text-slate-500 underline mt-1" title="Put this built-in back the way it shipped">Reset to default</button>
              )}
              <button onClick={() => closeEditor(true)} className="text-xs font-semibold text-slate-500 hover:text-slate-800 mt-1">Close without saving</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const priceCell = (before, after) => {
    if (before === after) return <span className="text-slate-400">{after || "—"}</span>;
    const up = (priceNum(after) ?? 0) > (priceNum(before) ?? 0);
    return <span><s className="text-slate-400 mr-1">{before || "—"}</s><b style={{ color: up ? "#8a3d25" : "var(--ft-brand-deep)" }}>{after}</b></span>;
  };
  const reviewRow = (label, right, sub) => (
    <div key={label.id} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2 border-t border-slate-100 text-sm">
      <span className="w-3.5 h-5 rounded-sm" style={{ background: "#1A1A1A" }} />
      <div className="min-w-0"><div className="truncate">{label.fields.name || "Untitled"}</div><div className="text-[11px] text-slate-400 truncate">{sub}</div></div>
      <div className="text-right text-[13px]">{right}</div>
    </div>
  );
  const reviewGroup = (title, n, rows, tone) => n > 0 && (
    <div className="rounded-lg border bg-white overflow-hidden mb-3" style={tone ? { borderColor: `color-mix(in oklab, ${RUST} 40%, transparent)` } : { borderColor: "var(--ft-border)" }}>
      <div className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2" style={{ background: tone ? `color-mix(in oklab, ${RUST} 12%, #fff)` : "var(--ft-sand)" }}>
        {title}<span className="bg-white rounded-full px-1.5 text-slate-800">{n}</span>
      </div>
      {rows}
    </div>
  );
  const reviewPane = review && (() => {
    const { plan, del } = review;
    const setDel = (id, on) => setReview((r) => { const d = new Set(r.del); if (on) d.add(id); else d.delete(id); return { ...r, del: d }; });
    return (
      <div style={{ maxWidth: SHEET_W }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[15px] font-bold">Update {plural(selectedLabels.length, "label")} from the stock book</div>
          <button onClick={() => setReview(null)} className="ml-auto text-slate-400 hover:text-slate-800" title="Cancel"><X size={16} /></button>
        </div>
        {reviewGroup("Price changed", plan.changed.length, plan.changed.map((c) => reviewRow(c.label,
          <div>{priceCell(c.before.price, c.after.price)}{c.after.price2 != null && <div className="text-[12px]">2nd {c.before.price2 === c.after.price2 ? <span className="text-slate-400">same</span> : priceCell(c.before.price2, c.after.price2)}</div>}</div>,
          [c.label.fields.sku || c.label.sku, c.label.fields.size, c.label.twoVariant && c.label.fields2.sku ? `2nd: ${c.label.fields2.sku}` : ""].filter(Boolean).join(" · "))))}
        {reviewGroup("Up to date", plan.same.length, plan.same.map((x) => reviewRow(x.label, <span className="text-slate-400">{x.label.fields.price || "—"}</span>, x.label.fields.sku || x.label.sku)))}
        {reviewGroup("SKU not in the stock book", plan.missing.length, plan.missing.map((x) => reviewRow(x.label,
          <div className="flex gap-3 text-xs">
            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={!del.has(x.id)} onChange={() => setDel(x.id, false)} /> Keep</label>
            <label className="flex items-center gap-1 cursor-pointer font-bold" style={{ color: "#8a3d25" }}><input type="radio" checked={del.has(x.id)} onChange={() => setDel(x.id, true)} /> Delete label</label>
          </div>,
          `${x.missingSkus.join(", ")}: no longer in the stock book (or switched off there)`)), true)}
        {reviewGroup("No SKU, skipped", plan.noSku.length, plan.noSku.map((x) => reviewRow(x.label, "", "Nothing to look up")))}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={applyReview} disabled={!plan.changed.length && !del.size} className="text-sm font-semibold rounded-md bg-slate-800 text-white px-3.5 py-1.5 disabled:opacity-40">Apply: update {plan.changed.length} · delete {del.size}</button>
          <button onClick={() => setReview(null)} className="text-sm font-semibold rounded-md border border-slate-200 bg-white px-3.5 py-1.5 hover:bg-slate-50">Cancel</button>
          <span className="text-xs text-slate-500 ml-auto">Only the price changes.</span>
        </div>
      </div>
    );
  })();

  const doneLabels = doneBar ? labels.filter((l) => doneBar.ids.includes(l.id)) : [];
  const setPane = (
    <div>
      <div style={{ maxWidth: SHEET_W }}>
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <div className="text-[13px] font-bold">Label set ({labels.length})</div>
        <div className="relative flex-1 min-w-[140px]">
          <Search size={13} className="absolute left-2 top-2 text-slate-400" />
          <input value={listSearch} onChange={(e) => setListSearch(e.target.value)} placeholder="Search name / SKU / grout" className="w-full border border-slate-200 rounded-md pl-7 pr-2 py-1 text-xs" />
        </div>
        <FitSelect sm value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="recent">Recent</option><option value="az">A–Z</option>
        </FitSelect>
      </div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        <button onClick={() => setSizeFilter("all")} className={`text-xs px-2.5 py-1 rounded-full border ${sizeFilter === "all" ? "bg-slate-800 text-white border-slate-800" : "border-slate-200"}`}>All</button>
        {presets.map((p) => <button key={p.id} onClick={() => setSizeFilter(p.id)} className={`text-xs px-2.5 py-1 rounded-full border ${sizeFilter === p.id ? "bg-slate-800 text-white border-slate-800" : "border-slate-200"}`}>{p.name}</button>)}
      </div>

      {doneBar && (
        <div className="flex items-center gap-2.5 flex-wrap rounded-lg border px-3 py-2 mb-3 text-sm" style={{ background: "var(--ft-tint)", borderColor: "var(--ft-tint-border)" }}>
          <b>✓ Updated {plural(doneBar.ids.length, "label")}{doneBar.deleted ? ` · deleted ${doneBar.deleted}` : ""}.</b>
          {doneLabels.length > 0 && <span className="text-xs text-slate-500">Their printed tags on the shelf now show the old price.</span>}
          <span className="ml-auto flex gap-2">
            {doneLabels.length > 0 && <button onClick={() => print(doneLabels)} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-800 text-white flex items-center gap-1.5"><Printer size={13} /> Print the {doneLabels.length} updated · {sheetsNote(doneLabels)}</button>}
            <button onClick={() => setDoneBar(null)} className="text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-200 bg-white">Done</button>
          </span>
        </div>
      )}

      {labels.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-lg px-2.5 py-2 mb-3 text-[13px]" style={{ background: "var(--ft-deep)", color: "var(--ft-accent-ink)" }}>
          {selected.size === 0 ? (<>
            <b>Select</b><span className="opacity-70">click a card's circle, or</span>
            <button onClick={() => setSelected(new Set(view.map((l) => l.id)))} disabled={!view.length} className="text-xs font-semibold px-2.5 py-1 rounded-md border border-white/30">Select all {view.length} shown</button>
          </>) : confirmDel ? (<>
            <b>Delete {plural(selected.size, "label")}?</b>
            <button onClick={deleteSelected} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white" style={{ color: "#8a3d25" }}>Yes, delete</button>
            <button onClick={() => setConfirmDel(false)} className="text-xs font-semibold px-2.5 py-1 rounded-md border border-white/30">No</button>
          </>) : (<>
            <b>{selected.size} selected</b>
            <button onClick={() => print(selectedLabels)} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white text-slate-800 flex items-center gap-1.5"><Printer size={12} /> Print {selected.size} · {sheetsNote(selectedLabels)}</button>
            <button onClick={openReview} disabled={!bookStockReady} title={bookStockReady ? "Re-check prices and SKUs against the stock book" : undefined} className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white text-slate-800 flex items-center gap-1.5 disabled:opacity-50"><RefreshCw size={12} /> {bookStockReady ? "Update from stock book" : "Stock book loading…"}</button>
            <button onClick={() => setConfirmDel(true)} className="text-xs font-semibold px-2.5 py-1 rounded-md border border-white/30">Delete</button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs underline opacity-80">Clear</button>
          </>)}
        </div>
      )}
      </div>

      {view.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-md p-8 text-center text-sm text-slate-400">{labels.length === 0 ? "No labels yet. Fill out the form and Save label." : "No labels match."}</div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {view.map((l) => {
            const on = selected.has(l.id);
            return (
              <div key={l.id} className="relative group">
                <button onClick={(e) => (e.shiftKey ? toggleSel(l.id) : editLabel(l))} className={`block text-left rounded ${on || editingId === l.id ? "ring-2 ring-offset-2" : ""}`} style={on || editingId === l.id ? { "--tw-ring-color": on ? "var(--ft-brand)" : AMBER } : undefined} title="Click to edit · Shift-click to select">
                  <LabelCard label={l} scale={Math.min(0.6, 120 / (l.w * 96))} />
                </button>
                <button onClick={() => toggleSel(l.id)} className={`absolute -top-2 -left-2 w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center text-[10px] font-extrabold text-white transition-opacity ${on ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}`} style={on ? { background: "var(--ft-brand)", borderColor: "var(--ft-brand)" } : { background: "#fff", borderColor: "var(--ft-border-strong)" }} title={on ? "Deselect" : "Select"}>{on ? "✓" : ""}</button>
                <button onClick={() => { if (editingId === l.id) startNewLabel(); onDeleteLabel(l.id); dropFromSelection([l.id]); }} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-slate-200 text-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center" title="Delete"><Trash2 size={12} /></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const fitNote = fitInfo && (fitInfo.stuck
    ? <div className="mt-2.5 text-[11px] font-semibold rounded-md px-2 py-1" style={{ color: "#8a3d25", background: `color-mix(in oklab, ${RUST} 12%, #fff)` }}>Still too long. Shorten a line or nudge a size down.</div>
    : fitInfo.to < fitInfo.from
      ? <div className="mt-2.5 text-[11px] rounded-md px-2 py-1" style={{ color: "var(--ft-brand-deep)", background: "var(--ft-tint)" }}>Name shrunk {fitInfo.from} → {fitInfo.to} to fit</div>
      : null);

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[340px_300px_minmax(0,1fr)] md:overflow-hidden overflow-y-auto">
      {/* left: find & fill */}
      <div className="border-r border-slate-100 p-3.5 md:overflow-y-auto">
        <SkuLookup stock={stock} onPick={fillFrom} onTwo={fillTwo} onAddMany={addMany} />
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: editingId ? AMBER : "var(--ft-brand)" }} />
            <span className="truncate">{editingId ? `Editing “${draft.fields.name || "label"}”` : "New label"}</span>
          </div>
          <button onClick={startNewLabel} className="ml-auto border border-slate-200 rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-slate-50">New</button>
          <button onClick={save} className="bg-slate-800 text-white rounded-md px-5 py-1.5 text-sm font-semibold hover:bg-slate-700 whitespace-nowrap">{editingId ? "Save changes" : "Save label"}</button>
        </div>
        <div className="border-t border-slate-100 mt-3 mb-1.5" />
        {formBody.filter(formLine).map((l) => formRow(l, false))}
        {formBottom.some(formLine) && <PinDivider className="mt-1 mb-0.5" />}
        {formBottom.filter(formLine).map((l) => formRow(l, true))}
        {draft.twoVariant ? (
          <div className="mt-2.5 space-y-1.5">
            <SkuLookup single stock={stock} onPick={fillFrom2} placeholder="Search stock book to fill the 2nd size…" />
            <button onClick={() => setTwoVariant(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-800">✕ Remove second size</button>
          </div>
        ) : (
          <button onClick={() => setTwoVariant(true)} className="mt-2.5 text-xs font-bold" style={{ color: "var(--ft-brand-deep)" }}>＋ Add a second size</button>
        )}
      </div>

      {/* middle: template + preview */}
      <div className="border-r border-slate-100 p-3.5 flex flex-col items-center md:overflow-y-auto" style={{ background: "color-mix(in oklab, var(--ft-sand) 55%, var(--ft-card))" }}>
        <div className="self-stretch">
          <TemplateMenu presets={presets} current={current} editing={tplEdit} onPick={applyPreset}
            onEdit={() => openEditor(false)} onNew={() => openEditor(true)} onCloseEdit={() => closeEditor(!tplEdit?.prompt)} />
        </div>
        <div className={eyebrow + " self-start mt-4 mb-2"}>Live preview</div>
        <LabelCard label={previewLabel} boxes={!!tplEdit && showBoxes} scale={Math.min(1.3, 250 / (draft.w * 96))} onFit={setFitInfo} />
        {fitNote}
      </div>

      {/* right: the set, or the template editor / update review */}
      <div className="p-4 md:overflow-y-auto min-w-0 bg-slate-50/40">
        {tplEdit ? editorPane : review ? reviewPane : setPane}
      </div>
    </div>
  );
}

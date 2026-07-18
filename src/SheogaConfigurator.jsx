// Sheoga vendor configurator popup (issue 023, prototype A "option board"):
// every option group on one card, live build + sell price on the right, no
// steps. All pricing comes from src/sheoga.js — this file is presentation only.
// "Add to product line" hands the lineItems() payloads back to the caller; the
// row keeps the raw configuration (product.sheoga) so Reconfigure reopens here.
import { useEffect, useMemo, useState } from "react";
import { X, Grid3X3, Plus } from "lucide-react";
import {
  MODES, defaultConfig, calcConfig, calcFloor, calcStocked, calcHerringbone, calcVent,
  floorBase, floorWidths, WIDTHS, WIDTH_LABEL, LIVE_SAWN_SP, SPECIES,
  TEXTURES, EDGES, LENGTHS, FINISHES, NO_SAP, CUSTOM_FINISHES,
  STOCKED, STOCKED_WIDTHS, stockedItem, HERRINGBONE, CHEVRON_ADD,
  STAIN_COLORS, SHEENS, SHEEN_FEE,
  VENT_GROUP, VENT_CATS, VENT_PREFIN, VENT_TEX, VENT_CUBED, DAMPER_ATTACH, DAMPERS,
  DEFAULT_MARKUP, DEFAULT_VENT_MARKUP, sellOf, cartonize, lineItems, frameLineal, SHEET_NOTE,
} from "./sheoga.js";

const fm = (n) => "$" + n.toFixed(2);
const fmInt = (n) => "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

// --- small option controls ----------------------------------------------------

function Sect({ title, hint, extra, children }) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="ft-eyebrow text-[10px]">{title}</span>
        {extra}
        {hint && <span className="ml-auto text-[10.5px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chips({ items, cur, onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button key={String(it.id)} disabled={it.dis} onClick={() => onPick(it.id)}
          className={`rounded-md border px-2.5 py-1.5 text-xs font-bold leading-tight text-center ${it.id === cur ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"} ${it.dis ? "opacity-30 cursor-not-allowed line-through" : ""}`}>
          {it.label}
          {it.sub != null && <span className={`block text-[10px] font-semibold no-underline ${it.id === cur ? "text-white/70" : "text-slate-400"}`}>{it.sub}</span>}
        </button>
      ))}
    </div>
  );
}

function Seg({ opts, cur, onPick }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
      {opts.map((o) => (
        <button key={o.id} disabled={o.dis} onClick={() => onPick(o.id)}
          className={`px-3.5 py-1.5 text-xs font-bold border-l first:border-l-0 border-slate-300 ${o.id === cur ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:bg-slate-50"} ${o.dis ? "opacity-40" : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function RadioList({ items, cur, onPick }) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-300 overflow-hidden">
      {items.map((it) => {
        const on = it.id === cur;
        return (
          <button key={String(it.id)} onClick={() => onPick(it.id)}
            className="flex items-center gap-2.5 px-3 py-2 bg-white text-left text-xs font-semibold text-slate-800 border-t first:border-t-0 border-slate-100 hover:bg-slate-50">
            <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 relative ${on ? "border-indigo-600" : "border-slate-300"}`}>
              {on && <span className="absolute inset-[2px] rounded-full bg-indigo-600" />}
            </span>
            <span className="flex-1 min-w-0">
              {it.label}
              {it.sub && <span className="block text-[10.5px] font-medium text-slate-400 mt-0.5">{it.sub}</span>}
            </span>
            {it.add && <span className={`shrink-0 text-[11.5px] font-bold tabular-nums ${on ? "text-indigo-700" : "text-slate-500"}`}>{it.add}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({ label, on, onClick, add }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 mt-1.5 first:mt-0">
      <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-extrabold text-white shrink-0 ${on ? "bg-indigo-600" : "border-2 border-slate-300"}`}>{on ? "✓" : ""}</span>
      <span className="flex-1">{label}</span>
      {add && <span className="text-[11.5px] font-bold text-slate-500 tabular-nums">{add}</span>}
    </button>
  );
}

const QtyInput = ({ value, onChange }) => (
  <input type="number" min="1" value={value} onChange={(e) => onChange(Math.max(1, Math.round(Number(e.target.value) || 1)))}
    className="w-24 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" />
);

const selectCls = "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const textCls = "w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500";

// Labeled dropdown for the compact floor rail (texture / edge / lengths /
// finishing). Options are { id, label, dis? }.
function Dropdown({ label, hint, value, options, onChange }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-1"><span className="ft-eyebrow text-[10px]">{label}</span>{hint && <span className="text-[9.5px] text-slate-400 font-medium">{hint}</span>}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        {options.map((o) => <option key={String(o.id)} value={o.id} disabled={o.dis}>{o.label}</option>)}
      </select>
    </div>
  );
}

// The "full price grid" trigger — a real button, shared by both rails.
function GridButton({ onClick }) {
  return (
    <button onClick={onClick} className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
      <Grid3X3 size={13} /> Price grid
    </button>
  );
}

// Stain color: the stocked program's standard colors + a custom entry.
// cfg carries `stain` (the color) and `stainCustom` (typed-in flag).
function StainPicker({ cfg, set }) {
  const sel = cfg.stainCustom ? "__c" : STAIN_COLORS.includes(cfg.stain) ? cfg.stain : "";
  return (
    <div>
      <div className="ft-eyebrow text-[10px] mb-1">Stain color</div>
      <select value={sel} onChange={(e) => { const v = e.target.value; if (v === "__c") set({ ...cfg, stainCustom: true, stain: "" }); else set({ ...cfg, stainCustom: false, stain: v }); }} className={selectCls}>
        <option value="">Pick color…</option>
        {STAIN_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value="__c">Custom…</option>
      </select>
      {cfg.stainCustom && (
        <input value={cfg.stain} onChange={(e) => set({ ...cfg, stain: e.target.value })} placeholder="Custom color name / T-ref" className={textCls + " mt-1.5"} />
      )}
    </div>
  );
}

// Sheen: 30/20/15/10/5 + custom. `note` (e.g. the $250 hint) shows beside the
// label; `warn` renders under the control when a fee applies.
function SheenPicker({ cfg, set, note, warn }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-1"><span className="ft-eyebrow text-[10px]">Sheen</span>{note && <span className="text-[9.5px] text-slate-400 font-medium">{note}</span>}</div>
      <select value={cfg.sheenCustom ? "__c" : cfg.sheen} onChange={(e) => { const v = e.target.value; if (v === "__c") set({ ...cfg, sheenCustom: true }); else set({ ...cfg, sheenCustom: false, sheen: v }); }} className={selectCls}>
        {SHEENS.map((s) => <option key={s} value={s}>{s}-sheen</option>)}
        <option value="__c">Custom…</option>
      </select>
      {cfg.sheenCustom && (
        <input type="number" min="0" value={cfg.sheen} onChange={(e) => set({ ...cfg, sheen: e.target.value })} placeholder="e.g. 25" className={textCls + " mt-1.5"} />
      )}
      {warn && <div className="mt-1.5 text-[11px] font-bold text-amber-700">⚠ {warn}</div>}
    </div>
  );
}

// --- per-mode option rails ----------------------------------------------------

// A species/grade/construction change can land on a width the new combo doesn't
// offer — snap to the first offered one so the build never goes dead silently.
const snapFloorW = (f) => {
  if (floorBase(f) != null) return f;
  const w = floorWidths(f).find((w2) => floorBase({ ...f, w: w2 }) != null);
  return w != null ? { ...f, w } : f;
};

function FloorRail({ f, set, sf, markup, onGrid }) {
  const sell = (c) => (c ? fm(sellOf(c.cost, markup)) + "/sf" : "—");
  const custom = CUSTOM_FINISHES.includes(f.finish);
  const prefin = f.finish !== "unf";
  const stained = f.finish === "est" || custom;
  return (<>
    <Sect title="Species" hint="sell $/sf at current options">
      <Chips cur={f.sp} onPick={(sp) => set(snapFloorW({ ...f, sp }))}
        items={SPECIES.map((sp) => {
          const probe = snapFloorW({ ...f, sp });
          const c = calcFloor(probe, sf);
          return { id: sp, label: sp, sub: c ? sell(c) + (probe.w !== f.w ? " @" + WIDTH_LABEL[probe.w] : "") : "—", dis: !c };
        })} />
    </Sect>
    {/* Construction (left) + Grade, with the price grid pushed to the right */}
    <div className="mb-4 flex items-end gap-4 flex-wrap">
      <div>
        <div className="ft-eyebrow text-[10px] mb-1.5">Construction</div>
        <Seg opts={[{ id: "solid", label: "Solid" }, { id: "eng", label: "Eng." }]} cur={f.cons} onPick={(cons) => set(snapFloorW({ ...f, cons }))} />
      </div>
      <div>
        <div className="ft-eyebrow text-[10px] mb-1.5">Grade</div>
        {f.sp === LIVE_SAWN_SP
          ? <Seg opts={[{ id: "ls", label: "Live Sawn" }]} cur="ls" onPick={() => {}} />
          : <Seg opts={[{ id: "clear", label: "Clear" }, { id: "char", label: "Char." }]} cur={f.grade} onPick={(grade) => set(snapFloorW({ ...f, grade }))} />}
      </div>
      <div className="ml-auto self-end"><GridButton onClick={onGrid} /></div>
    </div>
    <Sect title="Width">
      <Chips cur={f.w} onPick={(w) => set({ ...f, w: +w })}
        items={floorWidths(f).map((w) => { const c = calcFloor({ ...f, w }, sf); return { id: w, label: WIDTH_LABEL[w], sub: c ? sell(c) : "—", dis: !c }; })} />
    </Sect>
    {/* Minor options as a 2×2 grid of dropdowns: Texture · Finishing / Lengths · Edge */}
    <div className="mb-4 grid grid-cols-2 gap-x-3 gap-y-3">
      <Dropdown label="Texture / scrape" value={f.tex} onChange={(tex) => set({ ...f, tex })}
        options={TEXTURES.map((t) => ({ id: t.id, label: t.name.replace(" (standard)", "") + (t.add ? `  +${fm(t.add)}` : "") }))} />
      <Dropdown label="Finishing" hint="fee under 500 sf" value={f.finish} onChange={(finish) => set({ ...f, finish })}
        options={FINISHES.map((x) => ({ id: x.id, label: x.name + (x.id === "unf" ? "" : `  +${fm(x.add(f))}`) }))} />
      <Dropdown label="Lengths" value={f.len} onChange={(len) => set({ ...f, len })}
        options={LENGTHS.map((l) => ({ id: l.id, label: l.name.replace(" (standard)", "") + (l.pct ? `  +${l.pct}%` : "") }))} />
      <Dropdown label="Edge" value={f.edge} onChange={(edge) => set({ ...f, edge })}
        options={EDGES.map((e) => ({ id: e.id, label: e.name + (e.add ? `  +${fm(e.add)}` : "") }))} />
    </div>
    {/* Prefinished finishes: stain color (established/custom) + sheen. Sheen is
        free on this custom/floor tab — no fee, it's made to order regardless. */}
    {prefin && (
      <div className="mb-4 rounded-lg border border-dashed p-3" style={{ borderColor: "var(--ft-tint-border)", background: "var(--ft-tint)" }}>
        <div className={`grid gap-3 ${stained ? "grid-cols-2" : "grid-cols-1"}`}>
          {stained && <StainPicker cfg={f} set={set} />}
          <SheenPicker cfg={f} set={set} note="· included, no charge" />
        </div>
      </div>
    )}
    {NO_SAP[f.sp] != null && (
      <Sect title="Sap">
        <Toggle label={`No sap — ${f.sp}`} on={f.noSap} onClick={() => set({ ...f, noSap: !f.noSap })} add={`+${fm(NO_SAP[f.sp])}/sf`} />
      </Sect>
    )}
    {custom && (
      <Sect title="Custom color sample">
        <Toggle label="Color-match sample — approval bundle" on={f.sample} onClick={() => set({ ...f, sample: !f.sample })} add="+$750 flat" />
      </Sect>
    )}
  </>);
}

function StockedRail({ k, set, sf, markup, onGrid }) {
  const it = stockedItem(k) || STOCKED[0];
  const species = [...new Set(STOCKED.map((x) => x.sp))];
  const colorsFor = (sp) => STOCKED.filter((x) => x.sp === sp);
  // Picking a species/color/grade the current width doesn't come in snaps it.
  const snap = (next) => {
    const nit = stockedItem(next);
    if (!nit) return next;
    if (!nit[next.grade]) next = { ...next, grade: nit.clear ? "clear" : "char" };
    const ws = STOCKED_WIDTHS[next.grade];
    if (!ws.includes(next.w) || nit[next.grade][ws.indexOf(next.w)] == null) {
      const w = ws.find((w2) => nit[next.grade][ws.indexOf(w2)] != null);
      if (w != null) next = { ...next, w };
    }
    return next;
  };
  // Changing species/color resets the sheen to that product's standard.
  const pickSpecies = (sp) => { const c = colorsFor(sp)[0]; set(snap({ ...k, sp, color: c.color, sheen: String(c.sheen), sheenCustom: false })); };
  const pickColor = (color) => { const nit = STOCKED.find((x) => x.sp === k.sp && x.color === color); set(snap({ ...k, color, sheen: String(nit.sheen), sheenCustom: false })); };
  const std = it.sheen;
  const curSheen = k.sheenCustom ? k.sheen : (k.sheen ?? String(std));
  const changed = k.sheenCustom ? (k.sheen !== "" && Number(k.sheen) !== std) : (Number(k.sheen ?? std) !== std);
  return (<>
    <Sect title="Species" hint="ships from stock">
      <Chips cur={k.sp} onPick={pickSpecies} items={species.map((sp) => ({ id: sp, label: sp }))} />
    </Sect>
    <Sect title="Color" hint={`${colorsFor(k.sp).length} in ${k.sp}`}>
      <Chips cur={k.color} onPick={pickColor}
        items={colorsFor(k.sp).map((x) => ({ id: x.color, label: x.color.replace(/ · /g, " "), sub: (x.tex ? "textured · " : "") + x.sheen + "-sheen" }))} />
    </Sect>
    {/* Grade centered, with the price grid button beside it */}
    <div className="mb-4">
      <div className="ft-eyebrow text-[10px] mb-1.5 text-center">Grade</div>
      <div className="flex items-center justify-center gap-3">
        <Seg cur={k.grade} onPick={(grade) => set(snap({ ...k, grade }))}
          opts={[{ id: "clear", label: "Clear", dis: !it.clear }, { id: "char", label: "Character", dis: !it.char }]} />
        <GridButton onClick={onGrid} />
      </div>
    </div>
    <Sect title="Width">
      <Chips cur={k.w} onPick={(w) => set({ ...k, w: +w })}
        items={STOCKED_WIDTHS[k.grade].map((w) => { const c = calcStocked({ ...k, w }); return { id: w, label: WIDTH_LABEL[w], sub: c ? fm(sellOf(c.cost, markup)) + "/sf" : "—", dis: !c }; })} />
    </Sect>
    <Sect title="Sheen">
      <SheenPicker cfg={k} set={set} note={`standard ${std} · +$${SHEEN_FEE} if changed`}
        warn={changed ? `Non-standard sheen (${curSheen} vs ${std}) — adds a $${SHEEN_FEE} flat line at cost.` : null} />
    </Sect>
  </>);
}

function HbRail({ h, set, markup, onGrid }) {
  const snap = (next) => {
    const t = HERRINGBONE[next.cons === "solid" ? "solid" : "eng"][next.sp];
    return t.ws.includes(next.w) ? next : { ...next, w: t.ws[Math.min(2, t.ws.length - 1)] };
  };
  const table = HERRINGBONE[h.cons === "solid" ? "solid" : "eng"][h.sp];
  return (<>
    <Sect title="Species">
      <Chips cur={h.sp} onPick={(sp) => set(snap({ ...h, sp }))}
        items={Object.keys(HERRINGBONE.solid).map((sp) => {
          const p = snap({ ...h, sp });
          const c = calcHerringbone(p);
          return { id: sp, label: sp, sub: c ? fm(sellOf(c.cost, markup)) + "/sf" : "—" };
        })} />
    </Sect>
    <Sect title="Construction">
      <Seg opts={[{ id: "solid", label: "Solid" }, { id: "eng", label: "Engineered" }]} cur={h.cons} onPick={(cons) => set(snap({ ...h, cons }))} />
    </Sect>
    <Sect title="Width" extra={<button onClick={onGrid} className="text-[11px] font-bold text-indigo-700 underline underline-offset-2">full price grid →</button>}>
      <Chips cur={h.w} onPick={(w) => set({ ...h, w: +w })}
        items={table.ws.map((w) => { const c = calcHerringbone({ ...h, w }); return { id: w, label: WIDTH_LABEL[w], sub: c ? fm(sellOf(c.cost, markup)) + "/sf" : "—", dis: !c }; })} />
    </Sect>
    <Sect title="Slat length">
      <RadioList cur={h.band} onPick={(band) => set({ ...h, band: +band })}
        items={HERRINGBONE.bands.map((b, i) => { const c = calcHerringbone({ ...h, band: i }); return { id: i, label: b, add: c ? fm(sellOf(c.cost, markup)) + "/sf" : "—" }; })} />
    </Sect>
    <Sect title="Pattern">
      <Toggle label="Chevron pattern (slip tongue included)" on={h.chevron} onClick={() => set({ ...h, chevron: !h.chevron })} add={`+${fm(CHEVRON_ADD)}/sf`} />
    </Sect>
  </>);
}

function VentRail({ v, set, markup, onGrid }) {
  const cat = VENT_CATS.find((c) => c.id === v.cat);
  const snapSize = (next) => {
    const c2 = VENT_CATS.find((c) => c.id === next.cat);
    return c2.list().some((r) => r[0] === next.size) ? next : { ...next, size: c2.list()[0][0] };
  };
  return (<>
    <Sect title="Species" hint="A: cherry/hickory/beech/red oak">
      <Chips cur={v.sp} onPick={(sp) => set({ ...v, sp })}
        items={Object.keys(VENT_GROUP).map((sp) => ({ id: sp, label: sp, sub: "group " + VENT_GROUP[sp] }))} />
    </Sect>
    <Sect title="Vent type">
      <RadioList cur={v.cat} onPick={(id) => set(snapSize({ ...v, cat: id }))}
        items={VENT_CATS.map((c) => ({ id: c.id, label: c.name }))} />
    </Sect>
    <Sect title="Size (duct W × L)" hint="sell, each, with options" extra={<button onClick={onGrid} className="text-[11px] font-bold text-indigo-700 underline underline-offset-2">full grid →</button>}>
      <Chips cur={v.size} onPick={(size) => set({ ...v, size })}
        items={cat.list().map((row) => { const c = calcVent({ ...v, size: row[0] }); return { id: row[0], label: row[0] + '"', sub: c ? fm(sellOf(c.cost, markup)) : "—" }; })} />
    </Sect>
    <Sect title="Options">
      {cat.cubed && <Toggle label="Cubed grille" on={v.cubed} onClick={() => set({ ...v, cubed: !v.cubed })} add={`+${fm(VENT_CUBED)}`} />}
      <Toggle label="Prefinished" on={v.prefin} onClick={() => set({ ...v, prefin: !v.prefin })} add={`+${fm(VENT_PREFIN)}`} />
      <Toggle label="Textured" on={v.tex} onClick={() => set({ ...v, tex: !v.tex })} add={`+${fm(VENT_TEX)}`} />
      {DAMPERS[v.size] && <Toggle label="Attach damper" on={v.damper} onClick={() => set({ ...v, damper: !v.damper })} add={`+${fm(DAMPERS[v.size][1] + DAMPER_ATTACH)}`} />}
      {cat.frame && <Toggle label="Add frame ($0.40 / lineal inch)" on={v.frame} onClick={() => set({ ...v, frame: !v.frame })} add={`+${fm(0.4 * frameLineal(v.size))}`} />}
    </Sect>
    <Sect title="Quantity"><QtyInput value={v.qty} onChange={(qty) => set({ ...v, qty })} /></Sect>
  </>);
}

function DamperRail({ d, set, markup }) {
  return (<>
    <Sect title="Size" hint="sell each at markup">
      <Chips cur={d.size} onPick={(size) => set({ ...d, size })}
        items={Object.keys(DAMPERS).map((sz) => ({ id: sz, label: sz + '"', sub: fm(sellOf(DAMPERS[sz][1], markup)) }))} />
    </Sect>
    <Sect title="Quantity"><QtyInput value={d.qty} onChange={(qty) => set({ ...d, qty })} /></Sect>
    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Loose dampers. To price a damper attached to a vent (+$5 attach), use the Wood vents tab.</p>
  </>);
}

// --- full price grids ---------------------------------------------------------

const gridBtn = "w-full px-2 py-1.5 text-right tabular-nums rounded hover:bg-indigo-50";
const gridCur = "bg-slate-900 text-white hover:bg-slate-900";

function GridModal({ mode, cfg, onPick, onClose }) {
  let title = "", body = null;
  const th = "px-2 py-1.5 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300 bg-slate-100 first:text-left";
  const tdName = "px-2 py-1.5 text-left text-xs font-bold whitespace-nowrap";
  if (mode === "floor") {
    const cols = WIDTHS.concat([9.25, 11.25]);
    title = `Full price grid — ${cfg.grade === "clear" ? "Clear" : "Character"}, ${cfg.cons === "solid" ? "Solid" : "Engineered"}`;
    body = (
      <table className="w-full border-collapse">
        <thead><tr><th className={th}>Species</th>{cols.map((w) => <th key={w} className={th}>{WIDTH_LABEL[w]}</th>)}</tr></thead>
        <tbody>
          {SPECIES.map((sp) => (
            <tr key={sp} className="border-b border-slate-100">
              <td className={tdName}>{sp}</td>
              {cols.map((w) => {
                const p = floorBase({ ...cfg, sp, w });
                if (p == null) return <td key={w} className="px-2 py-1.5 text-right text-slate-300">—</td>;
                const cur = sp === cfg.sp && w === cfg.w;
                return <td key={w} className="text-xs font-semibold"><button onClick={() => onPick({ sp, w })} className={`${gridBtn} ${cur ? gridCur : ""}`}>{p.toFixed(2)}</button></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (mode === "stocked") {
    const ws = STOCKED_WIDTHS.char;
    title = "Stocked prefinished — full grid";
    body = (
      <table className="w-full border-collapse">
        <thead><tr><th className={th}>Color</th><th className={th}></th>{ws.map((w) => <th key={w} className={th}>{WIDTH_LABEL[w]}</th>)}</tr></thead>
        <tbody>
          {STOCKED.flatMap((it) => ["clear", "char"].filter((g) => it[g]).map((g) => (
            <tr key={`${it.sp}|${it.color}|${g}`} className="border-b border-slate-100">
              <td className={tdName}>{it.sp} — {it.color}{it.sheen !== 30 && <span className="text-slate-400 font-medium"> ({it.sheen})</span>}</td>
              <td className="px-1 py-1.5 text-[10px] text-slate-400 font-semibold">{g === "clear" ? "C" : "Ch"}</td>
              {ws.map((w) => {
                const wi = STOCKED_WIDTHS[g].indexOf(w);
                const p = wi < 0 ? null : it[g][wi];
                if (p == null) return <td key={w} className="px-2 py-1.5 text-right text-slate-300">—</td>;
                const cur = it.sp === cfg.sp && it.color === cfg.color && g === cfg.grade && w === cfg.w;
                return <td key={w} className="text-xs font-semibold"><button onClick={() => onPick({ sp: it.sp, color: it.color, grade: g, w })} className={`${gridBtn} ${cur ? gridCur : ""}`}>{p.toFixed(2)}</button></td>;
              })}
            </tr>
          )))}
        </tbody>
      </table>
    );
  } else if (mode === "hb") {
    const t = HERRINGBONE[cfg.cons === "solid" ? "solid" : "eng"][cfg.sp];
    title = `Herringbone — ${cfg.sp}, ${cfg.cons === "solid" ? "Solid" : "Engineered"}`;
    body = (
      <table className="w-full border-collapse">
        <thead><tr><th className={th}>Slat length</th>{t.ws.map((w) => <th key={w} className={th}>{WIDTH_LABEL[w]}</th>)}</tr></thead>
        <tbody>
          {HERRINGBONE.bands.map((b, bi) => (
            <tr key={b} className="border-b border-slate-100">
              <td className={tdName}>{b}</td>
              {t.ws.map((w, wi) => {
                const cur = bi === cfg.band && w === cfg.w;
                return <td key={w} className="text-xs font-semibold"><button onClick={() => onPick({ band: bi, w })} className={`${gridBtn} ${cur ? gridCur : ""}`}>{t.p[bi][wi].toFixed(2)}</button></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else {
    // vents & dampers: the current category's group table, three columns across
    const isVent = mode === "vent";
    const g = isVent ? VENT_GROUP[cfg.sp] : "A";
    const cat = isVent ? VENT_CATS.find((c) => c.id === cfg.cat) : VENT_CATS[0];
    const rows = cat.list();
    const per = Math.ceil(rows.length / 3);
    title = `${cat.name} vents — group ${g}`;
    body = (
      <table className="w-full border-collapse">
        <thead><tr>{[0, 1, 2].map((i) => <Fragment2 key={i}><th className={th + " text-left"}>Size</th><th className={th}>Cost</th></Fragment2>)}</tr></thead>
        <tbody>
          {Array.from({ length: per }, (_, i) => (
            <tr key={i} className="border-b border-slate-100">
              {[0, 1, 2].map((cix) => {
                const r = rows[i + cix * per];
                if (!r) return <Fragment2 key={cix}><td /><td /></Fragment2>;
                const cur = isVent && r[0] === cfg.size;
                return (
                  <Fragment2 key={cix}>
                    <td className={tdName}>{r[0]}"</td>
                    <td className="text-xs font-semibold"><button onClick={() => isVent && onPick({ size: r[0] })} className={`${gridBtn} ${cur ? gridCur : ""}`}>{r[cat.col(g)].toFixed(2)}</button></td>
                  </Fragment2>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-4 z-[80]" style={{ background: "rgba(20,15,10,.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[86vh] overflow-auto border border-slate-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-3 border-b border-slate-200 bg-white">
          <span className="text-sm font-extrabold">{title}</span>
          <span className="text-[11px] text-slate-400 font-semibold">distributor cost · click to select</span>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <div className="p-4">{body}</div>
      </div>
    </div>
  );
}
// React.Fragment that tolerates a key prop list in the vent grid loops.
const Fragment2 = ({ children }) => <>{children}</>;

// --- the popup ----------------------------------------------------------------

export default function SheogaConfigurator({ seed, initialSf, markupDefault, ventMarkupDefault, onAdd, onClose }) {
  const [mode, setMode] = useState(seed?.mode || "floor");
  const [cfgs, setCfgs] = useState(() => {
    const base = Object.fromEntries(MODES.map((m) => [m.id, defaultConfig(m.id)]));
    if (seed?.mode && seed?.cfg) base[seed.mode] = { ...base[seed.mode], ...seed.cfg };
    return base;
  });
  // Flooring and vents/dampers carry separate markups (Settings → Price book).
  // The footer's markup box edits whichever applies to the active tab.
  const [markup, setMarkup] = useState(markupDefault ?? DEFAULT_MARKUP);
  const [ventMarkup, setVentMarkup] = useState(ventMarkupDefault ?? DEFAULT_VENT_MARKUP);
  const ventMode = mode === "vent" || mode === "damper";
  const activeMarkup = ventMode ? ventMarkup : markup;
  const setActiveMarkup = ventMode ? setVentMarkup : setMarkup;
  const [sf, setSf] = useState(initialSf > 0 ? initialSf : 1);
  const [grid, setGrid] = useState(false);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); if (grid) setGrid(false); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, grid]);

  const cfg = cfgs[mode];
  const set = (next) => setCfgs((c) => ({ ...c, [mode]: next }));
  const snap = { mode, cfg };
  const c = useMemo(() => calcConfig(snap, sf), [mode, cfg, sf]);
  const sell = c ? sellOf(c.cost, activeMarkup) : 0;
  const isEa = c?.per === "ea";
  const qty = c?.qty || 1;
  const ctn = c && !isEa ? cartonize(sf, c.cartonSf) : null;
  const feesTot = (c?.fees || []).reduce((a, x) => a + x.amt, 0);
  const jobTot = c ? (isEa ? sell * qty : sell * (ctn ? ctn.billedSf : sf)) + feesTot : 0;
  const add = () => { if (c) onAdd(lineItems(snap, { sf, markupPct: activeMarkup }), snap); };

  const sfMode = !isEa && mode !== "vent" && mode !== "damper";
  return (
    <div className="print:hidden fixed inset-0 flex items-center justify-center p-2 md:p-5 z-[70]" style={{ background: "rgba(20,15,10,.55)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-5xl h-[min(820px,94vh)] flex flex-col overflow-hidden border border-slate-300 shadow-2xl" onClick={(e) => e.stopPropagation()} data-sheoga-pop>
        {/* header */}
        <div className="flex items-center gap-3 px-4 pt-3">
          <div className="leading-tight">
            <div className="ft-eyebrow text-[9px]">Vendor configurator</div>
            <div className="text-lg font-extrabold">Sheoga Hardwood <span className="text-xs font-semibold text-slate-500 ml-1.5">bought by description — no SKUs</span></div>
          </div>
          <button onClick={onClose} className="ml-auto w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center"><X size={15} /></button>
        </div>
        {/* mode tabs */}
        <div className="flex gap-0.5 px-4 pt-2.5 border-b border-slate-300">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`px-3.5 py-2 text-xs font-bold rounded-t-lg border border-b-0 -mb-px ${mode === m.id ? "bg-white border-slate-300 text-slate-900 relative z-10" : "bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700"}`}>
              {m.label}
            </button>
          ))}
        </div>
        {/* body */}
        <div className="flex-1 flex min-h-0">
          <div className="w-[46%] max-w-[420px] shrink-0 border-r border-slate-300 overflow-y-auto p-4">
            {mode === "floor" && <FloorRail f={cfg} set={set} sf={sf} markup={activeMarkup} onGrid={() => setGrid(true)} />}
            {mode === "stocked" && <StockedRail k={cfg} set={set} sf={sf} markup={activeMarkup} onGrid={() => setGrid(true)} />}
            {mode === "hb" && <HbRail h={cfg} set={set} markup={activeMarkup} onGrid={() => setGrid(true)} />}
            {mode === "vent" && <VentRail v={cfg} set={set} markup={activeMarkup} onGrid={() => setGrid(true)} />}
            {mode === "damper" && <DamperRail d={cfg} set={set} markup={activeMarkup} />}
          </div>
          {/* build card */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4" style={{ background: "var(--ft-cream)" }}>
            {!c ? (
              <div className="rounded-lg border border-slate-300 bg-white p-5 text-sm text-slate-400">This combination isn't offered — pick an available width.</div>
            ) : (
              <div className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: "var(--ft-grid-line)" }}>
                <div className="flex items-center gap-2 px-3.5 py-2" style={{ background: "var(--ft-sand)" }}>
                  <span className="w-5 h-5 rounded text-[10px] font-extrabold text-white flex items-center justify-center" style={{ background: "var(--ft-brand-deep)" }}>H</span>
                  <span className="text-[13px] font-extrabold flex-1">{c.name}</span>
                  <span className="text-[9.5px] text-slate-500 font-semibold">{SHEET_NOTE}</span>
                </div>
                <div className="px-3.5 pt-2.5 text-[15px] font-bold leading-snug" data-sheoga-desc>{c.desc}</div>
                <div className="px-3.5 pb-2 text-[11px] text-slate-500 font-medium">↑ this description <b>is</b> the order — it snapshots onto the job line.</div>
                <div className="px-3.5 pb-3">
                  {c.rows.map(([l, a], i) => (
                    <div key={i} className="flex items-baseline gap-2 py-[3px] text-xs text-slate-500 font-medium">
                      <span className="flex-1 min-w-0">{l}</span><span className="tabular-nums font-semibold text-slate-800">{a}</span>
                    </div>
                  ))}
                  {ctn && (
                    <div className="flex items-baseline gap-2 py-[3px] text-xs text-slate-500 font-medium">
                      <span className="flex-1">Sold by full cartons — {ctn.sf} sf/carton</span>
                      <span className="tabular-nums font-semibold text-slate-800">{ctn.cartons} ctns · exact {ctn.exact.toFixed(2)}</span>
                    </div>
                  )}
                  {c.warn.map((w, i) => <div key={i} className="py-[3px] text-xs font-semibold text-amber-700">⚠ {w}</div>)}
                </div>
                <div className="flex items-center gap-4 px-3.5 py-2.5 border-t border-slate-300" style={{ background: "var(--ft-sand)" }}>
                  <div className="leading-tight"><div className="ft-eyebrow text-[8.5px]">our cost</div><div className="text-base font-extrabold tabular-nums">{fm(c.cost)}{isEa ? " ea" : "/sf"}</div></div>
                  <div className="text-xs text-slate-400">→ +{activeMarkup}% →</div>
                  <div className="leading-tight"><div className="ft-eyebrow text-[8.5px]">sell</div><div className="text-xl font-extrabold tabular-nums" style={{ color: "var(--ft-brand-deep)" }} data-sheoga-sell>{fm(sell)}{isEa ? " ea" : "/sf"}</div></div>
                  <div className="ml-auto text-right leading-tight">
                    <div className="ft-eyebrow text-[8.5px]">{isEa ? `× ${qty} pcs` : ctn ? `${ctn.cartons} ctns × ${ctn.sf} sf = ${ctn.billedSf} sf` : `× ${sf} sq ft`}{feesTot ? ` + ${fm(feesTot)} fees` : ""}</div>
                    <div className="text-base font-extrabold tabular-nums">{fmInt(jobTot)}</div>
                  </div>
                </div>
                {(c.fees || []).length > 0 && (
                  <div className="px-3.5 py-2 border-t border-dashed border-slate-300">
                    {c.fees.map((x, i) => (
                      <div key={i} className="flex items-baseline gap-2 py-[2px] text-[11px] text-slate-500 font-medium">
                        <span className="flex-1">{x.label} — imports as its own line, at cost</span><span className="tabular-nums font-semibold">{fm(x.amt)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 px-3.5 py-2.5 border-t border-slate-200">
                  <button onClick={() => setGrid(true)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"><Grid3X3 size={13} /> Full price grid</button>
                  <button onClick={add} className="ml-auto rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5" data-sheoga-add><Plus size={13} /> Add to product line{(c.fees || []).length ? "s" : ""}</button>
                </div>
              </div>
            )}
            <p className="mt-3 text-[10.5px] text-slate-400 font-medium leading-relaxed">
              Sheet prices are distributor cost · flooring effective Feb 1 2025 · vents Feb 2022 · custom orders 5–10% overrun, no returns.
            </p>
          </div>
        </div>
        {/* footer */}
        <div className="flex items-center gap-5 px-4 py-2.5 border-t border-slate-300" style={{ background: "var(--ft-cream)" }}>
          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            {ventMode ? "Vent markup" : "Markup"} <input type="number" min="0" step="5" value={activeMarkup} onChange={(e) => setActiveMarkup(Math.max(0, Number(e.target.value) || 0))}
              className="w-16 rounded-md border border-slate-300 px-2 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" data-sheoga-markup /> %
          </label>
          {sfMode && (
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              Job size <input type="number" min="1" step="50" value={sf} onChange={(e) => setSf(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 rounded-md border border-slate-300 px-2 py-1 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" data-sheoga-sf /> sq ft
            </label>
          )}
          <span className="ml-auto text-[10.5px] text-slate-400 font-medium">The description is the order — read it to Sheoga, or reconfigure from the row later.</span>
        </div>
      </div>
      {grid && <GridModal mode={mode} cfg={cfg} onClose={() => setGrid(false)} onPick={(patch) => { set({ ...cfg, ...patch }); setGrid(false); }} />}
    </div>
  );
}

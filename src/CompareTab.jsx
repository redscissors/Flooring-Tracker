// CompareTab — one room, four shower systems (phase 5, prototype P3; the
// 4-way grid is ticket 158 Phase 3).
//
// A fourth tab in EITHER vendor popup: the host popup passes its live cfg and
// its build. A 2×2 grid prices the room as wedi and Schluter on Board and on
// Membrane — the host's own cell is its live build, the other three are house
// kits (comparegrid.js) — and the two-column detail below shows the live
// build against the selected cell. The popups never import comparekit — they
// hand over a raw `hostCfg` and the neutral room is derived HERE, so wedi.js
// and schluter.js only meet inside comparekit.js (and, through it, this lazy
// chunk).
//
// LAZY-CHUNK-ONLY (ADR 0026): imports comparekit.js → both engines. Nothing on
// the boot path may import this file — the popups mount it via React.lazy.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  roomFromSchluter, roomFromWedi, wediSdryNoFit,
  mirrorParts, mirrorCandidates, pruneMirror, hostAddedLines, compareLayout,
} from "./comparekit.js";
import { CELLS, BRAND, hostCellKey, opposite, cellBuild } from "./comparegrid.js";
import { matchQty } from "./comparemirror.js";
import { groupLabel, SLOT_LABEL } from "./slots.js";
import { SwapPop } from "./swappop.jsx";
import { useEscClose, HelpTip } from "./widgets.jsx";
import { useSchluterCatalog } from "./useschlutercatalog.js";
import { useWediCatalog } from "./usewedicatalog.js";
import { mortarItemFrom } from "./schluteradapter.js";
import { lineItems as wediLineItems } from "./wedi.js";
import { lineItems as schluterLineItems } from "./schluter.js";

const fm = (n) => "$" + (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DRAIN_LBL = { point: "point drain", offset: "offset drain", linear: "linear drain" };
const LETTERS = ["A", "B", "C", "D"];
const signed = (n) => (Math.abs(n) < 0.005 ? "same" : (n > 0 ? "+" : "−") + fm(Math.abs(n)));

const CSS = `
.cmp-tab{flex:1 1 0;min-width:0;display:flex;flex-direction:column;overflow-y:auto;position:relative;
  background:var(--ft-card);color:var(--ft-text)}
.cmp-tab .cmp-head{display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--ft-border-strong);flex-wrap:wrap}
.cmp-tab .cmp-head .t{font-size:15px;font-weight:800;display:inline-flex;align-items:center;gap:6px}
.cmp-tab .cmp-head .room{font-size:11.5px;font-weight:700;color:var(--ft-muted);background:var(--ft-tint);border:1px solid var(--ft-tint-border);border-radius:6px;padding:3px 9px}
.cmp-tab .lensseg{margin-left:auto;display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.cmp-tab .lensseg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:5px 11px;cursor:pointer;line-height:1.15;text-align:left;font-family:inherit}
.cmp-tab .lensseg button + button{border-left:1px solid var(--ft-border-strong)}
.cmp-tab .lensseg button:hover:not(.on){background:var(--ft-hover)}
.cmp-tab .lensseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.cmp-tab .lensseg small{display:block;font-size:8.5px;font-weight:600;opacity:.75}
.cmp-tab .cmp-grid{display:grid;grid-template-columns:150px 1fr 1fr;border-bottom:1px solid var(--ft-border)}
.cmp-tab .cmp-grid>div{padding:7px 14px;font-size:12px;border-bottom:1px solid var(--ft-row-line)}
.cmp-tab .cmp-grid .gband{grid-column:1/-1;padding:6px 14px 4px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-faint);background:var(--ft-tint);border-bottom:1px solid var(--ft-row-line)}
.cmp-tab .cmp-grid .cat{font-size:11px;font-weight:700;color:var(--ft-muted);display:flex;align-items:center}
.cmp-tab .cmp-grid .cell .ln{display:flex;justify-content:space-between;gap:10px;padding:1px 0}
.cmp-tab .cmp-grid .cell .ln .n{min-width:0}
.cmp-tab .cmp-grid .cell .ln .n small{color:var(--ft-faint);font-size:10px;display:block;overflow:hidden;text-overflow:ellipsis}
.cmp-tab .cmp-grid .cell .ln .p{font-weight:700;font-variant-numeric:tabular-nums;flex:none}
.cmp-tab .cmp-grid .cell .ln.so .n{color:var(--s-rust,#B4552D)}
.cmp-tab .cmp-grid .cell .ln.note .n,.cmp-tab .cmp-grid .cell .ln.note .p{color:var(--ft-faint);font-style:italic;font-weight:600}
.cmp-tab .cmp-grid .cell .ln.dash .n{color:var(--ft-faint)}
.cmp-tab .cmp-grid .cell .ln .tag{font-size:8.5px;font-weight:800;color:var(--ft-brand-deep);background:var(--ft-brand-soft);border-radius:4px;padding:0 5px;margin-left:4px;vertical-align:1px;white-space:nowrap}
.cmp-tab .cmp-grid .cell .ln .acts{display:inline-flex;gap:3px;flex:none;align-self:center}
.cmp-tab .cmp-grid .cell .ln .acts button{width:20px;height:20px;border-radius:5px;border:1px solid var(--ft-border);background:var(--ft-card);color:var(--ft-muted);font-size:11px;font-weight:800;line-height:1;cursor:pointer;font-family:inherit}
.cmp-tab .cmp-grid .cell .ln .acts button:hover{border-color:var(--ft-brand);color:var(--ft-brand-deep)}
.cmp-tab .cmp-grid .cell .ln.plus .n{color:var(--ft-faint);font-style:italic;font-weight:600}
.cmp-tab .cmp-grid .cell .miss{font-size:11.5px;color:var(--ft-faint);font-weight:600;line-height:1.5}
.cmp-tab .cmp-grid .brandh{font-size:13px;font-weight:800;display:flex;align-items:center;gap:8px}
.cmp-tab .cmp-grid .brandh small{font-size:10.5px;font-weight:600;color:var(--ft-faint)}
.cmp-tab .bbadge{font-size:9.5px;font-weight:800;border-radius:4px;padding:2px 7px;text-transform:uppercase;letter-spacing:.08em}
.cmp-tab .bbadge.wedi{background:var(--ft-brand);color:#F6F3EC}
.cmp-tab .bbadge.slt{background:var(--s-rust,#B4552D);color:#F6F3EC}
.cmp-tab .cmp-tot{display:grid;grid-template-columns:150px 1fr 1fr}
.cmp-tab .cmp-tot>div{padding:9px 14px}
.cmp-tab .cmp-tot .k{font-size:10px;font-weight:800;letter-spacing:.11em;color:var(--ft-faint);text-transform:uppercase;display:flex;align-items:center}
.cmp-tab .cmp-tot .tv{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums}
.cmp-tab .cmp-tot .tv small{font-size:10.5px;font-weight:600;color:var(--ft-faint);margin-left:6px}
.cmp-tab .delta{margin:0 18px 12px;background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:9px;padding:10px 14px;font-size:12.5px;line-height:1.5;color:var(--ft-muted)}
.cmp-tab .delta b{color:var(--ft-text)}
.cmp-tab .qfoot{margin-top:auto;flex:none;border-top:1px solid var(--ft-border-strong);background:var(--ft-sand);padding:9px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cmp-tab .cbtn{border:1px solid var(--ft-border-strong);background:var(--ft-card);color:var(--ft-text);border-radius:7px;font-size:11.5px;font-weight:800;padding:7px 14px;cursor:pointer;font-family:inherit}
.cmp-tab .cbtn.primary{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff}
.cmp-tab .cbtn.primary:hover{background:var(--ft-brand-deep)}
.cmp-tab .cbtn:disabled{opacity:.45;cursor:not-allowed}
.cmp-tab .cmodal{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;padding:26px;background:rgba(20,15,10,.5)}
.cmp-tab .cmodal .box{width:100%;max-width:520px;border-radius:11px;overflow:hidden;border:1px solid var(--ft-border-strong);background:var(--ft-cream);box-shadow:0 18px 40px rgba(20,15,10,.28)}
.cmp-tab .cmodal .bh{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--ft-border-strong)}
.cmp-tab .cmodal .bh .t{font-size:13.5px;font-weight:800}
.cmp-tab .cmodal .bh .xbtn{margin-left:auto;width:26px;height:26px;border-radius:6px;border:1px solid var(--ft-border);background:var(--ft-card);color:var(--ft-muted);cursor:pointer;display:flex;align-items:center;justify-content:center}
.cmp-tab .cmodal .bb{padding:12px 14px;background:var(--ft-card)}
.cmp-tab .cmodal .orow{display:flex;align-items:baseline;gap:9px;padding:6px 0;border-bottom:1px solid var(--ft-row-line);font-size:12px;font-weight:700}
.cmp-tab .cmodal .orow .c{font-size:10px;font-weight:800;letter-spacing:.1em;color:var(--ft-faint);width:52px;flex:none}
.cmp-tab .cmodal .orow .v{margin-left:auto;font-variant-numeric:tabular-nums}
.cmp-tab .cmodal .bn{font-size:11px;color:var(--ft-muted);line-height:1.55;margin-top:9px}
.cmp-tab .cmodal .bf{display:flex;gap:8px;justify-content:flex-end;padding:10px 14px;border-top:1px solid var(--ft-border-strong);background:var(--ft-sand)}
.cmp-pick .cmp-list{max-height:300px;overflow-y:auto;margin-top:4px}
.cmp-pick .srow{display:flex;align-items:center;gap:8px;width:100%;border:none;background:none;padding:6px 8px;border-radius:6px;cursor:pointer;text-align:left;font-family:inherit}
.cmp-pick .srow:hover{background:var(--ft-tint)}
.cmp-pick .srow.on{background:var(--ft-brand-soft);box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.cmp-pick .sdot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--ft-brand)}
.cmp-pick .sdot.so{background:transparent;border:1.3px solid var(--ft-faint)}
.cmp-pick .srow .n{flex:1;min-width:0;font-size:11.5px;font-weight:700;color:var(--ft-text);line-height:1.3}
.cmp-pick .srow .n small{display:block;font-size:9.5px;color:var(--ft-faint);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-pick .more{padding:6px 8px;font-size:9.5px;color:var(--ft-faint);font-weight:600}
.cmp-pick .srow .p{font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ft-text)}
.cmp-tab .quad{display:grid;grid-template-columns:86px 1fr 1fr;gap:8px;padding:12px 18px;border-bottom:1px solid var(--ft-border-strong)}
.cmp-tab .quad .qh{display:flex;align-items:center}
.cmp-tab .quad .qrow{font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--ft-faint);display:flex;align-items:center}
.cmp-tab .tile{border:1px solid var(--ft-border);border-radius:9px;background:var(--ft-card);padding:9px 11px;cursor:pointer;min-width:0;text-align:left}
.cmp-tab .tile:hover{border-color:var(--ft-border-strong);background:var(--ft-hover)}
.cmp-tab .tile.live{box-shadow:inset 0 0 0 1.5px var(--ft-border-strong);cursor:default;background:var(--ft-tint)}
.cmp-tab .tile.sel{box-shadow:inset 0 0 0 2px var(--ft-brand)}
.cmp-tab .tile .tt{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800}
.cmp-tab .tile .tt input{margin:0;accent-color:var(--ft-brand);cursor:pointer}
.cmp-tab .tile .tt .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmp-tab .tile .tv{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:3px}
.cmp-tab .tile .dv{font-size:11px;font-weight:700;color:var(--ft-muted);font-variant-numeric:tabular-nums}
.cmp-tab .tile .tmiss{font-size:11px;color:var(--ft-faint);font-weight:600;line-height:1.45;margin-top:4px}
.cmp-tab .tile .chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;align-items:center}
.cmp-tab .tile .chip{border:1px solid var(--ft-border-strong);background:var(--ft-hover-amber);color:var(--ft-text);border-radius:5px;font-size:10px;font-weight:800;padding:2px 7px;cursor:pointer;font-family:inherit}
.cmp-tab .tile .chip:hover{border-color:var(--ft-text)}
.cmp-tab .tile .more{font-size:10px;font-weight:700;color:var(--ft-faint)}
.cmp-tab .cmp-grid .cell .ln.hl{background:var(--ft-hover-amber);border-radius:4px;transition:background .3s}
.cmp-tab .sdryask{margin:10px 18px 0;border:1px solid var(--ft-border-strong);border-radius:9px;background:var(--ft-card);padding:10px 14px;font-size:12px;line-height:1.5}
.cmp-tab .sdryask .why{font-weight:700;margin-bottom:7px}
.cmp-tab .sdryask .acts{display:flex;flex-wrap:wrap;gap:6px}
.cmp-tab .sdryask button{border:1px solid var(--ft-border-strong);background:var(--ft-card);color:var(--ft-text);border-radius:7px;font-size:11.5px;font-weight:700;padding:5px 11px;cursor:pointer;font-family:inherit}
.cmp-tab .sdryask button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.cmp-tab .cmodal .orow .fl{font-size:9.5px;font-weight:800;color:var(--ft-muted);background:var(--ft-hover-amber);border-radius:4px;padding:0 5px}
`;


// One side of a slot row: its lines (kit first, then added, then mirrored),
// and for the mirrored side the host lines that found nothing — each with a
// "+" when the brand has parts for that group at all. `cellKey` scopes the
// row keys a flag chip scrolls to.
function Cell({ cellKey, rows, plus, lens, miss, first, brand, onPick, onDrop, canAdd }) {
  if (miss) return <div className="cell" data-cmp-cell={cellKey}>{first ? <div className="miss">{miss}</div> : null}</div>;
  if (!rows.length && !plus.length) return <div className="cell" data-cmp-cell={cellKey}><div className="ln dash"><span className="n">—</span></div></div>;
  return (
    <div className="cell" data-cmp-cell={cellKey}>
      {rows.map((r, i) => {
        const amt = lens === "builder" ? r.builder : r.retail;
        return (
          <div key={i} className={"ln" + (r.noteOnly ? " note" : !r.stock ? " so" : "")} data-row-key={r.key}
            {...(r.mirror ? { "data-mirror-line": r.hostKey } : {})}>
            <span className="n">
              {r.qty > 1 ? r.qty + "× " : ""}{r.name}
              {r.added && <span className="tag" data-added-tag>{r.mirror === "matched" ? "added · matched" : "added"}</span>}
              <small>{r.sub}{r.est ? " · est." : ""}</small>
            </span>
            {r.mirror && (
              <span className="acts">
                <button type="button" title="pick another part" data-mirror-swap onClick={(ev) => onPick(r.hostKey, ev)}>⇄</button>
                <button type="button" title="drop this line from the comparison" data-mirror-drop onClick={() => onDrop(r.hostKey)}>×</button>
              </span>
            )}
            <span className="p">{amt ? fm(amt) : "—"}</span>
          </div>
        );
      })}
      {plus.map((e) => (
        <div key={e.hostKey} className="ln plus" data-mirror-plus={e.hostKey} data-row-key={e.hostKey}>
          <span className="n">
            {e.kind === "dropped" ? "Not mirrored" : canAdd(e) ? `Nothing comparable in the ${BRAND[brand]} book` : `No ${BRAND[brand]} ${SLOT_LABEL[e.slot].toLowerCase()} in the book`}
            <small>for {e.host.qty > 1 ? e.host.qty + "× " : ""}{e.host.name}</small>
          </span>
          {canAdd(e) && <span className="acts"><button type="button" title={`add a ${BRAND[brand]} part`} data-mirror-add onClick={(ev) => onPick(e.hostKey, ev)}>+</button></span>}
        </div>
      ))}
    </div>
  );
}

const CELL_AT = Object.fromEntries(CELLS.map((c, i) => [c.key, i]));

export default function CompareTab({
  host, hostCfg, hostBuild, cat, source, tier, hostMode = "custom",
  wediBuilderPct, schluterBuilderPct,
  stockRows, bookStockReady, books, loadBookItems,
  mortars, mortarDefault, areaName, onQuoteOptions,
  mirror, onMirror,
}) {
  const wediHost = host === "wedi";
  const hostBrand = wediHost ? "wedi" : "schluter";
  const hostKey = hostCellKey(hostBrand, hostCfg);

  const [lens, setLens] = useState("retail");
  const [confirm, setConfirm] = useState(null);
  const [pick, setPick] = useState(null);
  // The grid (Phase 3): the cell the detail shows beside the live build, the
  // cells checked for quote options, and the wedi Membrane cell's no-fit
  // answer. It rides the popup's Compare session under the reserved key
  // `grid` (cell keys all contain ':'), so it outlives a tab switch but not
  // the popup. It is stamped with the host cell it was made for: flip the
  // wall system off-tab and the stale grid reads as absent, so the checks
  // and the selection fall back to today's live cell and its opposite.
  const gridOf = (all) => {
    const g = ((all || {}).grid || {}).hostKey === hostKey ? all.grid : {};
    return {
      hostKey,
      selected: g.selected || opposite(hostKey),
      checked: g.checked || [hostKey, opposite(hostKey)],
      sdryPick: g.sdryPick || "wedi",
    };
  };
  const { selected, checked, sdryPick } = gridOf(mirror);
  const writeGrid = (patch) => onMirror && onMirror((all) => {
    const g = gridOf(all);
    return { ...(all || {}), grid: { ...g, ...(typeof patch === "function" ? patch(g) : patch) } };
  });
  const setSelected = (k) => writeGrid({ selected: k });
  const setSdryPick = (v) => writeGrid({ sdryPick: v });
  const [jumpTo, setJumpTo] = useState(null);
  const root = useRef(null);

  // The confirm modal is a layer of its own on the Esc ladder (ADR 0028): it
  // registers ABOVE the host popup's handler, so one press dismisses the modal
  // and the next closes the popup. Without it Esc threw away the live build.
  useEscClose(!!confirm, () => setConfirm(null));
  useEscClose(!!pick, () => setPick(null));

  const wPct = wediBuilderPct == null ? 18 : wediBuilderPct;
  const sPct = schluterBuilderPct == null ? 8 : schluterBuilderPct;

  const room = useMemo(
    () => (wediHost ? roomFromWedi(hostCfg) : roomFromSchluter(hostCfg)),
    [wediHost, hostCfg]);
  const roomOk = room.w > 0 && room.d > 0;

  // The registry bag the host hands over serves whichever engine THIS tab has
  // to assemble — the host popup already has its own. Hooks can't be
  // conditional, so both run; the one whose engine the host owns is fed nulls
  // (Schluter) or switched off (wedi) so it neither re-fetches nor, in wedi's
  // case, touches the source its host installed.
  const own = useSchluterCatalog(wediHost
    ? { stockRows, bookStockReady, books, loadBookItems }
    : { stockRows: null, bookStockReady: false, books: null, loadBookItems: null });
  const hasCatProp = !!(cat && cat.length);
  const schCat = hasCatProp ? cat : own.cat;
  const schCatReady = hasCatProp || own.catReady;

  // wedi's catalog is MODULE-LEVEL state behind an installer (see
  // usewedicatalog.js). comparekit reaches it through wedi.js's catalog(), so
  // in the Schluter popup — which never installs anything — this tab was
  // pricing the wedi column off whatever the last wedi popup happened to leave
  // behind, or off the transcribed WEDI_STOCK table if none had opened this
  // session. Those figures are not display-only: the quote-options footer
  // commits them into the project. So the tab installs the book itself and the
  // wedi column waits on it.
  const ownWedi = useWediCatalog({ bookStockReady, books, loadBookItems, enabled: !wediHost });
  const wediCatReady = wediHost || ownWedi.catReady;

  const mortarItem = useMemo(
    () => mortarItemFrom(mortarDefault || Object.keys(mortars || {})[0] || "", mortars || {}),
    [mortarDefault, mortars]);

  // Every cell prices off one shared context; a cell's own mirror state (its
  // picks and drops for the host's hand-added lines — the popup's session
  // state, keyed by cell) and the S-DRY answer only rebuild that cell.
  const ctx = useMemo(() => ({
    hostBrand, hostKey, hostBuild, hostCfg, room, roomOk,
    ready: { wedi: wediCatReady, schluter: schCatReady && schCat.length > 0 },
    cat: schCat, source, tier, mortarItem, wPct, sPct,
  }), [hostBrand, hostKey, hostBuild, hostCfg, room, roomOk, wediCatReady, schCatReady, schCat, source, tier, mortarItem, wPct, sPct]);
  const m = mirror || {};
  const wB = useMemo(() => cellBuild("wedi:board", ctx, { mirror: m["wedi:board"] }), [ctx, m["wedi:board"]]);
  const sB = useMemo(() => cellBuild("schluter:board", ctx, { mirror: m["schluter:board"] }), [ctx, m["schluter:board"]]);
  const wM = useMemo(() => cellBuild("wedi:membrane", ctx, { mirror: m["wedi:membrane"], sdryPick }), [ctx, m["wedi:membrane"], sdryPick]);
  const sM = useMemo(() => cellBuild("schluter:membrane", ctx, { mirror: m["schluter:membrane"] }), [ctx, m["schluter:membrane"]]);
  const cells = { "wedi:board": wB, "schluter:board": sB, "wedi:membrane": wM, "schluter:membrane": sM };
  const live = cells[hostKey];
  const sel = cells[selected !== hostKey && cells[selected] ? selected : opposite(hostKey)];

  const missOf = (c) => {
    if (c.rows.length) return null;
    if (!roomOk) return "Enter a room size — the compare runs off the room on screen.";
    if (c.live) return c.brand === "wedi"
      ? "Nothing built yet — pick a kit or solve a room on the other tabs."
      : "Nothing built yet — pick a tray or solve a room on the other tabs.";
    if (c.brand === "wedi") return ownWedi.bookError ? "Couldn't load the wedi price book — this column can't be priced without it."
      : !wediCatReady ? "Loading the wedi price book…"
        : "No wedi pan solves this room. Try Full catalog, or a size the pan family reaches.";
    return !schCatReady ? "Loading the Schluter price books…"
      : !schCat.length ? "No Schluter rows in the price books yet — import the stock sheet or a Schluter order book."
        : "No Schluter build for this room.";
  };
  const amt = (c) => (lens === "builder" ? c.totals.builder : c.totals.retail);

  // The detail: the live build and the selected cell, in grid order.
  const [left, right] = [live, sel].sort((a, b) => CELL_AT[a.key] - CELL_AT[b.key]);
  const plusOf = (c) => (c.plan && !missOf(c) ? c.plan.entries.filter((e) => !e.match) : []);
  const layout = useMemo(
    () => compareLayout({ L: left.rows, R: right.rows }, { L: plusOf(left), R: plusOf(right) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [left, right, roomOk, ownWedi.bookError, schCat]);

  // A chip scrolls the detail to its line once the selected cell has drawn.
  useEffect(() => {
    if (!jumpTo || !root.current) return;
    const el = [...root.current.querySelectorAll(`[data-cmp-cell="${jumpTo.cell}"] [data-row-key]`)]
      .find((e) => e.getAttribute("data-row-key") === jumpTo.rowKey);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("hl");
    const t = setTimeout(() => el.classList.remove("hl"), 1600);
    return () => clearTimeout(t);
  }, [jumpTo]);
  const pickCell = (k) => { if (k !== hostKey) setSelected(k); };
  const jump = (k, rowKey) => { pickCell(k); setJumpTo({ cell: k, rowKey, n: Date.now() }); };
  const toggle = (k) => writeGrid(({ checked: xs }) => ({ checked: xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k] }));

  // The mirror: picks and drops are per cell, each pruned to the host lines
  // that still exist.
  const hostKeys = () => hostAddedLines(hostBuild, hostBrand).map((h) => h.key);
  const writeMirror = (cell, key, v) => onMirror && onMirror((all) => ({
    ...(all || {}), [cell]: pruneMirror({ ...((all || {})[cell] || {}), [key]: v }, hostKeys()),
  }));
  const partsFor = (c, e) => mirrorParts(c.brand, e.grp, { cat: schCat, source });
  const sameAs = (mt) => (c) => c.g === mt.g && c.id === mt.id;
  // mirrorPlan resolves a hand pick against the full catalog, so under Stock
  // only it can sit outside the pooled list; its part carries it as `standing`
  // so the picker still opens on it, marked, at the top.
  const pickParts = (c, e) => {
    const parts = partsFor(c, e);
    const mt = e.match;
    if (!mt) return parts;
    const all = mirrorParts(c.brand, e.grp, { cat: schCat, source: "all" });
    const home = all.find((p) => p.parts.some(sameAs(mt)));
    const pooled = new Map(parts.map((p) => [p.key, p]));
    if (!home || (pooled.get(home.key) || { parts: [] }).parts.some(sameAs(mt))) return parts;
    return all.filter((p) => pooled.has(p.key) || p === home).map((p) => {
      const q = pooled.get(p.key) || { ...p, parts: [] };
      return p === home ? { ...q, standing: mt } : q;
    });
  };
  const listFor = (e, part) => {
    const list = mirrorCandidates(e.host, part);
    return part.standing ? [part.standing, ...list] : list;
  };
  const openPick = (cellKey, hostLine, ev) => {
    const c = cells[cellKey];
    const e = c.plan && c.plan.entries.find((x) => x.hostKey === hostLine);
    if (!e) return;
    const parts = pickParts(c, e);
    const part = (e.match && parts.find((p) => p.standing || p.parts.some(sameAs(e.match))))
      || parts.find((p) => p.parts.some((x) => x.slot === e.slot)) || parts[0];
    if (!part) return;
    const list = listFor(e, part);
    const cur = e.match && list.find(sameAs(e.match));
    const first = cur || list[0];
    const r = ev.currentTarget.getBoundingClientRect();
    setPick({
      cell: cellKey, hostKey: hostLine, part: part.key, id: first.id, qty: cur ? e.qty : matchQty(e.host.part, e.host.qty, first), q: "",
      at: { anchor: ev.currentTarget.closest(".ln"), x: r.right - 470, y: r.bottom + 6 },
    });
  };

  const bothPriced = !missOf(left) && !missOf(right);
  const diff = bothPriced ? amt(right) - amt(left) : 0;
  const cheaper = diff > 0 ? left : right;

  const sendable = CELLS.map((c) => cells[c.key]).filter((c) => checked.includes(c.key) && !missOf(c));
  const linesOf = (c) => (c.brand === "wedi"
    ? wediLineItems(c.build, { tier, builderPct: wPct })
    : schluterLineItems({ ...c.build, mode: c.live ? hostMode : "custom", cfg: c.cfg || {} }, { builderPct: sPct }));
  const openQuote = () => setConfirm(sendable.map((c) => ({ key: c.key, name: c.name, total: c.totals.retail, flags: c.flags, lines: linesOf(c) })));
  const lastLetter = (n) => LETTERS[Math.max(0, n - 1)];

  const tip = (
    <div className="space-y-1.5">
      <p><b>The grid</b> - the same room as wedi and Schluter, each on Board (wedi Building Panel or KERDI-BOARD, no
        backer) and Membrane (wedi S-DRY or KERDI, over cement board or drywall by others). Your build is the outlined
        cell; the other three are house kits for the room, carrying your added lines. Click a cell to see it line by
        line below; a chip names what didn't map cleanly and jumps to its line.</p>
      <p><b>Fit strategy</b> - wedi extends pans and cuts them (extensions + the 6″/12″ deep-cut rule). Schluter cuts
        trays only - no extension parts - so odd rooms lean on the next tray up or a mortar bed.</p>
      <p><b>Pricing model</b> - wedi publishes retail; cost is the ERP net, no markup knob. Schluter is a markup book:
        the shop stock sheet prices its rows at retail = 1.5 × cost. Builder runs off two separate knobs in Settings →
        Price book - <b>wedi builder %</b> ({wPct}% ≡ ×{((100 - wPct) / 100).toFixed(2)}) and <b>Schluter builder %</b>{" "}
        (−{sPct}%) - neither one moves the other.</p>
      {onQuoteOptions && (
        <p><b>Quote options</b> - Check two to four cells and land them on this area as options A–D - the estimate
          prints them side by side.</p>
      )}
    </div>
  );

  const tile = (c) => {
    const miss = missOf(c);
    return (
      <div key={c.key} role="button" tabIndex={c.live ? -1 : 0} data-cmp-tile={c.key}
        className={"tile" + (c.live ? " live" : "") + (c.key === sel.key ? " sel" : "")}
        onClick={() => pickCell(c.key)}
        onKeyDown={(ev) => { if (ev.target !== ev.currentTarget) return; if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pickCell(c.key); } }}>
        <div className="tt">
          {onQuoteOptions && (
            <input type="checkbox" data-cmp-check={c.key} checked={checked.includes(c.key) && !miss} disabled={!!miss}
              title="land as a quote option" onClick={(ev) => ev.stopPropagation()} onChange={() => toggle(c.key)} />
          )}
          <span className="nm">{c.label}</span>
        </div>
        {miss ? <div className="tmiss">{miss}</div> : (<>
          <div className="tv" data-cmp-total>{fm(amt(c))}</div>
          <div className="dv" data-cmp-diff>{c.live ? "Current" : missOf(live) ? "" : signed(amt(c) - amt(live)) + " vs current"}</div>
        </>)}
        {c.flags.length > 0 && (
          <div className="chips">
            {c.flags.slice(0, 2).map((f) => (
              <button key={f.id} type="button" className="chip" data-cmp-flag={f.id} title="show this line"
                onClick={(ev) => { ev.stopPropagation(); jump(c.key, f.rowKey); }}>{f.label}</button>
            ))}
            {c.flags.length > 2 && <span className="more" title={c.flags.slice(2).map((f) => f.label).join(" · ")}>+{c.flags.length - 2} more</span>}
          </div>
        )}
      </div>
    );
  };

  const head = (c) => (
    <div className="brandh" data-cmp-sys={c.brand}>
      <span className={"bbadge " + (c.brand === "wedi" ? "wedi" : "slt")}>{BRAND[c.brand]}</span> {c.label}
      <small>{c.live ? "this build" : "house kit"}</small>
    </div>
  );
  const totCell = (c) => (
    <div>
      {missOf(c) ? <span className="tv">—</span>
        : (
          <span className="tv">{fm(amt(c))}
            <small>{c.totals.stocked} of {c.totals.lines} lines stocked</small>
          </span>
        )}
    </div>
  );
  const cellFor = (c, rows, plus, first) => (
    <Cell key={c.key} cellKey={c.key} brand={c.brand} rows={rows} plus={plus} lens={lens} miss={missOf(c)} first={first}
      onPick={(k, ev) => openPick(c.key, k, ev)} onDrop={(k) => writeMirror(c.key, k, { dropped: true })}
      canAdd={(e) => partsFor(c, e).length > 0} />
  );
  const askSdry = !sel.live && sel.key === "wedi:membrane" && sel.flags.some((f) => f.id === "sdry");

  return (
    <div className="cmp-tab" ref={root}>
      <style>{CSS}</style>
      <div className="cmp-head">
        <div className="t">Compare — one room, four systems<HelpTip className="align-middle" w={340} tip={tip} /></div>
        <div className="room">
          {roomOk ? `${room.w}″ × ${room.d}″ · ${room.curbed ? "curbed" : "curbless"} · ${DRAIN_LBL[room.drain] || "point drain"}` : "no room yet"}
        </div>
        <div className="lensseg">
          <button className={lens === "retail" ? "on" : ""} onClick={() => setLens("retail")}>Retail</button>
          <button className={lens === "builder" ? "on" : ""} onClick={() => setLens("builder")}>
            Builder<small>wedi ×{((100 - wPct) / 100).toFixed(2)} · Schluter −{sPct}%</small>
          </button>
        </div>
      </div>

      <div className="quad" data-cmp-quad>
        <div />
        <div className="qh"><span className="bbadge wedi">wedi</span></div>
        <div className="qh"><span className="bbadge slt">Schluter</span></div>
        {["board", "membrane"].map((sys) => (
          <Fragment key={sys}>
            <div className="qrow">{sys === "board" ? "Board" : "Membrane"}</div>
            {tile(cells["wedi:" + sys])}
            {tile(cells["schluter:" + sys])}
          </Fragment>
        ))}
      </div>

      {askSdry && (
        <div className="sdryask" data-cmp-sdryask>
          <div className="why">No S-DRY base fits — {wediSdryNoFit(room, { source }) || "the room is outside the S-DRY range"}.</div>
          <div className="acts">
            <button className={sdryPick !== "nearest" ? "on" : ""} onClick={() => setSdryPick("wedi")} data-cmp-sdry-answer="wedi">
              Use a wedi pan + curb, with S-DRY walls</button>
            <button className={sdryPick === "nearest" ? "on" : ""} onClick={() => setSdryPick("nearest")} data-cmp-sdry-answer="nearest">
              Use the nearest S-DRY base anyway</button>
          </div>
        </div>
      )}

      <div className="cmp-grid">
        <div className="cat" />
        {head(left)}
        {head(right)}
        {layout.map((g, gi) => (
          <Fragment key={g.key}>
            <div className="gband" data-cmp-group={g.key}>{g.label}</div>
            {g.slots.map((r, ri) => (
              <Fragment key={r.slot}>
                <div className="cat" data-cmp-slot={r.slot}>{r.label}</div>
                {cellFor(left, r.L, r.LPlus, gi === 0 && ri === 0)}
                {cellFor(right, r.R, r.RPlus, gi === 0 && ri === 0)}
              </Fragment>
            ))}
          </Fragment>
        ))}
        {!layout.length && (<>
          <div className="cat" />
          {cellFor(left, [], [], true)}
          {cellFor(right, [], [], true)}
        </>)}
      </div>

      <div className="cmp-tot">
        <div className="k">Total</div>
        {totCell(left)}
        {totCell(right)}
      </div>

      {bothPriced && (
        <div className="delta">
          <b>{cheaper.name} is {fm(Math.abs(diff))} less on material</b>{" "}
          for this room at this tier.
        </div>
      )}

      {onQuoteOptions && (
        <div className="qfoot">
          <button className="cbtn primary" data-cmp-send disabled={sendable.length < 2} onClick={openQuote}>
            {sendable.length < 2 ? "Check two or more cells for quote options" : `Add ${sendable.length} as quote options`}
          </button>
        </div>
      )}

      {pick && (() => {
        const c = cells[pick.cell];
        const e = c && c.plan && c.plan.entries.find((x) => x.hostKey === pick.hostKey);
        const parts = e ? pickParts(c, e) : [];
        const part = parts.find((p) => p.key === pick.part) || parts[0];
        if (!e || !part) return null;
        const list = listFor(e, part);
        const cur = list.find((x) => x.id === pick.id) || list[0];
        const toks = pick.q.toLowerCase().split(/\s+/).filter(Boolean);
        const shown = list.filter((x) => toks.every((t) => (x.item.name + " " + x.id).toLowerCase().includes(t)));
        const qtyOf = (x) => (e.match && sameAs(e.match)(x) ? e.qty : matchQty(e.host.part, e.host.qty, x));
        const setP = (patch) => setPick((p) => (p ? { ...p, ...patch } : p));
        const partRow = parts.length > 1 ? [{ label: "Part", chips: parts.map((p) => ({
          key: p.key, label: p.label, ok: true, on: p.key === part.key,
          onPick: () => { const top = listFor(e, p)[0]; setP({ part: p.key, id: top.id, qty: qtyOf(top), q: "" }); },
        })) }] : [];
        const price = (x) => (x.brand === "wedi" ? x.item.retail : x.retail);
        return (
          <SwapPop add at={pick.at} className="cmp-pick" stockFirst={false}
            title={`${e.match ? "Swap" : "Add to"} ${c.name} · ${groupLabel(e.grp)} — for ${e.host.name}`}
            rows={partRow} qty={pick.qty} onQty={(n) => setP({ qty: n })}
            summary={{ what: (pick.qty > 1 ? pick.qty + " × " : "") + cur.item.name, why: [cur.id, cur.item.stock ? "stock" : "special order"].join(" · "),
              delta: "retail", total: fm(price(cur) * pick.qty), up: false }}
            onUse={() => { writeMirror(pick.cell, e.hostKey, { pick: { g: cur.g, id: cur.id, qty: pick.qty } }); setPick(null); }}
            onClose={() => setPick(null)}>
            {list.length > 12 && (
              <input className="w-full rounded-md border border-slate-300 px-2 py-1 mb-1 text-[12px]" autoFocus value={pick.q}
                placeholder={`Search ${part.label.toLowerCase()}…`} onChange={(ev) => setP({ q: ev.target.value })} data-add-search />
            )}
            <div className="cmp-list">
              {shown.slice(0, 60).map((x) => (
                <button key={x.g + x.id} type="button" className={"srow" + (x.id === cur.id ? " on" : "")} data-mirror-row={x.id}
                  onClick={() => setP({ id: x.id, qty: qtyOf(x) })}>
                  <span className={"sdot" + (x.item.stock ? "" : " so")} />
                  <span className="n">{x.item.name}<small>{[x.brand === "wedi" ? x.item.sizeText : x.item.size, x.id, x.item.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
                  <span className="p">{fm(price(x))}</span>
                </button>
              ))}
              {!shown.length && <div className="more">Nothing matches — clear the search</div>}
              {shown.length > 60 && <div className="more" data-mirror-more>{shown.length - 60} more — narrow the search</div>}
            </div>
          </SwapPop>
        );
      })()}

      {confirm && (
        <div className="cmodal" onClick={() => setConfirm(null)}>
          <div className="box" onClick={(e) => e.stopPropagation()}>
            <div className="bh">
              <div className="t">Land as quote options{areaName ? " — " + areaName : ""}</div>
              <button className="xbtn" onClick={() => setConfirm(null)}><X size={14} /></button>
            </div>
            <div className="bb">
              {/* The money here is each cell's own total, not a re-sum of the
                  payload rows — they agree because compareTotals and each engine's
                  lineItems both drop the noteOnly lines and both land RETAIL (ADR 0018). */}
              {confirm.map((o, i) => (
                <div className="orow" key={o.key} data-cmp-option={LETTERS[i]}>
                  <span className="c">{LETTERS[i]}</span>
                  <span>{o.name} — {o.lines.length} line{o.lines.length === 1 ? "" : "s"}</span>
                  {o.flags.map((f) => <span key={f.id} className="fl">{f.label}</span>)}
                  <span className="v">{fm(o.total)}</span>
                </div>
              ))}
              <div className="bn">
                {confirm.length} new sibling areas land beside this one, tagged options A–{lastLetter(confirm.length)}. Rows
                land <b>RETAIL</b> — the job sheet's own tier lens reprices them (ADR 0018) — and each anchor row keeps its
                configurator marker, so "reconfigure" reopens the build it came from.
              </div>
            </div>
            <div className="bf">
              <button className="cbtn" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="cbtn primary" data-compare-confirm
                onClick={() => {
                  const opts = confirm;
                  setConfirm(null);
                  onQuoteOptions({ options: opts.map((o) => ({ lines: o.lines, name: o.name })), label: areaName });
                }}>
                Add options A–{lastLetter(confirm.length)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

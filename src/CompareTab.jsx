// CompareTab — one shower, four systems (phase 5, prototype P3; four fixed
// columns + the Compare set, ticket 158 Phase 4, ADR 0052).
//
// A tab in EITHER vendor popup. Four columns, always in the same order
// (comparegrid.js CELLS): the popup's own build is Current; every other column
// is the rep's kept build for this shower when the Compare set holds one
// (Your build), else that system's house kit for the room. Open hands the
// column to its real configurator; Sync pulls the anchor's room and added
// lines into a kept build while keeping its picks. The popups never import
// comparekit — they hand over a raw `hostCfg` and the neutral room is derived
// HERE, so wedi.js and schluter.js only meet inside comparekit.js (and,
// through it, this lazy chunk).
//
// LAZY-CHUNK-ONLY (ADR 0026): imports comparekit.js → both engines. Nothing on
// the boot path may import this file — the popups mount it via React.lazy.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  roomFromSchluter, roomFromWedi, wediSdryNoFit, syncKept,
  mirrorParts, mirrorCandidates, pruneMirror, hostAddedLines, compareLayout,
} from "./comparekit.js";
import { CELLS, BRAND, hostCellKey, opposite, cellBuild, levelAmt } from "./comparegrid.js";
import { entryOf } from "./compareset.js";
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
.cmp-tab{flex:1 1 0;min-width:0;display:flex;flex-direction:column;overflow:auto;position:relative;
  background:var(--ft-card);color:var(--ft-text)}
.cmp-tab .linkbtn{border:0;background:none;color:var(--ft-muted);font:inherit;font-size:11.5px;font-weight:800;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0}
.cmp-tab .linkbtn:hover{color:var(--ft-text)}
.cmp-tab .cmp-grid{display:grid;grid-template-columns:92px repeat(4,minmax(220px,1fr));column-gap:10px;padding-right:14px;min-width:1000px}
.cmp-tab .cmp-grid>div{padding:4px 10px;font-size:11.5px;border-bottom:1px solid var(--ft-row-line);min-width:0}
.cmp-tab .cmp-grid .gband{padding:1px 12px 0 16px;font-size:8.5px;line-height:1.3;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-faint);background:var(--ft-tint);position:sticky;left:0;z-index:1}
.cmp-tab .cmp-grid .gfill{background:var(--ft-tint)}
.cmp-tab .cmp-grid .cat{padding-left:16px;font-size:10.5px;font-weight:700;color:var(--ft-muted);display:flex;align-items:center;position:sticky;left:0;background:var(--ft-card);z-index:1}
.cmp-tab .cmp-grid .corner{position:sticky;left:0;top:0;z-index:4;background:var(--ft-card);border-bottom:1px solid var(--ft-border-strong);display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;gap:4px;padding:8px 6px 7px 16px}
.cmp-tab .cmp-grid .corner .lbl{font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--ft-faint);display:inline-flex;align-items:center;gap:4px}
.cmp-tab .cmp-grid .corner .room{font-size:10px;font-weight:700;color:var(--ft-muted);line-height:1.35}
.cmp-tab .cmp-grid .cell .ln{display:flex;justify-content:space-between;gap:8px;padding:1px 0;line-height:1.25}
.cmp-tab .cmp-grid .cell .ln .n{min-width:0}
.cmp-tab .cmp-grid .cell .ln .n small{display:none}
.cmp-tab .cmp-grid .cell .ln.plus .n small{color:var(--ft-faint);font-size:10px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmp-tab .cmp-grid .cell .ln .p{font-weight:700;font-variant-numeric:tabular-nums;flex:none}
.cmp-tab .cmp-grid .cell .ln.so .n{color:var(--s-rust,#B4552D)}
.cmp-tab .cmp-grid .cell .ln.note .n,.cmp-tab .cmp-grid .cell .ln.note .p{color:var(--ft-faint);font-style:italic;font-weight:600}
.cmp-tab .cmp-grid .cell .ln.dash .n{color:var(--ft-faint)}
.cmp-tab .cmp-grid .cell .ln .tag{font-size:8.5px;font-weight:800;color:var(--ft-brand-deep);background:var(--ft-brand-soft);border-radius:4px;padding:0 5px;margin-left:4px;vertical-align:1px;white-space:nowrap}
.cmp-tab .cmp-grid .cell .ln .acts{display:inline-flex;gap:3px;flex:none;align-self:center}
.cmp-tab .cmp-grid .cell .ln .acts button{width:20px;height:20px;border-radius:5px;border:1px solid var(--ft-border);background:var(--ft-card);color:var(--ft-muted);font-size:11px;font-weight:800;line-height:1;cursor:pointer;font-family:inherit}
.cmp-tab .cmp-grid .cell .ln .acts button:hover{border-color:var(--ft-brand);color:var(--ft-brand-deep)}
.cmp-tab .cmp-grid .cell .ln.plus .n{color:var(--ft-faint);font-style:italic;font-weight:600}
.cmp-tab .cmp-grid .cell .ln.hl{background:var(--ft-hover-amber);border-radius:4px;transition:background .3s}
.cmp-tab .cmp-grid .colh{position:sticky;top:0;z-index:3;background:var(--ft-card);border-bottom:1px solid var(--ft-border-strong);padding:14px 10px 7px;display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"nm nm st" "tv dv dv" "ch ch ch" "ac ac ac";column-gap:8px;row-gap:3px;align-items:center}
.cmp-tab .colh .nm{grid-area:nm;display:flex;align-items:center;gap:7px;font-size:13.5px;font-weight:800;min-width:0}
.cmp-tab .colh .nm .sys{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-tab .colh .st{grid-area:st;display:flex;align-items:center}
.cmp-tab .colh .tv{grid-area:tv;font-size:17px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}
.cmp-tab .colh .dv{grid-area:dv;font-size:11px;font-weight:700;color:var(--ft-muted);font-variant-numeric:tabular-nums}
.cmp-tab .colh .tmiss{grid-column:1/-1;grid-row:2;font-size:11px;color:var(--ft-faint);font-weight:600;line-height:1.45}
.cmp-tab .colh .chips{grid-area:ch;display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.cmp-tab .colh .chips:empty{display:none}
.cmp-tab .colh .chip{border:1px solid var(--ft-border-strong);background:var(--ft-hover-amber);color:var(--ft-text);border-radius:5px;font-size:10px;font-weight:800;padding:2px 7px;cursor:pointer;font-family:inherit;text-align:left}
.cmp-tab .colh .chip.room{background:var(--ft-hover-amber-strong)}
.cmp-tab .colh .chip:hover{border-color:var(--ft-text)}
.cmp-tab .colh .more{font-size:10px;font-weight:700;color:var(--ft-faint)}
.cmp-tab .colh .acts{grid-area:ac;display:flex;align-items:center;gap:6px}
.cmp-tab .colh .acts .opt{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--ft-muted);cursor:pointer}
.cmp-tab .colh .acts .opt input{margin:0;accent-color:var(--ft-brand);cursor:pointer}
.cmp-tab .pill{font-size:9.5px;font-weight:800;border-radius:999px;padding:2px 8px;letter-spacing:.04em;white-space:nowrap}
.cmp-tab .pill.house{color:var(--ft-faint);border:1px solid var(--ft-border-strong)}
.cmp-tab .pill.yours{color:var(--ft-brand-deep);background:var(--ft-brand-soft)}
.cmp-tab .cmp-grid .cur{box-shadow:inset 2px 0 0 var(--ft-brand),inset -2px 0 0 var(--ft-brand)}
.cmp-tab .cmp-grid .cur.top{box-shadow:inset 2px 0 0 var(--ft-brand),inset -2px 0 0 var(--ft-brand),inset 0 2px 0 var(--ft-brand);border-radius:10px 10px 0 0}
.cmp-tab .cmp-grid .cur.bot{box-shadow:inset 2px 0 0 var(--ft-brand),inset -2px 0 0 var(--ft-brand),inset 0 -2px 0 var(--ft-brand);border-radius:0 0 10px 10px}
.cmp-tab .colh .curtab{position:absolute;top:-1px;left:10px;background:var(--ft-brand);color:#fff;font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;border-radius:0 0 5px 5px;padding:2px 8px}
.cmp-tab .bbadge{font-size:9.5px;font-weight:800;border-radius:4px;padding:2px 7px;text-transform:uppercase;letter-spacing:.08em;flex:none}
.cmp-tab .bbadge.wedi{background:var(--ft-brand);color:#F6F3EC}
.cmp-tab .bbadge.slt{background:var(--s-rust,#B4552D);color:#F6F3EC}
.cmp-tab .qfoot{margin-top:auto;flex:none;border-top:1px solid var(--ft-border-strong);background:var(--ft-sand);padding:6px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;position:sticky;bottom:0;left:0;z-index:5}
.cmp-tab .qfoot .msg{font-size:11.5px;font-weight:700;color:var(--ft-muted)}
.cmp-tab .qfoot .linkbtn{margin-left:auto}
.cmp-tab .cbtn{border:1px solid var(--ft-border-strong);background:var(--ft-card);color:var(--ft-text);border-radius:7px;font-size:11px;font-weight:800;padding:3px 9px;cursor:pointer;font-family:inherit}
.cmp-tab .cbtn:hover:not(:disabled){border-color:var(--ft-text)}
.cmp-tab .cbtn.primary{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff;padding:7px 14px}
.cmp-tab .cbtn.primary:hover:not(:disabled){background:var(--ft-brand-deep)}
.cmp-tab .cbtn:disabled{opacity:.45;cursor:not-allowed}
.cmp-tab .cmodal{position:absolute;inset:0;z-index:6;display:flex;align-items:center;justify-content:center;padding:26px;background:rgba(20,15,10,.5)}
.cmp-tab .cmodal .box{width:100%;max-width:520px;border-radius:11px;overflow:hidden;border:1px solid var(--ft-border-strong);background:var(--ft-cream);box-shadow:0 18px 40px rgba(20,15,10,.28)}
.cmp-tab .cmodal .bh{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--ft-border-strong)}
.cmp-tab .cmodal .bh .t{font-size:13.5px;font-weight:800}
.cmp-tab .cmodal .bh .xbtn{margin-left:auto;width:26px;height:26px;border-radius:6px;border:1px solid var(--ft-border);background:var(--ft-card);color:var(--ft-muted);cursor:pointer;display:flex;align-items:center;justify-content:center}
.cmp-tab .cmodal .bb{padding:12px 14px;background:var(--ft-card)}
.cmp-tab .cmodal .orow{display:flex;align-items:baseline;gap:9px;padding:6px 0;border-bottom:1px solid var(--ft-row-line);font-size:12px;font-weight:700}
.cmp-tab .cmodal .orow .c{font-size:10px;font-weight:800;letter-spacing:.1em;color:var(--ft-faint);width:52px;flex:none}
.cmp-tab .cmodal .orow .v{margin-left:auto;font-variant-numeric:tabular-nums}
.cmp-tab .cmodal .orow .fl{font-size:9.5px;font-weight:800;color:var(--ft-muted);background:var(--ft-hover-amber);border-radius:4px;padding:0 5px}
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
.cmp-tab .sdryask{margin:10px 18px 0;border:1px solid var(--ft-border-strong);border-radius:9px;background:var(--ft-card);padding:10px 14px;font-size:12px;line-height:1.5;position:sticky;left:18px;max-width:760px}
.cmp-tab .sdryask .why{font-weight:700;margin-bottom:7px}
.cmp-tab .sdryask .acts{display:flex;flex-wrap:wrap;gap:6px}
.cmp-tab .sdryask button{border:1px solid var(--ft-border-strong);background:var(--ft-card);color:var(--ft-text);border-radius:7px;font-size:11.5px;font-weight:700;padding:5px 11px;cursor:pointer;font-family:inherit}
.cmp-tab .sdryask button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
`;


// One column's lines in one slot row: kit lines first, then added, then
// mirrored; for a house kit's mirror, the host lines that found nothing — each
// with a "+" when the brand has parts for that group at all. `cellKey` scopes
// the row keys a flag chip scrolls to.
function Cell({ cellKey, rows, plus, amtOf, miss, brand, onPick, onDrop, canAdd, cls = "" }) {
  const base = "cell" + (cls ? " " + cls : "");
  if (miss) return <div className={base} data-cmp-cell={cellKey} />;
  if (!rows.length && !plus.length) return <div className={base} data-cmp-cell={cellKey}><div className="ln dash"><span className="n">—</span></div></div>;
  return (
    <div className={base} data-cmp-cell={cellKey}>
      {rows.map((r, i) => {
        const amt = amtOf(r);
        const detail = [r.sub, r.est ? "est." : ""].filter(Boolean).join(" · ");
        return (
          <div key={i} className={"ln" + (r.noteOnly ? " note" : !r.stock ? " so" : "")} data-row-key={r.key}
            {...(r.mirror ? { "data-mirror-line": r.hostKey } : {})}>
            <span className="n" title={detail || undefined}>
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

const COL = CELLS.map((c, i) => ({ ...c, col: "c" + i }));

export default function CompareTab({
  host, hostCfg, hostBuild, cat, source, tier, salePct, customPct, hostMode = "custom",
  wediBuilderPct, schluterBuilderPct,
  stockRows, bookStockReady, books, loadBookItems,
  mortars, mortarDefault, areaName, onQuoteOptions,
  mirror, onMirror,
  compareSet = null, onCompareSet, onOpenCell, savedBy = "",
}) {
  const wediHost = host === "wedi";
  const hostBrand = wediHost ? "wedi" : "schluter";
  const hostKey = hostCellKey(hostBrand, hostCfg);
  // The Apps hub has no shower to keep a set for: no Open, Sync or Clear set.
  const setOn = !!(compareSet && onCompareSet);

  const [confirm, setConfirm] = useState(null);
  const [pick, setPick] = useState(null);
  const [msg, setMsg] = useState("");
  // Session state — the cells checked for quote options, the wedi Membrane
  // house kit's no-fit answer — rides the popup's Compare session under the reserved key `grid`
  // (cell keys all contain ':'), stamped with the host cell it was made for:
  // flip the wall system off-tab and the stale grid reads as absent.
  const gridOf = (all) => {
    const g = ((all || {}).grid || {}).hostKey === hostKey ? all.grid : {};
    return {
      hostKey,
      checked: g.checked || [hostKey, opposite(hostKey)],
      sdryPick: g.sdryPick || "wedi",
    };
  };
  const { checked, sdryPick } = gridOf(mirror);
  const writeGrid = (patch) => onMirror && onMirror((all) => {
    const g = gridOf(all);
    return { ...(all || {}), grid: { ...g, ...(typeof patch === "function" ? patch(g) : patch) } };
  });
  const setSdryPick = (v) => writeGrid({ sdryPick: v });
  const [jumpTo, setJumpTo] = useState(null);
  const root = useRef(null);

  // The confirm modal is a layer of its own on the Esc ladder (ADR 0028): it
  // registers ABOVE the host popup's handler, so one press dismisses the modal
  // and the next closes the popup. Without it Esc threw away the live build.
  useEscClose(!!confirm, () => setConfirm(null));
  useEscClose(!!pick, () => setPick(null));
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3200);
    return () => clearTimeout(t);
  }, [msg]);

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

  // Every column prices off one shared context; a column's own mirror state,
  // its kept build and the S-DRY answer only rebuild that column.
  const ctx = useMemo(() => ({
    hostBrand, hostKey, hostBuild, hostCfg, room, roomOk,
    ready: { wedi: wediCatReady, schluter: schCatReady && schCat.length > 0 },
    cat: schCat, source, tier, mortarItem, wPct, sPct,
  }), [hostBrand, hostKey, hostBuild, hostCfg, room, roomOk, wediCatReady, schCatReady, schCat, source, tier, mortarItem, wPct, sPct]);
  const m = mirror || {};
  const set = compareSet || {};
  const wB = useMemo(() => cellBuild("wedi:board", ctx, { mirror: m["wedi:board"], kept: set["wedi:board"] }), [ctx, m["wedi:board"], set["wedi:board"]]);
  const wM = useMemo(() => cellBuild("wedi:membrane", ctx, { mirror: m["wedi:membrane"], sdryPick, kept: set["wedi:membrane"] }), [ctx, m["wedi:membrane"], sdryPick, set["wedi:membrane"]]);
  const sB = useMemo(() => cellBuild("schluter:board", ctx, { mirror: m["schluter:board"], kept: set["schluter:board"] }), [ctx, m["schluter:board"], set["schluter:board"]]);
  const sM = useMemo(() => cellBuild("schluter:membrane", ctx, { mirror: m["schluter:membrane"], kept: set["schluter:membrane"] }), [ctx, m["schluter:membrane"], set["schluter:membrane"]]);
  const cells = { "wedi:board": wB, "wedi:membrane": wM, "schluter:board": sB, "schluter:membrane": sM };
  const live = cells[hostKey];

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
  const amtOf = (m) => levelAmt(m, tier, { salePct, customPct });
  const amt = (c) => amtOf(c.totals);

  const plusOf = (c) => (c.plan && !missOf(c) ? c.plan.entries.filter((e) => !e.match) : []);
  const layout = useMemo(
    () => compareLayout(
      Object.fromEntries(COL.map((x) => [x.col, cells[x.key].rows])),
      Object.fromEntries(COL.map((x) => [x.col, plusOf(cells[x.key])]))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wB, wM, sB, sM, roomOk, ownWedi.bookError, schCat]);

  // A chip scrolls to its line once the column has drawn it.
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
  const jump = (k, rowKey) => {
    if (rowKey) setJumpTo({ cell: k, rowKey, n: Date.now() });
  };
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

  // --- the Compare set -------------------------------------------------------
  // Open: the column's build as a seed for its own configurator — a kept build
  // as it was kept, a house kit as shown (its mirrored lines already ride its
  // cfg.manual). The popup keeps the build you're leaving on its way out.
  const openCell = (c) => {
    if (!onOpenCell || c.live || missOf(c)) return;
    let seed;
    if (c.kept) seed = { ...c.kept.snap };
    else if (c.brand === "wedi") seed = { mode: c.build.mode || "custom", cfg: { ...c.build.cfg, source } };
    else seed = { mode: "custom", cfg: { ...c.cfg, source, pick: c.build.cand && c.build.cand.tray ? c.build.cand.tray.sku : null } };
    onOpenCell(c.key, { ...seed, tab: "compare" }, c.kept ? c.kept.target : undefined);
  };
  const syncCell = (c) => {
    if (!setOn || !c.kept) return;
    if (!roomOk) { setMsg("Enter a room size first — Sync takes the room from this build."); return; }
    const out = syncKept(c.brand, c.kept, { room, hostBuild, hostBrand, cat: schCat, tier });
    if (!out) { setMsg(`Nothing builds for this room as ${c.name} — the kept build stays as it was.`); return; }
    onCompareSet({ ...set, [c.key]: entryOf({ snap: out.snap, room, target: c.kept.target, savedBy, dropped: out.dropped }) });
    setMsg(out.dropped.length ? `${c.name} synced — ${out.dropped.length === 1 ? "one pick" : out.dropped.length + " picks"} didn't fit` : `${c.name} synced — your picks kept`);
  };
  const others = Object.keys(set).filter((k) => k !== hostKey);
  const clearAll = () => {
    if (!setOn || !others.length) return;
    if (!window.confirm("Clear every kept build for this shower? Those columns go back to house kits.")) return;
    onCompareSet(set[hostKey] ? { [hostKey]: set[hostKey] } : {});
    setMsg("Set cleared — the other columns are house kits again");
  };

  const sendable = CELLS.map((c) => cells[c.key]).filter((c) => checked.includes(c.key) && !missOf(c));
  const linesOf = (c) => (c.brand === "wedi"
    ? wediLineItems(c.build, { tier, builderPct: wPct })
    : schluterLineItems({ ...c.build, mode: c.live ? hostMode : "custom", cfg: c.cfg || {} }, { builderPct: sPct }));
  const openQuote = () => setConfirm(sendable.map((c) => ({ key: c.key, name: c.name, total: c.totals.retail, flags: c.flags, lines: linesOf(c) })));
  const lastLetter = (n) => LETTERS[Math.max(0, n - 1)];

  const tip = (
    <div className="space-y-1.5">
      <p><b>The columns</b> - the same shower as wedi Building Panel, wedi S-DRY membrane, Schluter KERDI-BOARD and
        Schluter KERDI membrane, always in that order. The outlined column is the build you're in (Current).</p>
      <p><b>Your build and house kits</b> - a system you've worked on for this shower shows as you left it (Your
        build). The rest are house kits for the room, carrying your added lines. <b>Open</b> takes a column into its
        configurator - the build you're leaving is kept. <b>Sync</b> brings a kept build up to this room and your
        added lines, keeping its own picks. Kept builds are saved with the job, per shower; Clear set drops them.</p>
      <p><b>Fit strategy</b> - wedi extends pans and cuts them (extensions + the 6″/12″ deep-cut rule). Schluter cuts
        trays only - no extension parts - so odd rooms lean on the next tray up or a mortar bed.</p>
      <p><b>Prices</b> - every figure follows the price level at the top of the popup. A gray detail line
        (part number, cut, plan) shows when you hover a part.</p>
      <p><b>Pricing model</b> - wedi publishes retail; cost is the ERP net, no markup knob. Schluter is a markup book:
        the shop stock sheet prices its rows at retail = 1.5 × cost. Builder runs off two separate knobs in Settings →
        Price book - <b>wedi builder %</b> ({wPct}% ≡ ×{((100 - wPct) / 100).toFixed(2)}) and <b>Schluter builder %</b>{" "}
        (−{sPct}%) - neither one moves the other.</p>
      {onQuoteOptions && (
        <p><b>Quote options</b> - Check two to four columns and land them on this area as options A–D, in column
          order - the estimate prints them side by side.</p>
      )}
    </div>
  );

  const roomText = roomOk
    ? `${room.w}″ × ${room.d}″ · ${room.curbed ? "curbed" : "curbless"} · ${DRAIN_LBL[room.drain] || "point drain"}`
      + (room.benches && room.benches.length ? ` · ${room.benches.length} bench${room.benches.length === 1 ? "" : "es"}` : "")
    : "no room yet";
  const showClear = setOn && others.length > 0;

  const curCls = (k, where) => (k === hostKey ? "cur" + (where ? " " + where : "") : "");

  const colHead = (c) => {
    const miss = missOf(c);
    const cur = c.live;
    return (
      <div key={c.key} className={"colh " + curCls(c.key, "top")} data-cmp-col={c.key} data-cmp-sys={c.brand}
        {...(cur ? { "data-cmp-current": "" } : {})}>
        {cur && <span className="curtab">Current</span>}
        <div className="nm">
          <span className={"bbadge " + (c.brand === "wedi" ? "wedi" : "slt")}>{BRAND[c.brand]}</span>
          <span className="sys">{c.label}</span>
        </div>
        <div className="st" data-cmp-status={c.status}>
          {c.status === "yours" && <span className="pill yours">Your build</span>}
          {c.status === "house" && <span className="pill house">House kit</span>}
        </div>
        {miss ? <div className="tmiss">{miss}</div> : (<>
          <div className="tv" data-cmp-total>{fm(amt(c))}</div>
          <div className="dv" data-cmp-diff>{cur ? "Current build" : missOf(live) ? "" : signed(amt(c) - amt(live)) + " vs current"}</div>
        </>)}
        <div className="chips">
          {c.flags.slice(0, 2).map((f) => (
            <button key={f.id} type="button" className={"chip" + (f.id === "room" ? " room" : "")} data-cmp-flag={f.id}
              title={f.id === "room" ? "Sync brings this build up to the room" : "show this line"}
              onClick={() => jump(c.key, f.rowKey)}>{f.label}</button>
          ))}
          {c.flags.length > 2 && <span className="more" title={c.flags.slice(2).map((f) => f.label).join(" · ")}>+{c.flags.length - 2} more</span>}
        </div>
        <div className="acts">
          {onOpenCell && setOn && (
            <button type="button" className="cbtn" data-cmp-open={c.key} disabled={cur || !!miss}
              title={cur ? "you're in this one" : `open this build in the ${BRAND[c.brand]} configurator`}
              onClick={() => openCell(c)}>Open</button>
          )}
          {setOn && c.status === "yours" && (
            <button type="button" className="cbtn" data-cmp-sync={c.key}
              title="bring this build up to the current room and added lines — your picks stay"
              onClick={() => syncCell(c)}>Sync</button>
          )}
          {onQuoteOptions && (
            <label className="opt" title="land as a quote option">
              <input type="checkbox" data-cmp-check={c.key} checked={checked.includes(c.key) && !miss} disabled={!!miss}
                onChange={() => toggle(c.key)} />Option
            </label>
          )}
        </div>
      </div>
    );
  };

  const cellFor = (c, rows, plus, where) => (
    <Cell key={c.key} cellKey={c.key} brand={c.brand} rows={rows} plus={plus} amtOf={amtOf} miss={missOf(c)}
      cls={curCls(c.key, where)}
      onPick={(k, ev) => openPick(c.key, k, ev)} onDrop={(k) => writeMirror(c.key, k, { dropped: true })}
      canAdd={(e) => partsFor(c, e).length > 0} />
  );
  const askSdry = wM.status === "house" && hostKey !== "wedi:membrane" && wM.flags.some((f) => f.id === "sdry");

  // The last grid row closes the Current ring.
  const rowsOut = [];
  layout.forEach((g) => {
    rowsOut.push({ k: g.key + ":band", render: (last) => (
      <Fragment key={g.key + ":band"}>
        <div className="gband" data-cmp-group={g.key}>{g.label}</div>
        {COL.map((x) => <div key={x.key} className={"gfill " + curCls(x.key, last ? "bot" : "")} />)}
      </Fragment>
    ) });
    g.slots.forEach((r) => {
      rowsOut.push({ k: g.key + ":" + r.slot, render: (last) => (
        <Fragment key={g.key + ":" + r.slot}>
          <div className="cat" data-cmp-slot={r.slot}>{r.label}</div>
          {COL.map((x) => cellFor(cells[x.key], r[x.col], r[x.col + "Plus"], last ? "bot" : ""))}
        </Fragment>
      ) });
    });
  });
  if (!rowsOut.length) rowsOut.push({ k: "empty", render: (last) => (
    <Fragment key="empty">
      <div className="cat" />
      {COL.map((x) => cellFor(cells[x.key], [], [], last ? "bot" : ""))}
    </Fragment>
  ) });

  return (
    <div className="cmp-tab" ref={root}>
      <style>{CSS}</style>
      {askSdry && (
        <div className="sdryask" data-cmp-sdryask>
          <div className="why">wedi · S-DRY membrane: no S-DRY base fits — {wediSdryNoFit(room, { source }) || "the room is outside the S-DRY range"}.</div>
          <div className="acts">
            <button className={sdryPick !== "nearest" ? "on" : ""} onClick={() => setSdryPick("wedi")} data-cmp-sdry-answer="wedi">
              Use a wedi pan + curb, with S-DRY walls</button>
            <button className={sdryPick === "nearest" ? "on" : ""} onClick={() => setSdryPick("nearest")} data-cmp-sdry-answer="nearest">
              Use the nearest S-DRY base anyway</button>
          </div>
        </div>
      )}

      <div className="cmp-grid" data-cmp-cols>
        <div className="corner">
          <span className="room" data-cmp-room>{roomText}</span>
          <span className="lbl">System<HelpTip className="align-middle" w={360} tip={tip} /></span>
        </div>
        {COL.map((x) => colHead(cells[x.key]))}
        {rowsOut.map((r, i) => r.render(i === rowsOut.length - 1))}
      </div>

      {(onQuoteOptions || msg || showClear) && (
        <div className="qfoot">
          {onQuoteOptions && (
            <button className="cbtn primary" data-cmp-send disabled={sendable.length < 2} onClick={openQuote}>
              {sendable.length < 2 ? "Check two or more columns for quote options" : `Add ${sendable.length} as quote options`}
            </button>
          )}
          {msg && <div className="msg" data-cmp-msg>{msg}</div>}
          {showClear && <button type="button" className="linkbtn" data-cmp-clear onClick={clearAll}>Clear set</button>}
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

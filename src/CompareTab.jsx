// CompareTab — one room, both shower systems (phase 5, prototype P3).
//
// A fourth tab in EITHER vendor popup: the host popup passes its live cfg and
// its build, and this tab derives the other engine's house kit for the same
// room. The popups never import comparekit — they hand over a raw `hostCfg`
// and the neutral room is derived HERE, so wedi.js and schluter.js only meet
// inside comparekit.js (and, through it, this lazy chunk).
//
// LAZY-CHUNK-ONLY (ADR 0026): imports comparekit.js → both engines. Nothing on
// the boot path may import this file — the popups mount it via React.lazy.
import { Fragment, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
  wediCompareRows, schluterCompareRows, compareTotals,
  mirrorPlan, mirrorRow, mirrorParts, mirrorCandidates, pruneMirror, hostAddedLines, compareLayout,
} from "./comparekit.js";
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
const BRAND = { wedi: "wedi", schluter: "Schluter" };

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
.cmp-pick .srow .n small{display:block;font-size:9.5px;color:var(--ft-faint);font-weight:600}
.cmp-pick .srow .p{font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ft-text)}
`;

// One side of a slot row: its lines (kit first, then added, then mirrored),
// and for the mirrored side the host lines that found nothing — each with a
// "+" when the brand has parts for that group at all.
function Cell({ rows, plus, lens, miss, first, brand, onPick, onDrop, canAdd }) {
  if (miss) return <div className="cell">{first ? <div className="miss">{miss}</div> : null}</div>;
  if (!rows.length && !plus.length) return <div className="cell"><div className="ln dash"><span className="n">—</span></div></div>;
  return (
    <div className="cell">
      {rows.map((r, i) => {
        const amt = lens === "builder" ? r.builder : r.retail;
        return (
          <div key={i} className={"ln" + (r.noteOnly ? " note" : !r.stock ? " so" : "")} {...(r.mirror ? { "data-mirror-line": r.hostKey } : {})}>
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
        <div key={e.hostKey} className="ln plus" data-mirror-plus={e.hostKey}>
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

export default function CompareTab({
  host, hostCfg, hostBuild, cat, source, tier, hostMode = "custom",
  wediBuilderPct, schluterBuilderPct,
  stockRows, bookStockReady, books, loadBookItems,
  mortars, mortarDefault, areaName, onQuoteOptions,
  mirror, onMirror,
}) {
  const [lens, setLens] = useState("retail");
  const [confirm, setConfirm] = useState(null);
  const [pick, setPick] = useState(null);

  // The confirm modal is a layer of its own on the Esc ladder (ADR 0028): it
  // registers ABOVE the host popup's handler, so one press dismisses the modal
  // and the next closes the popup. Without it Esc threw away the live build.
  useEscClose(!!confirm, () => setConfirm(null));
  useEscClose(!!pick, () => setPick(null));

  const wPct = wediBuilderPct == null ? 18 : wediBuilderPct;
  const sPct = schluterBuilderPct == null ? 8 : schluterBuilderPct;
  const wediHost = host === "wedi";

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

  // The mirror (Phase 1d): the host build's hand-added lines, each answered by
  // the other brand's nearest part or a "+". Picks and drops are the popup's
  // session state (`mirror`), so they outlive a tab switch but not the popup.
  const hostBrand = wediHost ? "wedi" : "schluter";
  const otherReady = wediHost ? schCatReady && schCat.length > 0 : wediCatReady;
  const plan = useMemo(
    () => (otherReady ? mirrorPlan(hostBuild, hostBrand, mirror, { cat: schCat, source })
      : { brand: wediHost ? "schluter" : "wedi", entries: [], manual: [] }),
    [otherReady, hostBuild, hostBrand, mirror, schCat, source, wediHost]);

  // The HOST column is whatever that popup has on screen; the other column is
  // that engine's house kit for the same room, plus the mirrored lines.
  const wediBuild = useMemo(
    () => (wediHost ? hostBuild || null : roomOk && wediCatReady ? wediBuildFor(room, { source, tier, manual: plan.manual }) : null),
    [wediHost, hostBuild, room, roomOk, wediCatReady, source, tier, plan.manual]);
  const sch = useMemo(() => {
    if (!wediHost) return { build: hostBuild || null, cfg: hostCfg || null };
    if (!roomOk || !schCatReady || !schCat.length) return { build: null, cfg: null };
    return schluterBuildFor(room, schCat, { source, mortarItem, manual: plan.manual });
  }, [wediHost, hostBuild, hostCfg, room, roomOk, schCat, schCatReady, source, mortarItem, plan.manual]);

  // The other column draws its kit lines from its build and its mirrored
  // lines from the plan, one per host line — the engine bills them summed.
  const otherPct = plan.brand === "wedi" ? wPct : sPct;
  const mirrorRows = useMemo(
    () => plan.entries.filter((e) => e.match).map((e) => mirrorRow(e, plan.brand, { builderPct: otherPct })),
    [plan, otherPct]);
  const wediRows = useMemo(() => {
    const rows = wediCompareRows(wediBuild, { builderPct: wPct });
    return wediHost || !rows.length ? rows : [...rows.filter((r) => !r.added), ...mirrorRows];
  }, [wediBuild, wPct, wediHost, mirrorRows]);
  const schRows = useMemo(() => {
    const rows = schluterCompareRows(sch.build, { builderPct: sPct });
    return !wediHost || !rows.length ? rows : [...rows.filter((r) => !r.added), ...mirrorRows];
  }, [sch.build, sPct, wediHost, mirrorRows]);
  const wTot = useMemo(() => compareTotals(wediRows), [wediRows]);
  const sTot = useMemo(() => compareTotals(schRows), [schRows]);

  const wediMiss = wediRows.length ? null
    : !roomOk ? "Enter a room size — the compare runs off the room on screen."
      : wediHost ? "Nothing built yet — pick a kit or solve a room on the other tabs."
        : ownWedi.bookError ? "Couldn't load the wedi price book — this column can't be priced without it."
          : !wediCatReady ? "Loading the wedi price book…"
            : "No wedi pan solves this room. Try Full catalog, or a size the pan family reaches.";
  const schMiss = schRows.length ? null
    : !roomOk ? "Enter a room size — the compare runs off the room on screen."
      : !wediHost ? "Nothing built yet — pick a tray or solve a room on the other tabs."
        : !schCatReady ? "Loading the Schluter price books…"
          : !schCat.length ? "No Schluter rows in the price books yet — import the stock sheet or a Schluter order book."
            : "No Schluter build for this room.";

  const bothPriced = !wediMiss && !schMiss;
  const otherMiss = plan.brand === "wedi" ? wediMiss : schMiss;
  const layout = useMemo(
    () => compareLayout({ wedi: wediRows, schluter: schRows }, otherMiss ? {} : { [plan.brand]: plan.entries.filter((e) => !e.match) }),
    [wediRows, schRows, plan, otherMiss]);

  const hostKeys = () => hostAddedLines(hostBuild, hostBrand).map((h) => h.key);
  const writeMirror = (key, v) => onMirror && onMirror((m) => pruneMirror({ ...m, [key]: v }, hostKeys()));
  const partsFor = (e) => mirrorParts(plan.brand, e.grp, { cat: schCat, source });
  const openPick = (hostKey, ev) => {
    const e = plan.entries.find((x) => x.hostKey === hostKey);
    if (!e) return;
    const parts = partsFor(e);
    const part = (e.match && parts.find((p) => p.g === e.match.g && p.parts.some((c) => c.id === e.match.id)))
      || parts.find((p) => p.parts.some((c) => c.slot === e.slot)) || parts[0];
    if (!part) return;
    const list = mirrorCandidates(e.host, part);
    const cur = e.match && list.find((c) => c.id === e.match.id);
    const first = cur || list[0];
    const r = ev.currentTarget.getBoundingClientRect();
    setPick({
      hostKey, part: part.key, id: first.id, qty: cur ? e.qty : matchQty(e.host.part, e.host.qty, first),
      at: { anchor: ev.currentTarget.closest(".ln"), x: r.right - 470, y: r.bottom + 6 },
    });
  };
  const diff = bothPriced ? (lens === "builder" ? sTot.builder - wTot.builder : sTot.retail - wTot.retail) : 0;
  const wLess = diff > 0;

  const openQuote = () => {
    const wediLines = wediBuild ? wediLineItems(wediBuild, { tier, builderPct: wPct }) : [];
    const schluterLines = sch.build
      ? schluterLineItems({ ...sch.build, mode: wediHost ? "custom" : hostMode, cfg: sch.cfg || {} }, { builderPct: sPct })
      : [];
    setConfirm({ wediLines, schluterLines });
  };

  const tip = (
    <div className="space-y-1.5">
      <p><b>Walls</b> - wedi: structural foam panel, no backer, sealant seams. Schluter: KERDI membrane over cement board
        (cheap material, more labor) or KERDI-BOARD (closest to wedi). The wall line isn't apples-to-apples: the wedi
        panel <i>is</i> the substrate, while KERDI membrane needs backer (by others) under it. Switch the Schluter build
        to KERDI-BOARD to compare like-for-like structure.</p>
      <p><b>Fit strategy</b> - wedi extends pans and cuts them (extensions + the 6″/12″ deep-cut rule). Schluter cuts
        trays only - no extension parts - so odd rooms lean on the next tray up or a mortar bed.</p>
      <p><b>Pricing model</b> - wedi publishes retail; cost is the ERP net, no markup knob. Schluter is a markup book:
        the shop stock sheet prices its rows at retail = 1.5 × cost. Builder runs off two separate knobs in Settings →
        Price book - <b>wedi builder %</b> ({wPct}% ≡ ×{((100 - wPct) / 100).toFixed(2)}) and <b>Schluter builder %</b>{" "}
        (−{sPct}%) - neither one moves the other.</p>
      {onQuoteOptions && (
        <p><b>Quote options</b> - Land both builds on this area as quote options - the estimate prints them side by side.</p>
      )}
    </div>
  );

  const totCell = (miss, t) => (
    <div>
      {miss ? <span className="tv">—</span>
        : (
          <span className="tv">{fm(lens === "builder" ? t.builder : t.retail)}
            <small>{t.stocked} of {t.lines} lines stocked</small>
          </span>
        )}
    </div>
  );

  return (
    <div className="cmp-tab">
      <style>{CSS}</style>
      <div className="cmp-head">
        <div className="t">Compare — one room, both systems<HelpTip className="align-middle" w={320} tip={tip} /></div>
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

      <div className="cmp-grid">
        <div className="cat" />
        <div className="brandh">
          <span className="bbadge wedi">wedi</span> foam pan system
          <small>{wediHost ? "this build" : "house kit"}</small>
        </div>
        <div className="brandh">
          <span className="bbadge slt">Schluter</span> KERDI system
          <small>{wediHost ? "house kit" : "this build"}</small>
        </div>
        {layout.map((g, gi) => (
          <Fragment key={g.key}>
            <div className="gband" data-cmp-group={g.key}>{g.label}</div>
            {g.slots.map((r, ri) => (
              <Fragment key={r.slot}>
                <div className="cat" data-cmp-slot={r.slot}>{r.label}</div>
                {["wedi", "schluter"].map((b) => (
                  <Cell key={b} brand={b} rows={r[b]} plus={r[b + "Plus"]} lens={lens}
                    miss={b === "wedi" ? wediMiss : schMiss} first={gi === 0 && ri === 0}
                    onPick={openPick} onDrop={(k) => writeMirror(k, { dropped: true })}
                    canAdd={(e) => partsFor(e).length > 0} />
                ))}
              </Fragment>
            ))}
          </Fragment>
        ))}
        {!layout.length && (<>
          <div className="cat" />
          <Cell brand="wedi" rows={[]} plus={[]} lens={lens} miss={wediMiss} first canAdd={() => false} />
          <Cell brand="schluter" rows={[]} plus={[]} lens={lens} miss={schMiss} first canAdd={() => false} />
        </>)}
      </div>

      <div className="cmp-tot">
        <div className="k">Total</div>
        {totCell(wediMiss, wTot)}
        {totCell(schMiss, sTot)}
      </div>

      {bothPriced && (
        <div className="delta">
          <b>{wLess ? "wedi is " + fm(Math.abs(diff)) + " less on material" : "Schluter is " + fm(Math.abs(diff)) + " less on material"}</b>{" "}
          for this room at this tier.
        </div>
      )}

      {onQuoteOptions && (
        <div className="qfoot">
          <button className="cbtn primary" disabled={!!wediMiss || !!schMiss} onClick={openQuote}>
            Quote options: wedi → A · Schluter → B
          </button>
        </div>
      )}

      {pick && (() => {
        const e = plan.entries.find((x) => x.hostKey === pick.hostKey);
        const parts = e ? partsFor(e) : [];
        const part = parts.find((p) => p.key === pick.part) || parts[0];
        if (!e || !part) return null;
        const list = mirrorCandidates(e.host, part);
        const cur = list.find((c) => c.id === pick.id) || list[0];
        const setP = (patch) => setPick((p) => (p ? { ...p, ...patch } : p));
        const partRow = parts.length > 1 ? [{ label: "Part", chips: parts.map((p) => ({
          key: p.key, label: p.label, ok: true, on: p.key === part.key,
          onPick: () => { const top = mirrorCandidates(e.host, p)[0]; setP({ part: p.key, id: top.id, qty: matchQty(e.host.part, e.host.qty, top) }); },
        })) }] : [];
        const price = (c) => (c.brand === "wedi" ? c.item.retail : c.retail);
        return (
          <SwapPop add at={pick.at} className="cmp-pick" stockFirst={false}
            title={`${e.match ? "Swap" : "Add to"} ${BRAND[plan.brand]} · ${groupLabel(e.grp)} — for ${e.host.name}`}
            rows={partRow} qty={pick.qty} onQty={(n) => setP({ qty: n })}
            summary={{ what: (pick.qty > 1 ? pick.qty + " × " : "") + cur.item.name, why: [cur.id, cur.item.stock ? "stock" : "special order"].join(" · "),
              delta: "retail", total: fm(price(cur) * pick.qty), up: false }}
            onUse={() => { writeMirror(e.hostKey, { pick: { g: cur.g, id: cur.id, qty: pick.qty } }); setPick(null); }}
            onClose={() => setPick(null)}>
            <div className="cmp-list">
              {list.slice(0, 60).map((c) => (
                <button key={c.g + c.id} type="button" className={"srow" + (c.id === cur.id ? " on" : "")} data-mirror-row={c.id}
                  onClick={() => setP({ id: c.id, qty: matchQty(e.host.part, e.host.qty, c) })}>
                  <span className={"sdot" + (c.item.stock ? "" : " so")} />
                  <span className="n">{c.item.name}<small>{[c.id, c.item.stock ? "stock" : "special order"].join(" · ")}</small></span>
                  <span className="p">{fm(price(c))}</span>
                </button>
              ))}
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
              {/* The money here is the compare grid's own total, not a re-sum of the
                  payload rows — they agree because compareTotals and each engine's
                  lineItems both drop the noteOnly lines and both land RETAIL (ADR 0018). */}
              <div className="orow">
                <span className="c">A</span><span>wedi — {confirm.wediLines.length} line{confirm.wediLines.length === 1 ? "" : "s"}</span>
                <span className="v">{fm(wTot.retail)}</span>
              </div>
              <div className="orow">
                <span className="c">B</span><span>Schluter — {confirm.schluterLines.length} line{confirm.schluterLines.length === 1 ? "" : "s"}</span>
                <span className="v">{fm(sTot.retail)}</span>
              </div>
              <div className="bn">
                Two new sibling areas land beside this one, tagged option A and B. Rows land <b>RETAIL</b> — the
                job sheet's own tier lens reprices them (ADR 0018) — and each side's anchor row keeps its
                configurator marker, so "reconfigure" reopens the build it came from.
              </div>
            </div>
            <div className="bf">
              <button className="cbtn" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="cbtn primary" data-compare-confirm
                onClick={() => {
                  const p = confirm;
                  setConfirm(null);
                  onQuoteOptions({ wediLines: p.wediLines, schluterLines: p.schluterLines, label: areaName });
                }}>
                Add options A &amp; B
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

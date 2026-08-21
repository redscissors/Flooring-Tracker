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
  COMPARE_CATS, roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
  wediCompareRows, schluterCompareRows, compareTotals,
} from "./comparekit.js";
import { useEscClose } from "./widgets.jsx";
import { useSchluterCatalog } from "./useschlutercatalog.js";
import { mortarItemFrom } from "./schluteradapter.js";
import { lineItems as wediLineItems } from "./wedi.js";
import { lineItems as schluterLineItems } from "./schluter.js";

const fm = (n) => "$" + (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DRAIN_LBL = { point: "point drain", offset: "offset drain", linear: "linear drain" };

const CSS = `
.cmp-tab{flex:1 1 0;min-width:0;display:flex;flex-direction:column;overflow-y:auto;position:relative;
  background:var(--ft-card);color:var(--ft-text)}
.cmp-tab .cmp-head{display:flex;align-items:center;gap:14px;padding:12px 18px;border-bottom:1px solid var(--ft-border-strong);flex-wrap:wrap}
.cmp-tab .cmp-head .t{font-size:15px;font-weight:800}
.cmp-tab .cmp-head .room{font-size:11.5px;font-weight:700;color:var(--ft-muted);background:var(--ft-tint);border:1px solid var(--ft-tint-border);border-radius:6px;padding:3px 9px}
.cmp-tab .lensseg{margin-left:auto;display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.cmp-tab .lensseg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:5px 11px;cursor:pointer;line-height:1.15;text-align:left;font-family:inherit}
.cmp-tab .lensseg button + button{border-left:1px solid var(--ft-border-strong)}
.cmp-tab .lensseg button:hover:not(.on){background:var(--ft-hover)}
.cmp-tab .lensseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.cmp-tab .lensseg small{display:block;font-size:8.5px;font-weight:600;opacity:.75}
.cmp-tab .cmp-grid{display:grid;grid-template-columns:150px 1fr 1fr;border-bottom:1px solid var(--ft-border)}
.cmp-tab .cmp-grid>div{padding:7px 14px;font-size:12px;border-bottom:1px solid var(--ft-row-line)}
.cmp-tab .cmp-grid .cat{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-faint);display:flex;align-items:center}
.cmp-tab .cmp-grid .cell .ln{display:flex;justify-content:space-between;gap:10px;padding:1px 0}
.cmp-tab .cmp-grid .cell .ln .n{min-width:0}
.cmp-tab .cmp-grid .cell .ln .n small{color:var(--ft-faint);font-size:10px;display:block;overflow:hidden;text-overflow:ellipsis}
.cmp-tab .cmp-grid .cell .ln .p{font-weight:700;font-variant-numeric:tabular-nums;flex:none}
.cmp-tab .cmp-grid .cell .ln.so .n{color:var(--s-rust,#B4552D)}
.cmp-tab .cmp-grid .cell .ln.note .n,.cmp-tab .cmp-grid .cell .ln.note .p{color:var(--ft-faint);font-style:italic;font-weight:600}
.cmp-tab .cmp-grid .cell .ln.dash .n{color:var(--ft-faint)}
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
.cmp-tab .diffnotes{padding:4px 18px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px}
.cmp-tab .diffnotes .dn{border:1px solid var(--ft-border);border-radius:9px;padding:10px 12px;background:var(--ft-card)}
.cmp-tab .diffnotes .dn h4{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-brand-deep);margin-bottom:4px}
.cmp-tab .diffnotes .dn p{font-size:11.5px;color:var(--ft-muted);line-height:1.5}
.cmp-tab .qfoot{margin-top:auto;flex:none;border-top:1px solid var(--ft-border-strong);background:var(--ft-sand);padding:9px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.cmp-tab .qfoot .hint{font-size:11px;color:var(--ft-muted);font-weight:600}
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
`;

function Column({ rows, lens, cat, miss, first }) {
  const ls = rows.filter((r) => r.cat === cat);
  if (miss) return <div className="cell">{first ? <div className="miss">{miss}</div> : null}</div>;
  if (!ls.length) return <div className="cell"><div className="ln dash"><span className="n">—</span></div></div>;
  return (
    <div className="cell">
      {ls.map((r, i) => {
        const amt = lens === "builder" ? r.builder : r.retail;
        return (
          <div key={i} className={"ln" + (r.noteOnly ? " note" : !r.stock ? " so" : "")}>
            <span className="n">
              {r.qty > 1 ? r.qty + "× " : ""}{r.name}
              <small>{r.sub}{r.est ? " · est." : ""}</small>
            </span>
            <span className="p">{amt ? fm(amt) : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CompareTab({
  host, hostCfg, hostBuild, cat, source, tier, hostMode = "custom",
  wediBuilderPct, schluterBuilderPct,
  stockRows, bookStockReady, books, loadBookItems,
  mortars, mortarDefault, areaName, onQuoteOptions,
}) {
  const [lens, setLens] = useState("retail");
  const [confirm, setConfirm] = useState(null);

  // The confirm modal is a layer of its own on the Esc ladder (ADR 0028): it
  // registers ABOVE the host popup's handler, so one press dismisses the modal
  // and the next closes the popup. Without it Esc threw away the live build.
  useEscClose(!!confirm, () => setConfirm(null));

  const wPct = wediBuilderPct == null ? 18 : wediBuilderPct;
  const sPct = schluterBuilderPct == null ? 8 : schluterBuilderPct;
  const wediHost = host === "wedi";

  const room = useMemo(
    () => (wediHost ? roomFromWedi(hostCfg) : roomFromSchluter(hostCfg)),
    [wediHost, hostCfg]);
  const roomOk = room.w > 0 && room.d > 0;

  // Hooks can't be conditional: this always runs. Inside the Schluter popup
  // the catalog is already assembled upstream and arrives as `cat` — the hook
  // then gets no rows and no books, and settles empty without fetching.
  const own = useSchluterCatalog({ stockRows, bookStockReady, books, loadBookItems });
  const hasCatProp = !!(cat && cat.length);
  const schCat = hasCatProp ? cat : own.cat;
  const schCatReady = hasCatProp || own.catReady;

  const mortarItem = useMemo(
    () => mortarItemFrom(mortarDefault || Object.keys(mortars || {})[0] || "", mortars || {}),
    [mortarDefault, mortars]);

  // The HOST column is whatever that popup has on screen; the other column is
  // that engine's house kit for the same room.
  const wediBuild = useMemo(
    () => (wediHost ? hostBuild || null : roomOk ? wediBuildFor(room, { source, tier }) : null),
    [wediHost, hostBuild, room, roomOk, source, tier]);
  const sch = useMemo(() => {
    if (!wediHost) return { build: hostBuild || null, cfg: hostCfg || null };
    if (!roomOk || !schCatReady || !schCat.length) return { build: null, cfg: null };
    return schluterBuildFor(room, schCat, { source, mortarItem });
  }, [wediHost, hostBuild, hostCfg, room, roomOk, schCat, schCatReady, source, mortarItem]);

  const wediRows = useMemo(() => wediCompareRows(wediBuild, { builderPct: wPct }), [wediBuild, wPct]);
  const schRows = useMemo(() => schluterCompareRows(sch.build, { builderPct: sPct }), [sch.build, sPct]);
  const wTot = useMemo(() => compareTotals(wediRows), [wediRows]);
  const sTot = useMemo(() => compareTotals(schRows), [schRows]);

  const wediMiss = wediRows.length ? null
    : !roomOk ? "Enter a room size — the compare runs off the room on screen."
      : wediHost ? "Nothing built yet — pick a kit or solve a room on the other tabs."
        : "No wedi pan solves this room. Try Full catalog, or a size the pan family reaches.";
  const schMiss = schRows.length ? null
    : !roomOk ? "Enter a room size — the compare runs off the room on screen."
      : !wediHost ? "Nothing built yet — pick a tray or solve a room on the other tabs."
        : !schCatReady ? "Loading the Schluter price books…"
          : !schCat.length ? "No Schluter rows in the price books yet — import the stock sheet or a Schluter order book."
            : "No Schluter build for this room.";

  const bothPriced = !wediMiss && !schMiss;
  const diff = bothPriced ? (lens === "builder" ? sTot.builder - wTot.builder : sTot.retail - wTot.retail) : 0;
  const wLess = diff > 0;

  const openQuote = () => {
    const wediLines = wediBuild ? wediLineItems(wediBuild, { tier, builderPct: wPct }) : [];
    const schluterLines = sch.build
      ? schluterLineItems({ ...sch.build, mode: wediHost ? "custom" : hostMode, cfg: sch.cfg || {} }, { builderPct: sPct })
      : [];
    setConfirm({ wediLines, schluterLines });
  };

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
        <div className="t">Compare — one room, both systems</div>
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
        {COMPARE_CATS.map((c, i) => (
          <Fragment key={c}>
            <div className="cat">{c}</div>
            <Column rows={wediRows} lens={lens} cat={c} miss={wediMiss} first={i === 0} />
            <Column rows={schRows} lens={lens} cat={c} miss={schMiss} first={i === 0} />
          </Fragment>
        ))}
      </div>

      <div className="cmp-tot">
        <div className="k">Total</div>
        {totCell(wediMiss, wTot)}
        {totCell(schMiss, sTot)}
      </div>

      {bothPriced && (
        <div className="delta">
          <b>{wLess ? "wedi is " + fm(Math.abs(diff)) + " less on material" : "Schluter is " + fm(Math.abs(diff)) + " less on material"}</b>{" "}
          for this room at this tier — but the wall line isn't apples-to-apples: the wedi panel <i>is</i> the
          substrate, while KERDI membrane needs backer (by others) under it. Switch the Schluter build to
          KERDI-BOARD to compare like-for-like structure.
        </div>
      )}

      <div className="diffnotes">
        <div className="dn">
          <h4>Walls</h4>
          <p>wedi: structural foam panel, no backer, sealant seams. Schluter: KERDI membrane over cement board
            (cheap material, more labor) or KERDI-BOARD (closest to wedi).</p>
        </div>
        <div className="dn">
          <h4>Fit strategy</h4>
          <p>wedi extends pans and cuts them (extensions + the 6″/12″ deep-cut rule). Schluter cuts trays only —
            no extension parts — so odd rooms lean on the next tray up or a mortar bed.</p>
        </div>
        <div className="dn">
          <h4>Pricing model</h4>
          <p>wedi publishes retail; cost is the ERP net, no markup knob. Schluter is a markup book: the shop stock
            sheet prices its rows at retail = 1.5 × cost. Builder runs off two separate knobs in Settings → Price
            book — <b>wedi builder %</b> ({wPct}% ≡ ×{((100 - wPct) / 100).toFixed(2)}) and <b>Schluter builder %</b>{" "}
            (−{sPct}%) — neither one moves the other.</p>
        </div>
      </div>

      {onQuoteOptions && (
        <div className="qfoot">
          <span className="hint">Land both builds on this area as quote options — the estimate prints them side by side.</span>
          <button className="cbtn primary" disabled={!!wediMiss || !!schMiss} onClick={openQuote}>
            Quote options: wedi → A · Schluter → B
          </button>
        </div>
      )}

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

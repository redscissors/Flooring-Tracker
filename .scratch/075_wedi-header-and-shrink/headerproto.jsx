// Custom-shower header — design prototypes (issue 075).
//
// The owner's read of the shipped header: "those buttons are a mess. Hard to
// see." Four candidate rebuilds over the SAME state, so the differences are
// layout and treatment only. Nothing here imports WediConfigurator — the base
// rules below are copied from its CSS string so a variant can be judged without
// the solver, the build column, or the drawings in the way.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";

const BASE = `
.hp{--w-rust:#B4552D;color:var(--ft-text);font-family:var(--ft-ui);line-height:normal}
.hp button{font-family:inherit}
.hp input{font-family:inherit}

/* ── as shipped today ─────────────────────────────────────────────────── */
.hp .roomform{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:9px;padding:12px 14px}
.hp .rf{display:flex;flex-direction:column;gap:4px}
.hp .rf label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ft-muted)}
.hp .rf .dims{display:flex;align-items:center;gap:6px}
.hp .rf .dims span{font-size:12px;color:var(--ft-faint);font-weight:700}
.hp .inp{border:1px solid var(--ft-border-strong);border-radius:7px;background:var(--ft-card);color:var(--ft-text);font-size:13.5px;font-weight:700;padding:7px 9px;width:74px}
.hp .seg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.hp .seg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:12px;font-weight:700;padding:8px 12px;cursor:pointer}
.hp .seg button + button{border-left:1px solid var(--ft-border-strong)}
.hp .seg button.on{background:var(--ft-text);color:var(--ft-cream)}
.hp .wbtn{border:1px solid var(--ft-border-strong);border-radius:7px;background:var(--ft-card);color:var(--ft-text);font-size:12px;font-weight:700;padding:8px 13px;cursor:pointer}

/* ── shared by every candidate ────────────────────────────────────────── */
/* A selection reads as a SELECTION, not as a black label: the app's own
   segment tokens (moss tint + ink) instead of the near-black fill, which was
   the loudest thing on the tab and made five groups look like one slab. */
.hp .n-seg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:8px;overflow:hidden;background:var(--ft-card)}
.hp .n-seg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:12.5px;font-weight:700;padding:7px 13px;cursor:pointer;white-space:nowrap}
.hp .n-seg button + button{border-left:1px solid var(--ft-border)}
.hp .n-seg button:hover:not(.on){background:var(--ft-hover);color:var(--ft-text)}
.hp .n-seg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
/* Walls is a MULTI-select — three independent toggles. Rendered as a segment
   it read as "everything is selected" in one black bar; as separate ticked
   chips it reads as three switches, which is what it is. */
.hp .n-chips{display:flex;gap:6px}
.hp .n-chip{border:1px solid var(--ft-border-strong);border-radius:8px;background:var(--ft-card);color:var(--ft-muted);font-size:12.5px;font-weight:700;padding:7px 11px;cursor:pointer;display:flex;align-items:center;gap:5px}
.hp .n-chip:hover:not(.on){background:var(--ft-hover);color:var(--ft-text)}
.hp .n-chip.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;border-color:var(--ft-brand);box-shadow:inset 0 0 0 .5px var(--ft-brand)}
.hp .n-chip .tick{font-size:11px;line-height:1;opacity:.35}
.hp .n-chip.on .tick{opacity:1}
.hp .n-lab{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ft-muted)}
.hp .n-inp{border:1px solid var(--ft-border-strong);border-radius:8px;background:var(--ft-card);color:var(--ft-text);font-size:13.5px;font-weight:700;padding:7px 9px;width:66px}
.hp .n-unit{font-size:12px;color:var(--ft-faint);font-weight:700}
.hp .n-clear{border:1px solid var(--ft-border);border-radius:7px;background:transparent;color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:5px 10px;cursor:pointer}
.hp .n-clear:hover{background:var(--ft-hover-red);color:#B4552D;border-color:#E3B9A8}
.hp .n-field{display:flex;flex-direction:column;align-items:flex-start;gap:5px}
.hp .n-row{display:flex;align-items:center;gap:6px}

/* ── A · grouped board ────────────────────────────────────────────────── */
.hp .a-board{background:var(--ft-tint);border:1px solid var(--ft-tint-border);border-radius:10px;padding:11px 13px 13px}
.hp .a-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:9px}
.hp .a-grp{background:var(--ft-card);border:1px solid var(--ft-border);border-radius:9px;padding:9px 11px 11px}
.hp .a-grp > .h{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.13em;color:var(--ft-brand-deep);padding-bottom:6px;margin-bottom:9px;border-bottom:1px solid var(--ft-border)}
.hp .a-grp .n-field + .n-field{margin-top:9px}
.hp .a-top{display:flex;align-items:baseline;gap:10px;margin-bottom:9px}
.hp .a-top .t{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.13em;color:var(--ft-muted)}
.hp .a-top .n-clear{margin-left:auto}

/* ── B · two-tier toolbar ─────────────────────────────────────────────── */
.hp .b-wrap{border:1px solid var(--ft-tint-border);border-radius:10px;overflow:hidden}
.hp .b-top{display:flex;flex-wrap:wrap;align-items:flex-end;gap:18px;background:var(--ft-card);padding:11px 14px}
.hp .b-top .n-lab{font-size:10.5px;color:var(--ft-brand-deep)}
.hp .b-top .n-seg button{font-size:13.5px;padding:9px 15px}
.hp .b-top .n-inp{font-size:15px;padding:8px 10px;width:72px}
.hp .b-bot{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;background:var(--ft-sand);border-top:1px solid var(--ft-border);padding:8px 14px}
.hp .b-bot .n-lab{font-size:9px}
.hp .b-bot .n-seg button,.hp .b-bot .n-chip{font-size:11.5px;padding:5px 10px}
.hp .b-bot .n-inp{font-size:12.5px;padding:5px 8px;width:56px}
.hp .b-bot .n-clear{margin-left:auto;align-self:center}
.hp .b-div{width:1px;align-self:stretch;background:var(--ft-border);margin:2px 0}

/* ── C · summary bar that opens ───────────────────────────────────────── */
.hp .c-bar{display:flex;align-items:center;gap:9px;background:var(--ft-card);border:1px solid var(--ft-border-strong);border-radius:10px;padding:9px 12px}
.hp .c-bar .sz{font-size:15px;font-weight:800;letter-spacing:-.01em;white-space:nowrap}
.hp .c-read{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
.hp .c-pill{font-size:11px;font-weight:700;color:var(--ft-muted);background:var(--ft-sand);border-radius:5px;padding:3px 8px;white-space:nowrap}
.hp .c-edit{margin-left:auto;border:1px solid var(--ft-brand);border-radius:8px;background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-size:12px;font-weight:800;padding:7px 13px;cursor:pointer;white-space:nowrap}
.hp .c-open{margin-top:8px}

/* ── D · spec rows, label in a left gutter ────────────────────────────── */
.hp .d-board{background:var(--ft-tint);border:1px solid var(--ft-tint-border);border-radius:10px;padding:5px 13px 11px}
.hp .d-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:0 26px}
.hp .d-row{display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid var(--ft-row-line)}
.hp .d-row:last-child{border-bottom:none}
.hp .d-row > .n-lab{flex:none;width:104px;text-align:right;line-height:1.25}
`;

const CURB = ["Curbed", "Curbless"];
const DRAIN = ["Any", "Center", "Offset", "Linear"];
const WALLS = [["back", "Back"], ["left", "Left"], ["right", "Right"]];

function useCfg() {
  const [c, set] = useState({
    w: 48, d: 66, max: false, curb: "Curbed", drain: "Any",
    dx: "", dy: "", anchor: "Left", walls: { back: true, left: true, right: true }, wallH: 96,
  });
  const p = (patch) => set((s) => ({ ...s, ...patch }));
  const toggleWall = (k) => set((s) => ({ ...s, walls: { ...s.walls, [k]: !s.walls[k] } }));
  return [c, p, toggleWall];
}

const Seg = ({ opts, value, onPick }) => (
  <div className="n-seg">
    {opts.map((o) => {
      const [v, label] = Array.isArray(o) ? o : [o, o];
      return <button key={v} className={value === v ? "on" : ""} onClick={() => onPick(v)}>{label}</button>;
    })}
  </div>
);

const WallChips = ({ walls, onToggle }) => (
  <div className="n-chips">
    {WALLS.map(([k, label]) => (
      <button key={k} className={"n-chip" + (walls[k] ? " on" : "")} onClick={() => onToggle(k)}>
        <span className="tick">{walls[k] ? "✓" : "○"}</span>{label}
      </button>
    ))}
  </div>
);

const Field = ({ label, children }) => (
  <div className="n-field"><div className="n-lab">{label}</div>{children}</div>
);

const SizeRow = ({ c, p, cls = "n-inp" }) => (
  <div className="n-row">
    <input className={cls} value={c.w} onChange={(e) => p({ w: e.target.value })} />
    <span className="n-unit">×</span>
    <input className={cls} value={c.d} onChange={(e) => p({ d: e.target.value })} />
    <span className="n-unit">in</span>
  </div>
);

const DrainRow = ({ c, p }) => (
  <div className="n-row">
    <input className="n-inp" style={{ width: 56 }} placeholder="auto" value={c.dx} onChange={(e) => p({ dx: e.target.value })} />
    <span className="n-unit">×</span>
    <input className="n-inp" style={{ width: 56 }} placeholder="auto" value={c.dy} onChange={(e) => p({ dy: e.target.value })} />
    <span className="n-unit">in</span>
  </div>
);

// ── today ────────────────────────────────────────────────────────────────
function Today() {
  const [c, p, toggleWall] = useCfg();
  return (
    <div className="roomform">
      <div className="rf"><label>Shower size — width × depth</label>
        <div className="dims">
          <input className="inp" value={c.w} onChange={(e) => p({ w: e.target.value })} />
          <span>×</span><input className="inp" value={c.d} onChange={(e) => p({ d: e.target.value })} /><span>in</span>
        </div>
      </div>
      <div className="rf"><label>Sizes are</label>
        <div className="seg">
          <button className={!c.max ? "on" : ""} onClick={() => p({ max: false })}>Pan size</button>
          <button className={c.max ? "on" : ""} onClick={() => p({ max: true })}>Max — curb inside</button>
        </div>
      </div>
      <div className="rf"><label>Curb</label>
        <div className="seg">{CURB.map((v) => <button key={v} className={c.curb === v ? "on" : ""} onClick={() => p({ curb: v })}>{v}</button>)}</div>
      </div>
      <div className="rf"><label>Drain preference</label>
        <div className="seg">{DRAIN.map((v) => <button key={v} className={c.drain === v ? "on" : ""} onClick={() => p({ drain: v })}>{v}</button>)}</div>
      </div>
      <div className="rf"><label>Drain — from left · from back</label>
        <div className="dims">
          <input className="inp" style={{ width: 58 }} placeholder="auto" value={c.dx} onChange={(e) => p({ dx: e.target.value })} />
          <span>×</span>
          <input className="inp" style={{ width: 58 }} placeholder="auto" value={c.dy} onChange={(e) => p({ dy: e.target.value })} /><span>in</span>
        </div>
      </div>
      <div className="rf"><label>Pan against</label>
        <div className="seg">{["Left", "Right"].map((v) => <button key={v} className={c.anchor === v ? "on" : ""} onClick={() => p({ anchor: v })}>{v}</button>)}</div>
      </div>
      <div className="rf"><label>Walls</label>
        <div className="seg">{WALLS.map(([k, l]) => <button key={k} className={c.walls[k] ? "on" : ""} onClick={() => toggleWall(k)}>{l}</button>)}</div>
      </div>
      <div className="rf"><label>Wall height</label>
        <div className="dims"><input className="inp" style={{ width: 58 }} value={c.wallH} onChange={(e) => p({ wallH: e.target.value })} /><span>in</span></div>
      </div>
      <div className="rf" style={{ marginLeft: "auto" }}><label>&nbsp;</label>
        <button className="wbtn">Clear design</button>
      </div>
    </div>
  );
}

// ── A · grouped board ────────────────────────────────────────────────────
function VarA() {
  const [c, p, toggleWall] = useCfg();
  return (
    <div className="a-board">
      <div className="a-top"><span className="t">The shower</span><button className="n-clear">Clear design</button></div>
      <div className="a-grid">
        <div className="a-grp">
          <div className="h">Size &amp; curb</div>
          <Field label="Width × depth"><SizeRow c={c} p={p} /></Field>
          <Field label="Sizes are">
            <Seg opts={[[false, "Pan size"], [true, "Max — curb inside"]]} value={c.max} onPick={(v) => p({ max: v })} />
          </Field>
          <Field label="Curb"><Seg opts={CURB} value={c.curb} onPick={(v) => p({ curb: v })} /></Field>
        </div>
        <div className="a-grp">
          <div className="h">Drain</div>
          <Field label="Preference"><Seg opts={DRAIN} value={c.drain} onPick={(v) => p({ drain: v })} /></Field>
          <Field label="From left × from back"><DrainRow c={c} p={p} /></Field>
          <Field label="Pan against"><Seg opts={["Left", "Right"]} value={c.anchor} onPick={(v) => p({ anchor: v })} /></Field>
        </div>
        <div className="a-grp">
          <div className="h">Walls</div>
          <Field label="Which walls get wedi"><WallChips walls={c.walls} onToggle={toggleWall} /></Field>
          <Field label="Wall height">
            <div className="n-row"><input className="n-inp" style={{ width: 60 }} value={c.wallH} onChange={(e) => p({ wallH: e.target.value })} /><span className="n-unit">in</span></div>
          </Field>
        </div>
      </div>
    </div>
  );
}

// ── B · two-tier toolbar ─────────────────────────────────────────────────
function VarB() {
  const [c, p, toggleWall] = useCfg();
  return (
    <div className="b-wrap">
      <div className="b-top">
        <Field label="Shower size"><SizeRow c={c} p={p} /></Field>
        <div className="b-div" />
        <Field label="Curb"><Seg opts={CURB} value={c.curb} onPick={(v) => p({ curb: v })} /></Field>
        <div className="b-div" />
        <Field label="Drain"><Seg opts={DRAIN} value={c.drain} onPick={(v) => p({ drain: v })} /></Field>
      </div>
      <div className="b-bot">
        <Field label="Sizes are"><Seg opts={[[false, "Pan size"], [true, "Max — curb inside"]]} value={c.max} onPick={(v) => p({ max: v })} /></Field>
        <Field label="Drain at"><DrainRow c={c} p={p} /></Field>
        <Field label="Pan against"><Seg opts={["Left", "Right"]} value={c.anchor} onPick={(v) => p({ anchor: v })} /></Field>
        <Field label="Walls"><WallChips walls={c.walls} onToggle={toggleWall} /></Field>
        <Field label="Height">
          <div className="n-row"><input className="n-inp" value={c.wallH} onChange={(e) => p({ wallH: e.target.value })} /><span className="n-unit">in</span></div>
        </Field>
        <button className="n-clear">Clear design</button>
      </div>
    </div>
  );
}

// ── C · summary bar that opens ───────────────────────────────────────────
function VarC({ startOpen = false }) {
  const [c, p, toggleWall] = useCfg();
  const [open, setOpen] = useState(startOpen);
  const wallList = WALLS.filter(([k]) => c.walls[k]).map(([, l]) => l);
  const pills = [
    c.max ? "Max — curb inside" : "Pan size",
    c.curb,
    c.drain === "Any" ? "Any drain" : c.drain + " drain",
    c.dx || c.dy ? `Drain ${c.dx || "auto"} × ${c.dy || "auto"}` : null,
    `Pan ${c.anchor.toLowerCase()}`,
    wallList.length ? `${wallList.join(" · ")} @ ${c.wallH}″` : "No walls",
  ].filter(Boolean);
  return (
    <div>
      <div className="c-bar">
        <span className="sz">{c.w}″ × {c.d}″</span>
        <div className="c-read">{pills.map((t) => <span key={t} className="c-pill">{t}</span>)}</div>
        <button className="c-edit" onClick={() => setOpen((o) => !o)}>{open ? "Done" : "Edit shower"}</button>
      </div>
      {open && <div className="c-open"><VarA /></div>}
    </div>
  );
}

// ── D · spec rows ────────────────────────────────────────────────────────
function VarD() {
  const [c, p, toggleWall] = useCfg();
  return (
    <div className="d-board">
      <div className="d-cols">
        <div>
          <div className="d-row"><span className="n-lab">Shower size</span><SizeRow c={c} p={p} /></div>
          <div className="d-row"><span className="n-lab">Sizes are</span><Seg opts={[[false, "Pan size"], [true, "Max — curb inside"]]} value={c.max} onPick={(v) => p({ max: v })} /></div>
          <div className="d-row"><span className="n-lab">Curb</span><Seg opts={CURB} value={c.curb} onPick={(v) => p({ curb: v })} /></div>
          <div className="d-row"><span className="n-lab">Pan against</span><Seg opts={["Left", "Right"]} value={c.anchor} onPick={(v) => p({ anchor: v })} /></div>
        </div>
        <div>
          <div className="d-row"><span className="n-lab">Drain</span><Seg opts={DRAIN} value={c.drain} onPick={(v) => p({ drain: v })} /></div>
          <div className="d-row"><span className="n-lab">Drain at</span><DrainRow c={c} p={p} /></div>
          <div className="d-row"><span className="n-lab">Walls</span><WallChips walls={c.walls} onToggle={toggleWall} /></div>
          <div className="d-row"><span className="n-lab">Wall height</span>
            <div className="n-row"><input className="n-inp" style={{ width: 60 }} value={c.wallH} onChange={(e) => p({ wallH: e.target.value })} /><span className="n-unit">in</span></div>
            <button className="n-clear" style={{ marginLeft: "auto" }}>Clear design</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const PANELS = [
  ["today", "Today", "As shipped — nine groups in one wrapping row; five near-black slabs; “Left | Right” butted against “Back | Left | Right”.", Today],
  ["a", "A · Grouped board", "Three named groups — Size & curb / Drain / Walls. Wraps 3 → 2 → 1 columns, so the order on screen never changes. Selection is moss, not black; Walls become tick chips because they are a multi-select.", VarA],
  ["b", "B · Two-tier toolbar", "What gets touched on every shower is big and on top (size, curb, drain); the fine-tuning sits in a quiet band underneath. Half the vertical height of A.", VarB],
  ["c", "C · Summary that opens", "Collapsed to one readable line of the current shower; Edit opens board A. Gives the option cards and the drawings back ~150px.", VarC],
  ["d", "D · Spec rows", "Labels in a fixed left gutter, one control per row, two columns. Nothing wraps mid-group and the labels line up as a column you can scan.", VarD],
];

function App() {
  const [only, setOnly] = useState(new URLSearchParams(location.search).get("v") || "");
  const shown = only ? PANELS.filter((p) => p[0] === only) : PANELS;
  return (
    <div className="hp" style={{ background: "var(--ft-cream)", minHeight: "100vh", padding: "18px 20px 60px" }}>
      {!only && (
        <div style={{ marginBottom: 16 }}>
          <div className="ft-eyebrow" style={{ fontSize: 10 }}>Issue 075 · prototype</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.01em" }}>Custom shower header — four candidates</div>
        </div>
      )}
      {shown.map(([key, title, note, C]) => (
        <div key={key} data-panel={key} style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--ft-muted)", maxWidth: 900, lineHeight: 1.5, marginBottom: 9 }}>{note}</div>
          <C startOpen={false} />
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<><style>{BASE}</style><App /></>);

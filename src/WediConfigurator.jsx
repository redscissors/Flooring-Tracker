// wedi shower-system configurator popup (issue 066) — the React port of
// .scratch/066_wedi-configurator/prototype.html (owner-approved 2026-07-29,
// screenshots P1–P11). Three surfaces — Kits / Custom room / Browse — over one
// shared build column and a permanent drawings rail. Every price and every
// piece of geometry comes from src/wedi.js; this file is presentation only.
//
// wedi is not Sheoga: every piece has a part number and wedi publishes retail,
// so there is no markup knob — sell is book retail, cost is distributor net,
// and Builder is the one wedi rule (retail × 0.82, tunable as wediBuilderPct).
// "Add to product lines" hands lineItems() payloads back to the caller; the
// anchor row keeps the raw configuration (product.wedi) so Reconfigure reopens
// here pre-filled.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Printer, Copy, Eye } from "lucide-react";
import { useEscClose, SourceSwitch } from "./widgets.jsx";
import { TIER_COLOR } from "./uiconst.js";
import {
  catalog, item, group, pans, curbs, kitFor, solve, figureConsumables, panelPlan,
  expandWallFaces, WALL_THICK, curbWidth, curbInsets, applyCurbInset, openCorners, curbRuns, CORNER_CUT, BROWSE_SECTIONS, sectionHit,
  tierPrice, lineItems, coverFrames, inch, round2, TIERS, SKU, MODULE_DEPTH, MODEXT_DEPTH,
  FINISHES, GROUP_LABEL, BUILDER_MULT, SO_MIN_NET,
  normBench, benchPremades, benchPanRoom, benchPanPlan, smallerPanFor,
  BENCH_CORNER_LBL,
} from "./wedi.js";
import { TopDown, Iso, railSplit, RAIL_DESIGN_W, curbHeight } from "./showerdraw.jsx";

const fm = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fm0 = (n) => "$" + Math.round(+n).toLocaleString("en-US");
const clampPct = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; };

// Three columns — solver, build, drawings — that only work side by side, so the
// popup is DRAWN at one width and scaled to whatever frame it is given, rather
// than reflowing. Between the floor and the cap the layout is pixel-identical
// at every window size and only the scale changes (owner 2026-08-02: "as it
// gets narrower, everything gets smaller, including the text size"), which is
// also why nothing truncates differently from one width to the next.
//
// 1420 is the width the three columns are comfortable at, not the width they
// merely fit in — drawn at 1120 they fit but sit spread out on a big monitor,
// which is the other half of the same ask (that half is mostly the spacing
// pass; at a 1680 window the scale is barely off 1). The floor caps how small
// the type is allowed to get — 11.5px body text lands at 7.6px there — and
// below it the popup scrolls the last few pixels rather than shrinking on.
const WEDI_DESIGN_W = 1420;
const WEDI_ZOOM_FLOOR = 0.66;

const RAIL_PAD_X = 24, RAIL_PAD_Y = 24;
const RAIL_MIN_W = 240;

// Tile thickness comes off a tape measure, not a calculator, so "3/8", "1/4"
// and "1 1/16" parse alongside 0.375 — and the box shows what it read back, so
// a mistyped fraction is visible before it moves the curb.
const parseIn = (v) => {
  const s = String(v == null ? "" : v).trim().replace(/["\u2033]/g, "");
  const m = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(s);
  const n = m ? (+m[1] || 0) + (+m[3] ? +m[2] / +m[3] : 0) : +s;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : 0;
};

// Kits list (issue 075). Sizes lead in FEET because that is how a shower gets
// asked for; the inches follow for the tape measure.
const ftIn = (n) => {
  const f = Math.floor(n / 12), i = Math.round(n % 12);
  return i ? `${f}′${i}″` : `${f}′`;
};
// Smallest side, then the longest — so every 3-footer sits together and a
// 4-footer is never buried between them. No pan stores w > d, so leading with
// the smaller number never misstates an offset drain's position.
const panOrder = (a, b) => (a.group === "module"
  ? (a.len || 0) - (b.len || 0)
  : (a.w - b.w) || (a.d - b.d));
// What most of a family agrees on. A "usual" needs at least two pans agreeing,
// or every Neo module — each named for its own length — reads as an exception.
const majority = (list, get) => {
  const c = {};
  list.forEach((p) => { const k = get(p); c[k] = (c[k] || 0) + 1; });
  const [top] = Object.entries(c).sort((a, b) => b[1] - a[1]);
  return top && top[1] > 1 ? top[0] : null;
};
// A row earns a tag only where it breaks its family's pattern. "CENTER DRAIN"
// on 16 of 18 cards taught nobody anything and hid the two that were offset.
// (The old name-mismatch tag went with the size-led catalog names — every
// pan's name now differs by size alone, which is what the card already says.)
const panTag = (p, usualDrain) => {
  if (/corner/i.test(p.name)) return "Corner";           // its name already says Corner
  const drain = p.group === "module" ? "module" : p.drain?.type || "";
  if (usualDrain && drain && drain !== usualDrain) return drain[0].toUpperCase() + drain.slice(1);
  return "";
};

// The prototype's stylesheet, scoped to the popup and re-based on the theme's
// --ft-* tokens so it themes (and darkens) with the rest of the app. Two
// values are the configurator's own: the rust that marks a CUT (amber already
// means price drift everywhere else) and the paper the technical drawings sit
// on, which stays light in both themes exactly like the print sheet.
const CSS = `
.wedi-pop{--w-rust:#B4552D;--w-paper:#FBFAF5;--w-stock:color-mix(in oklab, var(--ft-brand) 11%, var(--ft-card));
  --w-hint-bg:#FBF3E4;--w-hint-line:#E5C07B;--w-hint-ink:#7A5B1F;
  color:var(--ft-text);font-family:var(--ft-ui);line-height:normal}
.wedi-pop button{font-family:inherit}
.wedi-pop input{font-family:inherit}
.wedi-pop .pop-head{display:flex;align-items:center;gap:14px;padding:12px 16px 0;background:var(--ft-cream)}
.wedi-pop .eyebrow{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:var(--ft-brand-deep)}
.wedi-pop .name{font-size:18px;font-weight:800;letter-spacing:-.01em}
.wedi-pop .name small{font-weight:600;color:var(--ft-muted);font-size:12px;margin-left:6px}
.wedi-pop .xbtn{width:30px;height:30px;border-radius:6px;border:1px solid var(--ft-border);background:var(--ft-card);color:var(--ft-muted);font-size:15px;font-weight:700;cursor:pointer;flex:none;display:flex;align-items:center;justify-content:center}
.wedi-pop .pop-head .rclear{margin-left:auto;font-size:11px;padding:5px 10px}
.wedi-pop .pop-head .rclear + .tierbar{margin-left:0}
.wedi-pop .pop-head .srcseg + .tierbar{margin-left:0}
.wedi-pop .srcseg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.wedi-pop .srcseg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:6px 11px;cursor:pointer}
.wedi-pop .srcseg button + button{border-left:1px solid var(--ft-border-strong)}
.wedi-pop .srcseg button:hover:not(.on){background:var(--ft-hover)}
.wedi-pop .srcseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.wedi-pop .pancard.dis{opacity:.38;cursor:not-allowed}
.wedi-pop .tierbar{margin-left:auto;display:flex;align-items:stretch;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.wedi-pop .tierbar button{border:none;background:none;color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:6px 11px;cursor:pointer;line-height:1.1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.wedi-pop .tierbar button:not(.on):hover{background:var(--ft-hover)}
.wedi-pop .tierbar button.on{font-weight:800;box-shadow:inset 0 2px 4px rgba(0,0,0,.28)}
.wedi-pop .tierbar button + button{border-left:1px solid var(--ft-border-strong)}
.wedi-pop .tierbar small{display:block;font-size:8.5px;font-weight:600;opacity:.75}
.wedi-pop .tierbar input{width:34px;border:none;background:transparent;font-size:11.5px;font-weight:700;text-align:center;color:inherit}
.wedi-pop .tierbar input:focus{outline:none}
.wedi-pop .modetabs{display:flex;gap:2px;padding:10px 16px 0;border-bottom:1px solid var(--ft-border-strong);background:var(--ft-cream)}
.wedi-pop .modetab{border:1px solid var(--ft-border);border-bottom:none;background:var(--ft-sand);color:var(--ft-muted);font-size:12.5px;font-weight:700;padding:8px 16px;border-radius:7px 7px 0 0;cursor:pointer}
.wedi-pop .modetab small{font-weight:600;color:var(--ft-faint);margin-left:5px;font-size:10.5px}
.wedi-pop .modetab.on{background:var(--ft-card);color:var(--ft-text);border-color:var(--ft-border-strong);position:relative}
.wedi-pop .modetab.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--ft-card)}
.wedi-pop .pop-body{flex:1;display:flex;min-height:0;min-width:1120px;background:var(--ft-card)}
/* One rule for all three tabs (owner 2026-08-02): the columns hold an equal
   share, so nothing moves when you switch surfaces. .buildcol was written
   0 0 392px, which was never what rendered — a loaded kit floors it at ~567px
   on its own content and took the 175px out of .main, so the columns jumped
   the moment you clicked a pan. Equal basis makes that shift 12px at 1680. */
.wedi-pop .main{flex:1 1 0;min-width:0;overflow-y:auto;background:var(--ft-card);padding:9px 11px 14px}

/* The Kits list (issue 075). It was a 120px card per pan carrying the product
   name, a drain chip and "full kit" — three captions that repeat on nearly
   every card in a family and buried the two pans that actually differ. It is
   now one 21px row: size, an exception tag when there is one, price. The whole
   catalogue reads in ~815px instead of ~1540px, and the explanatory note box
   above the first family is gone entirely (owner 2026-08-02). */
.wedi-pop .fam{margin-bottom:9px}
.wedi-pop .fam-h{display:flex;align-items:baseline;gap:9px;margin-bottom:2px}
.wedi-pop .fam-h .t{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ft-brand-deep)}
.wedi-pop .cards{display:flex;flex-direction:column}
.wedi-pop .pancard{display:flex;align-items:center;gap:10px;padding:1px 5px;border:0;border-bottom:1px solid var(--ft-row-line);background:none;cursor:pointer;text-align:left;color:inherit}
.wedi-pop .pancard:hover{background:var(--ft-hover)}
.wedi-pop .pancard.on{background:var(--ft-tint);box-shadow:inset 2px 0 0 var(--ft-brand)}
.wedi-pop .pancard .sz{font-size:10px;font-weight:600;color:var(--ft-faint);line-height:1.5;white-space:nowrap}
.wedi-pop .pancard .sz b{font-size:12px;font-weight:800;color:var(--ft-text);margin-right:4px}
.wedi-pop .pancard .nm{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--w-rust);line-height:1.5;white-space:nowrap}
.wedi-pop .pancard .pr{font-size:11.5px;font-weight:800;margin-left:auto;line-height:1.5;font-variant-numeric:tabular-nums}
/* a flex item, not absolutely positioned — outside the row box the pane clips it */
.wedi-pop .pancard .dot{flex:none;width:5px;height:5px;border-radius:50%;background:var(--ft-brand)}

/* The custom-shower header (issue 075, candidate A1). It was nine fields
   wrapping in one row, in an order that changed with every width; it is now
   three named groups in an auto-fit grid (3 → 2 → 1 columns).
   Two treatment rules travel with it, and they are the reason the old one read
   as "a mess":
   · A selection reads as a SELECTION. .seg button.on is a near-black fill —
     five of them across one bar read as five headings, not five answers. The
     header's own .rseg uses --ft-seg-on-bg, the same moss the rest of the
     app's segmented controls use. (.seg/.inp still dress the Browse tab.)
   · Walls is a MULTI-select. Drawn as a segment, three toggles merged into one
     unbroken bar when all three were on; as ticked chips it read as three
     switches, which is what it is. The chips are gone as of 2026-08-03 — the
     wall editor moved into this group off the build column and each row's name
     button is that same switch, now with the length, height and sf beside it —
     but .rchip stays: it is the one dressing in here for a multi-select. */
.wedi-pop .roomform{background:var(--ft-tint);border:1px solid var(--ft-tint-border);border-radius:10px;padding:5px;margin-bottom:10px}
/* Flex, not a grid of equal tracks (2026-08-03): three equal columns left the
   Walls group alone on a second row with a dead cell beside it, and equal
   tracks starved Size & curb — the one group with four fields — into stacking
   them while Drain sat half empty. Walls now spans the row it starts, and the
   two field groups split what's left in proportion to what they hold. */
.wedi-pop .rfgrid{display:flex;flex-wrap:wrap;gap:5px}
.wedi-pop .rfgrp{flex:1 1 232px;min-width:0;background:var(--ft-card);border:1px solid var(--ft-border);border-radius:8px;padding:4px 7px 5px}
.wedi-pop .rfgrp.wide{flex-grow:1.35}
.wedi-pop .rfgrp.span{flex-basis:100%}
.wedi-pop .rfgrp > .h{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.13em;color:var(--ft-brand-deep);margin-bottom:3px}
.wedi-pop .rfflow{display:flex;flex-wrap:wrap;gap:5px 9px}
.wedi-pop .rf{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.wedi-pop .rf.dim{opacity:.45}
.wedi-pop .rf label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ft-muted)}
.wedi-pop .rf .dims{display:flex;align-items:center;gap:5px}
.wedi-pop .rf .dims span{font-size:12px;color:var(--ft-faint);font-weight:700}
.wedi-pop .rinp{border:1px solid var(--ft-border-strong);border-radius:7px;background:var(--ft-card);color:var(--ft-text);font-size:12.5px;font-weight:700;padding:3px 5px;width:46px}
.wedi-pop .rinp.tin{width:62px}
.wedi-pop .rinp:disabled{cursor:not-allowed}
.wedi-pop .rinp:focus{outline:2px solid var(--ft-brand);outline-offset:1px;border-color:transparent}
.wedi-pop .rseg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.wedi-pop .rseg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:3px 8px;cursor:pointer;white-space:nowrap}
.wedi-pop .rseg button + button{border-left:1px solid var(--ft-border)}
.wedi-pop .rseg button:hover:not(.on){background:var(--ft-hover);color:var(--ft-text)}
.wedi-pop .rseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.wedi-pop .rchips{display:flex;flex-wrap:wrap;gap:4px}
.wedi-pop .rchip{border:1px solid var(--ft-border-strong);border-radius:7px;background:var(--ft-card);color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:3px 6px;cursor:pointer;display:flex;align-items:center;gap:3px}
.wedi-pop .rchip:hover:not(.on){background:var(--ft-hover);color:var(--ft-text)}
.wedi-pop .rchip.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;border-color:var(--ft-brand);box-shadow:inset 0 0 0 .5px var(--ft-brand)}
.wedi-pop .rchip .tick{font-size:10px;line-height:1;opacity:.35}
.wedi-pop .rchip.on .tick{opacity:1}
.wedi-pop .rfgrp > .rowh{display:flex;align-items:center;gap:8px;margin-bottom:1px}
/* The wall editor, moved here out of the build column (owner 2026-08-03) —
   the rows describe the ROOM, so they belong beside the size, the curb and the
   drain, and the build column is left listing what the room costs. They flow
   like the option cards do: as many per line as the group is wide enough for,
   so three walls and a pair of returns read as a block instead of a stack. */
.wedi-pop .rfgrp .wallrows{display:flex;flex-wrap:wrap;gap:0 14px}
.wedi-pop .rfgrp .wallrows .wallrow{flex:1 1 190px;min-width:0}
.wedi-pop .rfgrp .wallctl{margin-left:auto;display:flex;align-items:center;gap:4px;text-transform:none;letter-spacing:0}
.wedi-pop .wdefh{display:flex;align-items:center;gap:5px;margin-left:auto;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ft-muted)}
.wedi-pop .wtgl:disabled,.wedi-pop .addchip:disabled{opacity:.4;cursor:not-allowed}
.wedi-pop .rclear{margin-left:auto;border:1px solid var(--ft-border);border-radius:6px;background:transparent;color:var(--ft-muted);font-size:10px;font-weight:700;letter-spacing:normal;text-transform:none;padding:2px 7px;cursor:pointer;white-space:nowrap}
.wedi-pop .rclear:hover{background:var(--ft-hover-red);color:var(--w-rust);border-color:#E3B9A8}
.wedi-pop .inp{border:1px solid var(--ft-border-strong);border-radius:7px;background:var(--ft-card);color:var(--ft-text);font-size:13.5px;font-weight:700;padding:7px 9px;width:74px}
.wedi-pop .inp:focus{outline:2px solid var(--ft-brand);outline-offset:1px;border-color:transparent}
.wedi-pop .seg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.wedi-pop .seg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:12px;font-weight:700;padding:8px 12px;cursor:pointer}
.wedi-pop .seg button + button{border-left:1px solid var(--ft-border)}
.wedi-pop .seg button:hover:not(.on){background:var(--ft-hover);color:var(--ft-text)}
.wedi-pop .seg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
/* The solved option cards. They were a single 240px-per-card row that scrolled
   SIDEWAYS, so past the second card the rest of the answer was off screen with
   nothing saying so — on the one tab whose whole job is comparing the options
   (owner 2026-08-03). They now flow: as many per row as the pane is wide
   enough for, wrapping down into the pane's own vertical scroll. */
.wedi-pop .optrow{display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:9px;margin-bottom:14px}
.wedi-pop .optcard{min-width:0;border:1px solid var(--ft-border-strong);border-radius:9px;background:var(--ft-card);padding:10px 12px;cursor:pointer;text-align:left;color:inherit}
.wedi-pop .optcard:hover{border-color:var(--ft-brand)}
.wedi-pop .optcard.on{outline:2px solid var(--ft-brand);outline-offset:-1px;background:var(--ft-tint)}
.wedi-pop .optcard .bdg{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.wedi-pop .badge{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;background:var(--ft-sand);color:var(--ft-muted);border-radius:4px;padding:2px 6px}
.wedi-pop .badge.hot{background:var(--ft-brand);color:#fff}
.wedi-pop .optcard .t{font-size:12px;font-weight:800;line-height:1.3;min-height:31px}
.wedi-pop .optcard .p{font-size:14px;font-weight:800;margin-top:5px;font-variant-numeric:tabular-nums}
.wedi-pop .optcard .p small{font-size:10px;color:var(--ft-faint);font-weight:600;margin-left:4px}
.wedi-pop .optcard .wrn{font-size:9.5px;color:var(--w-rust);font-weight:600;margin-top:3px;min-height:13px}
.wedi-pop .optcard .thumb{margin-top:7px;background:var(--ft-tint);border-radius:6px;padding:4px;display:flex;justify-content:center}
.wedi-pop .warnlist{margin-top:12px}
.wedi-pop .warnrow{display:flex;gap:8px;font-size:12px;color:var(--ft-muted);padding:5px 0;border-top:1px solid var(--ft-row-line);line-height:1.45}
.wedi-pop .warnrow.bad{color:var(--w-rust);font-weight:600}
.wedi-pop .warnrow .ic{flex:none;font-weight:800}
.wedi-pop .nores{font-size:12.5px;color:var(--ft-faint);padding:16px 4px;line-height:1.6}

.wedi-pop .browsebar{display:flex;gap:8px;margin-bottom:10px}
.wedi-pop .browsebar .inp{flex:1;width:auto}
.wedi-pop .gchips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
.wedi-pop .seccols{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}
.wedi-pop .seccols .ft-hopt{flex:0 0 auto;width:100%;cursor:pointer}
.wedi-pop .seccols small{margin-left:auto;font-weight:600;opacity:.55;padding-left:10px;font-size:9.5px}
.wedi-pop .quickstack{display:flex;flex-direction:column;gap:6px;min-width:104px}
.wedi-pop .gchip{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:20px;padding:4px 11px;font-size:11px;font-weight:700;color:var(--ft-muted);cursor:pointer}
.wedi-pop .gchip.on{background:var(--ft-seg-on-bg);border-color:var(--ft-brand);color:var(--ft-brand-deep);box-shadow:inset 0 0 0 .5px var(--ft-brand)}
.wedi-pop .gchip small{font-weight:600;opacity:.65;margin-left:3px}
.wedi-pop .figcard{background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:9px;padding:11px 13px;margin-bottom:12px}
.wedi-pop .figcard .fh{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ft-brand-deep);margin-bottom:6px}
.wedi-pop .figcard .fr{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:12.5px;color:var(--ft-muted);font-weight:600}
.wedi-pop .figcard .fr b{color:var(--ft-text)}
.wedi-pop .figcard .inp{width:80px;padding:5px 8px;font-size:12.5px}
.wedi-pop .figfoot{font-size:10px;color:var(--ft-faint);font-weight:600;margin-top:5px}
/* Two stacked lines: the description owns the full column width, the SKU,
   price and quantity sit under it. On one line the name got whatever the fixed
   tracks left over — about 170px once the columns went equal. */
.wedi-pop .brow{display:flex;flex-direction:column;gap:1px;padding:5px 8px 6px;border-top:1px solid var(--ft-row-line)}
.wedi-pop .brow:last-child{border-bottom:1px solid var(--ft-row-line)}
.wedi-pop .brow.stk,.wedi-pop .srow.stk{background:var(--w-stock)}
.wedi-pop .sdot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--ft-brand)}
.wedi-pop .sdot.so{background:transparent;border:1.4px solid var(--ft-faint)}
.wedi-pop .brow .bn{display:flex;align-items:center;gap:8px;min-width:0}
.wedi-pop .brow .bn .n{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wedi-pop .brow .bmeta{display:flex;align-items:center;gap:8px;padding-left:15px}
.wedi-pop .brow .bmeta .s{flex:1;min-width:0;font-size:10.5px;color:var(--ft-faint);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wedi-pop .brow .sku{flex:none;font-size:10.5px;color:var(--ft-muted);font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
.wedi-pop .brow .pr{flex:none;width:74px;text-align:right;font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums}
.wedi-pop .brow .pr small{display:block;font-size:9px;color:var(--ft-faint);font-weight:600}
.wedi-pop .stepper{flex:none;display:inline-flex;align-items:center;border:1px solid var(--ft-border-strong);border-radius:6px;overflow:hidden}
.wedi-pop .stepper button{border:none;background:var(--ft-card);width:24px;height:24px;font-size:13px;font-weight:800;color:var(--ft-muted);cursor:pointer;line-height:1}
.wedi-pop .stepper .q{width:28px;text-align:center;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
.wedi-pop .stepper .q.zero{color:var(--ft-faint);font-weight:600}
.wedi-pop .more{font-size:11px;color:var(--ft-faint);padding:8px 4px}

.wedi-pop .diagcol{flex:1 1 0;min-width:0;border-left:1px solid var(--ft-border-strong);background:var(--ft-tint);overflow-y:auto;scrollbar-gutter:stable;padding:10px 12px 14px;order:3}
.wedi-pop .diagcol .dc-h{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-muted);margin:4px 0}
.wedi-pop .diagcol .dc-h:first-child{margin-top:0}
.wedi-pop .diagcol svg{display:block;width:100%;height:auto;background:var(--w-paper);border:1px solid var(--ft-border);border-radius:8px}
.wedi-pop .diagcol svg + svg{margin-top:10px}
.wedi-pop .diagcol .dc-empty{font-size:11.5px;color:var(--ft-faint);line-height:1.6;padding:18px 4px}
.wedi-pop .diagcol .dc-hint{background:var(--w-hint-bg);border:1px solid var(--w-hint-line);border-radius:6px;color:var(--w-hint-ink);font-size:10.5px;font-weight:700;padding:6px 9px;margin-bottom:6px}
.wedi-pop .xdel{cursor:pointer;color:var(--w-rust);font-weight:800;padding:0 2px}
.wedi-pop svg .wband{cursor:context-menu}
.wedi-pop svg .wband:hover{opacity:.82}

.wedi-pop .buildcol{flex:1 1 0;border-left:1px solid var(--ft-border-strong);background:var(--ft-cream);display:flex;flex-direction:column;min-height:0;order:2}
.wedi-pop .bc-scroll{flex:1;overflow-y:auto;padding:10px 13px 6px}
.wedi-pop .bc-h{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.wedi-pop .bc-h .t{font-size:14px;font-weight:800}
.wedi-pop .bc-h .sub{font-size:10.5px;color:var(--ft-faint);font-weight:600;margin-left:auto;text-align:right}
.wedi-pop .bc-empty{font-size:12px;color:var(--ft-faint);line-height:1.6;padding:22px 6px}
.wedi-pop .bgroup{margin-top:8px}
.wedi-pop .bg-h{display:flex;align-items:center;gap:7px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-muted);padding-bottom:4px;border-bottom:1px solid var(--ft-border-strong)}
.wedi-pop .bg-h .wallctl{margin-left:auto;display:flex;align-items:center;gap:4px;text-transform:none;letter-spacing:0}
.wedi-pop .wtgl{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:4px;font-size:9px;font-weight:800;color:var(--ft-faint);width:20px;height:17px;cursor:pointer;line-height:1}
.wedi-pop .wtgl.on{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff}
.wedi-pop .wallrow{display:flex;align-items:center;gap:5px;padding:2px 0;border-bottom:1px dashed var(--ft-row-line);font-size:10px;color:var(--ft-faint);font-weight:600}
.wedi-pop .wname{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:5px;font-size:9.5px;font-weight:800;color:var(--ft-faint);padding:2px 0;cursor:pointer;width:44px;text-align:center;flex:none}
.wedi-pop .wname.on{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff}
.wedi-pop .win{width:40px;flex:none;border:1px solid var(--ft-border-strong);border-radius:4px;font-size:10.5px;font-weight:700;text-align:center;padding:2px;background:var(--ft-card);color:var(--ft-text)}
.wedi-pop .win:disabled{opacity:.35}
.wedi-pop .wallrow .wu{margin-left:auto;font-variant-numeric:tabular-nums;white-space:nowrap}
.wedi-pop .pfseg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:5px;overflow:hidden}
.wedi-pop .pfseg button{border:none;background:var(--ft-card);color:var(--ft-faint);font-size:9px;font-weight:800;padding:2px 7px;cursor:pointer}
.wedi-pop .pfseg button + button{border-left:1px solid var(--ft-border-strong)}
.wedi-pop .pfseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.wedi-pop .fsw{display:inline-block;width:11px;height:11px;border-radius:50%;border:1px solid var(--ft-border-strong);vertical-align:-1.5px;margin-right:5px;flex:none}
.wedi-pop .bline{display:flex;align-items:center;gap:7px;padding:3px 0;border-bottom:1px solid var(--ft-row-line)}
.wedi-pop .bline .bn{flex:1;min-width:0}
.wedi-pop .bline .bn .n{font-size:11.5px;font-weight:700;line-height:1.25;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.wedi-pop .bline .bn .m{font-size:9.5px;color:var(--ft-faint);font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wedi-pop .bline .bn .m b{color:var(--ft-muted);font-weight:700}
.wedi-pop .bline .lp{flex:none;text-align:right;font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;width:62px}
.wedi-pop .bline .lp small{display:block;font-size:9px;color:var(--ft-faint);font-weight:600}
.wedi-pop .bline .stepper button{width:20px;height:20px;font-size:12px}
.wedi-pop .bline .stepper .q{width:24px;font-size:11px}
.wedi-pop .bline .stepper .q.ov{color:var(--w-rust)}
.wedi-pop .swapb{flex:none;border:1px solid var(--ft-border);background:var(--ft-card);border-radius:5px;width:20px;height:20px;font-size:11px;color:var(--ft-muted);cursor:pointer;line-height:1}
.wedi-pop .swapb:hover{border-color:var(--ft-brand);color:var(--ft-brand-deep)}
.wedi-pop .starb{flex:none;border:1px solid var(--ft-border);background:var(--ft-card);border-radius:5px;width:22px;height:22px;font-size:12px;color:var(--ft-faint);cursor:pointer;line-height:1;padding:0}
.wedi-pop .starb.on{color:#C9A050;border-color:#C9A050}
.wedi-pop .addchips{display:flex;flex-wrap:wrap;gap:5px;padding:5px 0 2px}
.wedi-pop .addchip{border:1px dashed var(--ft-border-strong);background:var(--ft-card);border-radius:20px;padding:3px 10px;font-size:10.5px;font-weight:700;color:var(--ft-muted);cursor:pointer}
.wedi-pop .addchip.on{border-style:solid;background:var(--ft-brand-soft);border-color:var(--ft-brand);color:var(--ft-brand-deep)}
.wedi-pop .whint{display:flex;gap:8px;align-items:center;background:var(--w-hint-bg);border:1px solid var(--w-hint-line);border-radius:7px;padding:7px 10px;font-size:11px;color:var(--w-hint-ink);font-weight:600;margin-top:10px;line-height:1.4}
.wedi-pop .whint button{border:1px solid #C9A050;background:#fff;border-radius:5px;font-size:10.5px;font-weight:800;color:var(--w-hint-ink);padding:3px 8px;cursor:pointer;flex:none;margin-left:auto}
.wedi-pop .bc-foot{flex:none;border-top:1px solid var(--ft-border-strong);background:var(--ft-sand);padding:8px 13px 9px}
.wedi-pop .totrow{display:flex;align-items:baseline;gap:12px}
.wedi-pop .totrow .k{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-muted)}
.wedi-pop .totrow .v{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
.wedi-pop .totrow .sell{margin-left:auto;text-align:right}
.wedi-pop .totrow .sell .v{font-size:19px}
.wedi-pop .marginrow{font-size:10.5px;color:var(--ft-muted);font-weight:600;margin-top:2px;display:flex;align-items:center;gap:4px;width:100%;background:none;border:0;padding:0;font-family:inherit;text-align:left;cursor:pointer}
.wedi-pop .marginrow:hover{color:var(--ft-text)}
.wedi-pop .marginrow span{margin-left:auto}
.wedi-pop .btnrow{display:flex;gap:7px;margin-top:9px}
.wedi-pop .wbtn{flex:1;border:1px solid var(--ft-border-strong);background:var(--ft-card);color:var(--ft-text);border-radius:7px;font-size:11.5px;font-weight:800;padding:7px 6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}
.wedi-pop .wbtn.primary{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff}
.wedi-pop .wbtn.primary:hover{background:var(--ft-brand-deep)}
.wedi-pop .wbtn:disabled{opacity:.45;cursor:not-allowed}

.wedi-swap{position:fixed;z-index:90;background:var(--ft-card);color:var(--ft-text);border:1px solid var(--ft-border-strong);border-radius:9px;box-shadow:0 18px 50px rgba(0,0,0,.3);width:300px;max-height:340px;overflow-y:auto;padding:6px;font-family:var(--ft-ui)}
.wedi-swap .ph{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-muted);padding:6px 8px 4px}
.wedi-swap .srow{display:flex;align-items:center;gap:8px;width:100%;border:none;background:none;padding:6px 8px;border-radius:6px;cursor:pointer;text-align:left}
.wedi-swap .srow:hover{background:var(--ft-tint)}
.wedi-swap .srow.on{background:var(--ft-brand-soft)}
.wedi-swap .srow.stk{background:color-mix(in oklab, var(--ft-brand) 11%, var(--ft-card))}
.wedi-swap .sdot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--ft-brand)}
.wedi-swap .sdot.so{background:transparent;border:1.3px solid var(--ft-faint)}
.wedi-swap .fsw{display:inline-block;width:11px;height:11px;border-radius:50%;border:1px solid var(--ft-border-strong);vertical-align:-1.5px;margin-right:5px}
.wedi-swap .n{flex:1;min-width:0;font-size:11.5px;font-weight:700;color:var(--ft-text);line-height:1.3}
.wedi-swap .n small{display:block;font-size:9.5px;color:var(--ft-faint);font-weight:600}
.wedi-swap .p{font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ft-text)}

.wedi-wallmenu{width:256px;padding:9px 10px}
.wedi-wallmenu .wm-row{display:flex;align-items:center;gap:6px;padding:4px 2px;font-size:10.5px;color:var(--ft-faint);font-weight:600}
.wedi-wallmenu .wm-row label{width:38px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ft-muted)}
.wedi-wallmenu .win{width:46px;border:1px solid var(--ft-border-strong);border-radius:4px;font-size:11px;font-weight:700;text-align:center;padding:3px;background:var(--ft-card);color:var(--ft-text)}
.wedi-wallmenu .pfseg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:5px;overflow:hidden}
.wedi-wallmenu .pfseg button{border:none;background:var(--ft-card);color:var(--ft-faint);font-size:9px;font-weight:800;padding:3px 7px;cursor:pointer}
.wedi-wallmenu .pfseg button + button{border-left:1px solid var(--ft-border-strong)}
.wedi-wallmenu .pfseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.wedi-wallmenu .wm-del{border:1px solid var(--ft-border);background:var(--ft-card);border-radius:5px;font-size:10px;font-weight:800;color:#B4552D;padding:3px 8px;cursor:pointer}
.wedi-wallmenu .wm-act{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:5px;font-size:10px;font-weight:800;color:var(--ft-text);padding:3px 8px;cursor:pointer}
.wedi-wallmenu .wm-act:hover{border-color:var(--ft-brand)}
.wedi-wallmenu .wm-note{font-size:9px;color:var(--ft-faint);font-weight:600;padding:3px 2px 0;line-height:1.4}
.wedi-benchmenu{width:300px}
.wedi-benchmenu .bm-opt{display:block;width:100%;text-align:left;border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:7px;padding:7px 9px;cursor:pointer;margin:4px 0;color:var(--ft-text)}
.wedi-benchmenu .bm-opt:hover{border-color:var(--ft-brand)}
.wedi-benchmenu .bm-opt b{display:block;font-size:11px;font-weight:800}
.wedi-benchmenu .bm-opt small{display:block;font-size:9px;color:var(--ft-faint);font-weight:600;line-height:1.35;margin-top:1px}

.wedi-pop .ptable{width:100%;border-collapse:collapse;font-size:11.5px}
.wedi-pop .ptable th{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ft-muted);text-align:left;padding:4px 8px;border-bottom:1px solid var(--ft-border-strong)}
.wedi-pop .ptable td{padding:5px 8px;border-bottom:1px solid var(--ft-row-line);vertical-align:top}
.wedi-pop .ptable .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
.wedi-pop .ptable .mono{font-weight:700;white-space:nowrap}
.wedi-pop .ptable .mark{font-size:9.5px;font-weight:700;color:var(--ft-brand-deep);background:var(--ft-brand-soft);border-radius:4px;padding:1px 6px;white-space:nowrap}
.wedi-pop .ptable .mark.part{color:var(--ft-faint);background:var(--ft-sand)}
.wedi-pop .mnote{font-size:11px;color:var(--ft-muted);line-height:1.55;margin-top:10px}
.wedi-pop .mnote b{color:var(--ft-text)}
.wedi-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--ft-text);color:var(--ft-cream);border:1px solid var(--ft-border-strong);font-size:12.5px;font-weight:700;border-radius:8px;padding:10px 18px;z-index:95;box-shadow:0 12px 40px rgba(0,0,0,.4);font-family:var(--ft-ui)}
`;

// The layout sheet's own stylesheet. It only exists in the DOM while a print is
// in flight (the sheet is portalled in, printed, and unmounted), so hiding
// every other body child is scoped to that instant.
const PRINT_CSS = `
.wedi-printsheet{display:none}
@media print{
  body > *:not(.wedi-printsheet){display:none !important}
  .wedi-printsheet{display:block;color:#111;background:#fff;font-family:var(--ft-ui)}
  .wedi-printsheet .ps-head{display:flex;align-items:baseline;gap:12px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:14px}
  .wedi-printsheet .ps-head .t{font-size:20px;font-weight:800}
  .wedi-printsheet .ps-head .sub{font-size:12px;color:#333;font-weight:700}
  .wedi-printsheet .ps-head .dt{margin-left:auto;font-size:11px;color:#555}
  .wedi-printsheet .ps-diags{display:flex;gap:18px;align-items:flex-start;margin-bottom:6px}
  .wedi-printsheet .ps-diags .d{flex:1}
  .wedi-printsheet .ps-diags svg{width:100%;height:auto;border:1px solid #ddd;border-radius:6px;background:#fff}
  .wedi-printsheet .ps-sec{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:#555;margin:14px 0 4px}
  .wedi-printsheet .ps-warn{font-size:11px;color:#333;padding:2px 0}
  .wedi-printsheet .ps-table{width:100%;border-collapse:collapse;font-size:11px}
  .wedi-printsheet .ps-table th{text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#555;border-bottom:1.5px solid #111;padding:3px 6px}
  .wedi-printsheet .ps-table td{border-bottom:1px solid #ddd;padding:4px 6px;vertical-align:top}
  .wedi-printsheet .ps-table .num{text-align:right;font-variant-numeric:tabular-nums}
  .wedi-printsheet .ps-tot{display:flex;justify-content:flex-end;gap:26px;font-size:12px;font-weight:800;margin-top:8px}
}
`;

const TIER_SUB = { retail: "book price", employee: "cost × 1.06" };

// Drain-cover finishes as swatches — the codes are too hard to tell apart as
// text (owner feedback 6); the spelled-out name rides beside them (feedback 17).
const FIN_SWATCH = {
  SS: "#C6CBCE", SSP: "#C6CBCE", C: "#DEE4EA", CSL: "#DEE4EA", CP: "#DEE4EA",
  B: "#C9A15C", BP: "#C9A15C", G: "#E0B63E", ORB: "#4A362A", MB: "#26231F",
  CHA: "#DCC49B", WHT: "#F4F2EC",
};
const isCover = (e) => !!e && (e.group === "cover" || e.group === "coverFrame");
// A cover's NAME carries its size and finish word (owner 2026-08-06), so the
// meta lines add only the SKU — finName feeds them for cover FRAMES alone,
// whose vendor names still read by code.
const finName = (e) => (!!e && e.group === "coverFrame" && e.finish ? FINISHES[e.finish] || e.finish : "");
function FinDot({ e }) {
  if (!isCover(e) || !e.finish) return null;
  const c = FIN_SWATCH[e.finish];
  return <span className="fsw" title={FINISHES[e.finish] || e.finish}
    style={{ background: c || "repeating-linear-gradient(45deg,#FFF 0 2px,#CBC4B0 2px 4px)" }} />;
}

// Display-only (owner ask 2026-07-30): the popup drops the "wedi" branding
// from names — everything in here is wedi — and Browse rows lead with the
// size, stripping it out of names that embed it (either dimension order).
// A size-led catalog name (curbs, panels, bases, niches — owner 2026-08-06)
// already IS the lead, so those rows show the name and the fuller size text
// moves to the sub line. Payloads and the order-entry copy keep the vendor's
// full wording.
const unwedi = (s) => (s || "").replace(/\bwedi\b\s*®?\s*/gi, "")
  .replace(/\s{2,}/g, " ").replace(/^[\s—–-]+/, "").trim();
const sizePat = (sz) => sz.trim().split("").map((c) =>
  /\s/.test(c) ? "\\s*" : /[x×]/i.test(c) ? "\\s*[x×]\\s*" : /["″”]/.test(c) ? '["″”]?'
    : c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("");
const stripSize = (name, sz) => {
  if (!sz) return name;
  const pats = [sizePat(sz)];
  const two = /^(.+?")\s*[x×]\s*(.+?")$/.exec(sz.trim());
  if (two) pats.push(sizePat(two[2] + " x " + two[1]));
  let out = name;
  pats.forEach((p) => { try { out = out.replace(new RegExp(p, "i"), " "); } catch (x) { } });
  return out;
};
const browseName = (e) => unwedi(stripSize(e.name, e.sizeText))
  .replace(/\s{2,}/g, " ").replace(/[\s—–-]+$/, "").trim() || unwedi(e.name);
const sizeLed = (e) => /^\d/.test(e.name);
const browseSub = (e) => [finName(e), sizeLed(e) ? e.sizeText : "", GROUP_LABEL[e.group] || e.group, e.stock ? "stock" : "special order"]
  .filter(Boolean).join(" · ");

const BUCKETS = [["floor", "Floor"], ["walls", "Walls"], ["bench", "Bench"], ["drain", "Drain & finish"], ["install", "Install"], ["addon", "Add-ons"]];
const BUCKET_OF = {
  pan: "floor", module: "floor", modExt: "floor", extension: "floor", cornerExt: "floor", ramp: "floor",
  curb: "floor", kit: "floor", panel: "walls", cover: "drain", coverFrame: "drain", drainKit: "drain",
  recess: "install", fastener: "install", sealant: "install", tool: "install", collar: "install", subliner: "install",
};
const bucketOf = (e) => BUCKET_OF[e.group] || "addon";

// One word each, no descriptive line (owner 2026-08-02): the Kits tab is a
// price list to scan, and the difference between these four is the one word.
const FAM_DEFS = [
  ["fundo", "Curbed"],
  ["curbless", "Curbless"],
  ["linear", "Linear"],
  ["module", "Neo modules"],
];
// Two chips are conditional: Recess on curbless builds only — the bracket kit
// / ramp is a pick there, not part of the house kit (owner ask 2026-07-30) —
// and Cover frame only while the drain cover is a linear one, since a 4×4
// point cover has no frame to match (owner ask 2026-07-31).
const ADDON_CHIPS = [["niche", "Niche"], ["seat", "Seat"], ["bench", "Bench"], ["shelf", "Glass shelf"], ["gun", "Sealant gun"], ["recess", "Recess kit"], ["coverFrame", "Cover frame"]];
const CORNER_LBL = [["bl", "back-left"], ["br", "back-right"], ["fl", "entry-left"], ["fr", "entry-right"]];
const EDGE_LBL = { back: "Back +", left: "Left +", right: "Right +", entry: "Entry" };

// A field that commits on blur/Enter rather than per keystroke — the solver and
// the whole build re-run off these, and a half-typed "4" of "48" is not a room.
function NumIn({ value, onCommit, ...rest }) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const live = useRef(false);
  useEffect(() => { if (!live.current) setDraft(value == null ? "" : String(value)); }, [value]);
  return <input {...rest} value={draft}
    onFocus={() => { live.current = true; }}
    onChange={(e) => setDraft(e.target.value)}
    onBlur={() => { live.current = false; onCommit(draft); }}
    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />;
}

// ============================================================================
// the popup
// ============================================================================

const DEF_WALLS = [
  { id: "back", label: "Back", on: true, len: "", h: "", faces: "in" },
  { id: "left", label: "Left", on: true, len: "", h: "", faces: "in" },
  { id: "right", label: "Right", on: true, len: "", h: "", faces: "in" },
];
const DEF_OPTS = { panelKey: undefined, curbKey: undefined, coverKey: undefined, coverFrame: undefined, sealantForm: "tube", recess: undefined };
const DEF_INP = { w: 48, d: 66, curb: "curbed", drain: "any", drainX: "", drainY: "", anchor: "left" };

// The seed is either a search parse (seedFromQuery: { tab, input, search }) or a
// saved row's marker / the restore layer ({ mode, cfg } — cfg from kitFor). A
// cfg re-lands through kitFor with the same option names it was written with.
function seedState(seed) {
  const s = {
    tab: "kits", inp: { ...DEF_INP }, q: "", panKey: null, opts: { ...DEF_OPTS },
    addons: [], benches: [], walls: DEF_WALLS.map((w) => ({ ...w })), extraWalls: [], wallH: 96, wallSeq: 0,
    corners: { bl: false, br: false, fl: false, fr: false }, solveInput: null, maxIn: false, tileT: "",
  };
  if (!seed) return s;
  const cfg = seed.cfg;
  if (cfg && cfg.panKey) {
    s.maxIn = !!cfg.maxIn;
    s.tileT = +cfg.tileT > 0 ? String(+cfg.tileT) : "";
    s.tab = seed.mode === "custom" ? "custom" : seed.mode === "browse" ? "browse" : "kits";
    s.panKey = cfg.panKey;
    s.opts = {
      panelKey: cfg.panelKey || undefined,
      curbKey: cfg.curbKey === undefined ? undefined : cfg.curbKey,
      coverKey: cfg.coverKey || undefined,
      coverFrame: cfg.coverFrame || undefined,
      sealantForm: cfg.sealantForm === "sausage" ? "sausage" : "tube",
      recess: cfg.recess || undefined,
    };
    s.addons = (cfg.addons || []).slice();
    s.benches = (cfg.benches || []).map((b) => ({ ...b }));
    const rows = [];
    (cfg.walls || []).forEach((w) => {
      const base = s.walls.find((x) => x.id === w.side);
      if (base && !w.extra && !rows.includes(base)) { base.on = true; base.len = String(w.len); base.h = String(w.h); base.faces = w.faces || "in"; rows.push(base); }
      else s.extraWalls.push({ id: ++s.wallSeq, edge: w.side || "entry", len: String(w.len), h: String(w.h), faces: w.faces || "in", at: w.at === "hi" ? "hi" : "lo" });
    });
    s.walls.forEach((w) => { if (!rows.includes(w)) w.on = false; });
    (cfg.corners || []).forEach((k) => { if (s.corners[k] != null) s.corners[k] = true; });
    if (cfg.walls && cfg.walls.length) s.wallH = Math.round(+cfg.walls[0].h) || 96;
    if (cfg.solve && cfg.solve.input) { s.solveInput = cfg.solve.input; s.inp = { ...DEF_INP, ...cfg.solve.input, drainX: cfg.solve.input.drainX || "", drainY: cfg.solve.input.drainY || "" }; }
    else if (cfg.room) s.inp = { ...s.inp, w: cfg.room.w, d: cfg.room.d };
    return s;
  }
  if (seed.tab) s.tab = seed.tab === "custom" ? "custom" : seed.tab === "browse" ? "browse" : "kits";
  if (seed.input) s.inp = { ...DEF_INP, ...seed.input, drainX: "", drainY: "" };
  if (seed.search) s.q = seed.search;
  if (s.tab === "custom") s.solveInput = { w: s.inp.w, d: s.inp.d, curb: s.inp.curb, drain: s.inp.drain };
  return s;
}

export default function WediConfigurator({ seed, tier, onTierChange, wediBuilderPct, onAdd, onClose, areaName, projectName, onConfigChange, embedded = false }) {
  const init = useRef(null);
  if (!init.current) init.current = seedState(seed);
  const s0 = init.current;

  const [tab, setTab] = useState(s0.tab);
  const [panKey, setPanKey] = useState(s0.panKey);
  const [option, setOption] = useState(null);
  const [results, setResults] = useState([]);
  const [qtyOv, setQtyOv] = useState({});
  const [manual, setManual] = useState([]);
  const [addons, setAddons] = useState(s0.addons);
  const [benches, setBenches] = useState(s0.benches);
  const [opts, setOpts] = useState(s0.opts);
  const [inp, setInp] = useState(s0.inp);
  // "Overall max" (owner ask 2026-07-30): the typed sizes are the whole
  // footprint — every fully open edge pulls its curb inside the line and
  // the pan space gives up (curb width − the ½" pan lap).
  const [maxIn, setMaxIn] = useState(!!s0.maxIn);
  // What the finished tile adds on the curb's outer face. Only "overall max"
  // has a line the shower may not cross, so it is only there that the tile
  // costs pan space — in "pan size" mode it lands outside the stated numbers.
  const [tileT, setTileT] = useState(s0.tileT);
  const tileIn = parseIn(tileT);
  const [walls, setWalls] = useState(s0.walls);
  const [extraWalls, setExtraWalls] = useState(s0.extraWalls);
  const wallSeq = useRef(s0.wallSeq);
  const [corners, setCorners] = useState(s0.corners);
  const [placing, setPlacing] = useState(false);
  const [wallFlip, setWallFlip] = useState(false);
  const [wallH, setWallH] = useState(s0.wallH);
  const [panelFit, setPanelFit] = useState(true);

  // Shrink-to-fit: measure the frame the popup sits in and scale the whole
  // thing so the drawings rail always stays on screen. `zoom` (not transform)
  // because it is a real layout scale — the popup keeps its own scrollbars, and
  // getBoundingClientRect still reports viewport pixels, so the swap/chip/wall
  // popovers that portal to document.body land on their anchors unscaled.
  const shellRef = useRef(null);
  const [fit, setFit] = useState({ zoom: 1, h: 940 });
  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const pad = embedded ? 0 : 32;   // the overlay's p-4 gutters
    const on = () => {
      const w = el.clientWidth - pad;
      if (w <= 0) return;
      const zoom = Math.round(Math.min(1, Math.max(WEDI_ZOOM_FLOOR, w / WEDI_DESIGN_W)) * 1000) / 1000;
      // The overlay's height was 94vh, but a viewport unit inside a zoomed box
      // is not the pixel it is outside one — so it is measured here and handed
      // over in the popup's own (zoomed) pixels.
      const h = Math.round(Math.min(940, (el.clientHeight - pad) / zoom));
      setFit((p) => (p.zoom === zoom && p.h === h ? p : { zoom, h }));
    };
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded]);
  const uiZoom = fit.zoom;

  // The drawings rail sizes its two SVGs to the column instead of running off
  // the bottom of it (owner ask 2026-08-03). Both drawings already lay
  // themselves out inside whatever box they're handed, so the rail measures
  // itself and railSplit turns that into the height each one gets. Below the
  // floors it goes back to scrolling — a laptop viewport shouldn't shrink a
  // shower to a postage stamp to avoid a scrollbar. The column width never
  // changes: the three columns keep their equal share whatever the drawings do.
  const railRef = useRef(null);
  const [railBox, setRailBox] = useState({ w: RAIL_DESIGN_W, h: 0 });
  useEffect(() => {
    const el = railRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const on = () => {
      const w = Math.max(RAIL_MIN_W, Math.floor(el.clientWidth - RAIL_PAD_X));
      const h = Math.max(0, Math.floor(el.clientHeight - RAIL_PAD_Y));
      setRailBox((p) => (p.w === w && p.h === h ? p : { w, h }));
    };
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const railFit = useMemo(() => railSplit(railBox, placing), [railBox, placing]);

  const [q, setQ] = useState(s0.q);
  const [sec, setSec] = useState("");      // "", "starred", or a BROWSE_SECTIONS key
  const [sub, setSub] = useState("");      // sub-filter within the active section
  const [figOpen, setFigOpen] = useState(false);
  const [figSf, setFigSf] = useState("");
  // Starred items (owner sketch 2026-07-30): a per-device pin list, the ★
  // filter shows just them. localStorage, not the shared record — it's a
  // personal shortlist like the header-layout switch.
  const [starred, setStarred] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ft-wedi-starred") || "[]")); } catch (x) { return new Set(); }
  });
  const toggleStar = (key) => setStarred((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key); else n.add(key);
    try { localStorage.setItem("ft-wedi-starred", JSON.stringify([...n])); } catch (x) { }
    return n;
  });
  const [swap, setSwap] = useState(null);     // { key, rect }
  const [chipMenu, setChipMenu] = useState(null);   // { group, rect } — add-on chip picker
  const [wallMenu, setWallMenu] = useState(null);   // { wid, extra, x, y } — right-clicked wall
  const [benchMenu, setBenchMenu] = useState(null); // { kind, side|corner, x, y } — pan zone clicked
  const [confirmPan, setConfirmPan] = useState(null); // kit card clicked over a custom shower
  const [payload, setPayload] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState("");
  // Cost & margin stay hidden until clicked — a customer may be watching the
  // screen while the build is put together (owner ask 2026-07-31).
  const [showMargin, setShowMargin] = useState(false);

  // --- source: the shared Stock only / Full catalog switch (phase 4) --------
  // Session state, never persisted into product.wedi — the switch constrains
  // what the solver and the choice lists OFFER; a line already in the build
  // stays flagged SO rather than being removed (the P2 doctrine).
  const [source, setSource] = useState("all");
  // Stock-only narrows a choice list to its stocked rows — unless none are,
  // in which case the whole list stays so a swap menu is never empty and the
  // pick lands flagged instead of silently vanishing.
  const bySource = (list) => {
    if (source !== "stock") return list;
    const st = (list || []).filter((e) => e && e.stock);
    return st.length ? st : list;
  };

  // --- price level: a lens on the JOB's tier, exactly like Sheoga's ----------
  const [localTier, setLocalTier] = useState({ tier: "retail", customPct: "" });
  const tierCtl = !!(tier && onTierChange);
  const tierId = (tierCtl ? tier.tier : localTier.tier) || "retail";
  const customPct = tierCtl ? tier.customPct : localTier.customPct;
  const salePct = (tierCtl ? tier.salePct : null) ?? 10;
  const setTier = (patch) => (tierCtl ? onTierChange(patch) : setLocalTier((t) => ({ tier: patch.priceTier ?? t.tier, customPct: patch.customPct ?? t.customPct })));
  const bPct = wediBuilderPct == null ? 18 : wediBuilderPct;
  const bMult = bPct === 18 ? BUILDER_MULT : 1 - bPct / 100;
  const tierColor = TIER_COLOR[tierId]?.main || "var(--ft-text)";
  const tierOf = (e) => tierPrice(e, tierId, tierId === "builder" ? bPct : tierId === "sale" ? salePct : tierId === "custom" ? clampPct(customPct) : null);

  const toastT = useRef(null);
  const say = (msg) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 2600);
  };
  useEffect(() => () => clearTimeout(toastT.current), []);
  useEscClose(true, () => {
    if (payload) setPayload(null);
    else if (confirmPan) setConfirmPan(null);
    else if (benchMenu) setBenchMenu(null);
    else if (wallMenu) setWallMenu(null);
    else if (swap) setSwap(null);
    else if (chipMenu) setChipMenu(null);
    else if (placing) setPlacing(false);
    else onClose();
  });
  // The layout sheet unmounts on afterprint, not right after window.print()
  // returns — Safari (and Chrome sometimes) return with the dialog still up,
  // and an unmounted sheet prints blank. The timer is the belt-and-braces
  // fallback for anything that never fires the event.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    window.print();
    const t = setTimeout(done, 2500);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); };
  }, [printing]);
  // Dismiss the swap popover on any outside press (it is portalled, so the
  // popup's own backdrop click never sees it).
  useEffect(() => {
    if (!swap) return;
    const away = (e) => { if (!e.target.closest?.(".wedi-swap")) setSwap(null); };
    document.addEventListener("mousedown", away, true);
    return () => document.removeEventListener("mousedown", away, true);
  }, [swap]);
  // The chip picker dismisses like the swap popover — any outside press.
  useEffect(() => {
    if (!chipMenu) return;
    const away = (e) => { if (!e.target.closest?.(".wedi-chipmenu")) setChipMenu(null); };
    document.addEventListener("mousedown", away, true);
    return () => document.removeEventListener("mousedown", away, true);
  }, [chipMenu]);
  // The wall menu dismisses on an outside CLICK — click, not mousedown, so a
  // blur-committed length lands before the menu unmounts.
  useEffect(() => {
    if (!wallMenu) return;
    const away = (e) => { if (!e.target.closest?.(".wedi-wallmenu")) setWallMenu(null); };
    document.addEventListener("click", away, true);
    return () => document.removeEventListener("click", away, true);
  }, [wallMenu]);
  // The bench menu dismisses like the wall menu — outside click, so a
  // blur-committed size lands before it unmounts.
  useEffect(() => {
    if (!benchMenu) return;
    const away = (e) => { if (!e.target.closest?.(".wedi-benchmenu")) setBenchMenu(null); };
    document.addEventListener("click", away, true);
    return () => document.removeEventListener("click", away, true);
  }, [benchMenu]);

  // --- walls ----------------------------------------------------------------
  const wallOnMap = useMemo(() => Object.fromEntries(walls.map((w) => [w.id, w.on])), [walls]);
  const autoWallLens = (pan, room) => {
    if (room) return { back: room.w, left: room.d, right: room.d };
    let hi, lo;
    if (pan && pan.group === "module") { hi = pan.len; lo = 72.5; }
    else if (pan) { hi = Math.max(pan.w, pan.d); lo = Math.min(pan.w, pan.d); }
    else { hi = 60; lo = 36; }
    // 1 long side + 2 short by default; Flip swaps which side is the back
    if (wallFlip && pan && pan.group !== "module") { const t = hi; hi = lo; lo = t; }
    return { back: hi, left: lo, right: lo };
  };
  // Which end of its edge an added wall returns from. Named for the edge it
  // sits on, not the axis: a front wall reads Left/Right, a side wall Back/Entry.
  const endLabel = (w) => ((w.edge === "back" || w.edge === "entry")
    ? (w.at === "hi" ? "right" : "left") : (w.at === "hi" ? "entry" : "back"));

  const wallsArr = (pan, room) => {
    const auto = autoWallLens(pan, room);
    const out = [];
    walls.forEach((w) => {
      if (!w.on) return;
      const len = +w.len || auto[w.id] || 0;
      const h = +w.h || +wallH || 96;
      if (len > 0 && h > 0) out.push({ len, h, side: w.id, faces: w.faces || "in", wid: w.id });
    });
    extraWalls.forEach((w) => {
      const len = +w.len || 0, h = +w.h || +wallH || 96;
      // `at` is which END of the edge the run is anchored to. A base wall is
      // always "lo"; an added half wall can return from either side, and both
      // sides at once is simply two of them (owner ask 2026-08-03).
      if (len > 0 && h > 0) out.push({ len, h, side: w.edge, extra: true, at: w.at === "hi" ? "hi" : "lo", faces: w.faces || "in", wid: w.id });
    });
    return out;
  };
  // A wall's wedi area with its faces counted — "both" doubles the plane, an
  // exposed end adds the 4"-wide strip.
  const sfOfWall = (len, h, faces) =>
    round2(((+len || 0) * (+h || 0) * (faces === "both" ? 2 : 1) + (faces === "in-end" ? WALL_THICK * (+h || 0) : 0)) / 144);

  // The Fit plan (level courses, mixed sheet sizes, a vertical single sheet
  // where it kills the seams) replaces the engine's by-area panel line.
  const applyPanelFit = (lines, wl, panelSf) => {
    const plan = panelPlan(expandWallFaces(wl));
    const out = lines.filter((l) => !(l.group === "walls" && l.auto !== false));
    const vWalls = plan.detail.filter((d) => d.vertical).length;
    plan.lines.forEach((pl, i) => out.push({
      item: item(pl.key), qty: pl.qty, group: "walls", auto: true,
      note: i === 0
        ? round2(panelSf) + " sf — " + plan.vSeams + " vertical seam" + (plan.vSeams === 1 ? "" : "s")
          + (vWalls ? " · " + vWalls + " wall" + (vWalls === 1 ? "" : "s") + " stood vertical" : "")
        : "panel plan",
    }));
    return out;
  };

  const pan = panKey ? item(panKey) : null;
  const room = option ? option.room : null;
  const buildWalls = useMemo(() => wallsArr(pan, room), [panKey, option, walls, extraWalls, wallH, wallFlip]);

  // Has the build been customized? A typed wall value that only equals the
  // kit's auto geometry doesn't count — it was tracking the kit (same
  // doctrine as retuneWalls). Geometry changes make it a CUSTOM SHOWER and
  // move the main pane to that tab; any change at all arms the kit-card
  // overwrite confirm.
  const autoNow = autoWallLens(pan, option ? option.room : null);
  const wallsTouched = walls.some((w) => !w.on
    || (w.len !== "" && Math.abs(+w.len - (autoNow[w.id] || 0)) >= 0.01)
    || (w.h !== "" && Math.abs(+w.h - (+wallH || 96)) >= 0.01)
    || (w.faces || "in") !== "in");
  const geomDirty = wallsTouched || extraWalls.length > 0 || Object.values(corners).some(Boolean) || wallFlip || +wallH !== 96;
  const kitDirty = !!panKey && (geomDirty || Object.keys(qtyOv).length > 0 || manual.length > 0 || addons.length > 0
    || benches.length > 0
    || opts.panelKey !== undefined || opts.curbKey !== undefined || opts.coverKey !== undefined
    || opts.coverFrame !== undefined
    || opts.sealantForm !== "tube" || opts.recess !== undefined);

  const build = useMemo(() => {
    if (panKey) {
      // The room always goes down — for a kit it's the pan footprint oriented
      // the way the walls read (Flip-aware), so the curb's open-edge math and
      // the drawing agree on which side is which.
      const auto = autoWallLens(pan, option ? option.room : null);
      const b = kitFor(panKey, {
        option: option || undefined,
        room: option ? option.room : { w: auto.back, d: auto.left },
        walls: buildWalls, wallHeight: +wallH || 80,
        panelKey: opts.panelKey, curbKey: opts.curbKey, coverKey: opts.coverKey,
        coverFrame: opts.coverFrame, sealantForm: opts.sealantForm, recess: opts.recess,
        addons: addons.slice(), benches: benches.slice(), tier: tierId,
        corners: ["bl", "br", "fl", "fr"].filter((k) => corners[k]),
        mode: option ? "custom" : "kit", maxIn: maxIn, tileT: tileIn,
      });
      if (!b) return null;
      let lines = b.lines.map((l) => ({ item: l.item, qty: l.qty, group: l.group, note: l.note, auto: l.auto }));
      if (panelFit) lines = applyPanelFit(lines, buildWalls, b.panelSf);
      lines.forEach((l) => {
        const ov = qtyOv[l.item.key];
        if (ov != null && l.auto !== false) { l.autoQty = l.qty; l.qty = ov; l.ov = true; }
      });
      lines = lines.filter((l) => l.qty > 0);
      manual.forEach((m) => {
        const it = item(m.key);
        if (!it || !(m.qty > 0)) return;
        const hit = lines.find((l) => l.item.key === m.key);
        if (hit) hit.qty += m.qty;
        else lines.push({ item: it, qty: m.qty, group: bucketOf(it), note: "", auto: false });
      });
      return { ...b, lines };
    }
    if (manual.length) {
      const lines = manual.filter((m) => m.qty > 0).map((m) => {
        const it = item(m.key);
        return it ? { item: it, qty: m.qty, group: bucketOf(it), note: "", auto: false } : null;
      }).filter(Boolean);
      if (!lines.length) return null;
      const soNet = round2(lines.reduce((t, l) => t + (l.item.stock ? 0 : (l.item.soNet || l.item.cost || 0) * l.qty), 0));
      const hints = [];
      if (lines.some((l) => l.item.group === "sealant" && /sausage/i.test(l.item.name)) && !lines.some((l) => l.item.key === SKU.gun)) hints.push("sausage-gun");
      if (soNet > 0 && soNet < SO_MIN_NET) hints.push("small-order");
      return { pan: null, lines, panelSf: 0, factory: null, hints, mode: "browse", cfg: {}, soNet };
    }
    return null;
  }, [panKey, option, buildWalls, wallH, opts, addons, benches, qtyOv, manual, panelFit, tierId, corners, maxIn, tileIn]);

  // The live { mode, cfg } upward, in seed shape, so App's ft-open-layer
  // restore reopens mid-configuration rather than on the original seed.
  useEffect(() => {
    onConfigChange?.({ mode: build ? build.mode : tab === "custom" ? "custom" : tab === "browse" ? "browse" : "kit", cfg: build ? build.cfg : {}, tab, search: q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, tab, q]);

  const qtyIn = (key) => (build ? build.lines.reduce((t, l) => t + (l.item.key === key ? l.qty : 0), 0) : 0);

  const step = (key, delta) => {
    const auto = build && build.lines.find((l) => l.item.key === key && l.auto !== false);
    if (auto) {
      setQtyOv((o) => ({ ...o, [key]: Math.max(0, (o[key] != null ? o[key] : auto.qty) + delta) }));
      return;
    }
    const m = manual.find((x) => x.key === key);
    let next = manual;
    if (m) {
      const nq = Math.max(0, m.qty + delta);
      next = nq ? manual.map((x) => (x === m ? { ...x, qty: nq } : x)) : manual.filter((x) => x !== m);
    } else if (delta > 0) next = [...manual, { key, qty: delta }];
    setManual(next);
    // an add-on stepped past its last piece drops its chip too
    if (delta < 0 && addons.includes(key) && !next.some((x) => x.key === key && x.qty > 0)) setAddons((a) => a.filter((k) => k !== key));
  };

  const resetBuild = () => { setQtyOv({}); setAddons([]); setBenches([]); setBenchMenu(null); setManual([]); setOpts({ ...DEF_OPTS }); };
  // Only a genuinely modified wall survives a room/option change (owner rule):
  // a typed length that just equals the OUTGOING geometry's auto length was
  // only tracking the kit, so it clears back to auto and follows the new one.
  const retuneWalls = () => {
    const auto = autoWallLens(pan, option ? option.room : null);
    setWalls((ws) => ws.map((w) => (w.len !== "" && Math.abs(+w.len - (auto[w.id] || 0)) < 0.01 ? { ...w, len: "" } : w)));
  };
  // The Custom shower form mirrors the chosen kit (owner rule 2026-07-30):
  // size, curb, and drain TYPE seed from the pan; the typed drain placement
  // clears — the plumbing position belongs to the room, not the kit.
  const seedFormFromKit = (p, noFlip) => {
    const auto = noFlip
      ? (p.group === "module" ? { back: p.len, left: 72.5 } : { back: Math.max(p.w, p.d), left: Math.min(p.w, p.d) })
      : autoWallLens(p, null);
    const next = {
      ...inp, w: auto.back, d: auto.left,
      curb: p.sub === "curbless" ? "curbless" : "curbed",
      drain: p.group === "module" ? "linear"
        : p.drain && ["center", "offset", "linear"].includes(p.drain.type) ? p.drain.type : "any",
      drainX: "", drainY: "",
    };
    setInp(next);
    // a kit's size IS the pan size — the seeded form reads it that way
    setMaxIn(false);
    setResults(solve({ w: next.w, d: next.d, curb: next.curb, drain: next.drain, tolerance: 0.51, anchor: next.anchor || "left", source }));
  };
  // A kit card is a hard reset (owner rule 2026-07-30): once a build is
  // customized it IS the custom shower, so a kit click asks before wiping it.
  // The reset also re-seeds the Custom shower form from the kit.
  const hardReset = (key) => {
    setWalls(DEF_WALLS.map((w) => ({ ...w })));
    setExtraWalls([]);
    setCorners({ bl: false, br: false, fl: false, fr: false });
    setWallFlip(false);
    setWallH(96);
    setPlacing(false);
    setOption(null);
    setPanKey(key);
    resetBuild();
    const p = key ? item(key) : null;
    if (p) seedFormFromKit(p, true);
    else {
      setInp({ ...DEF_INP });
      setMaxIn(false);
      setTileT("");
      setResults(solve({ w: DEF_INP.w, d: DEF_INP.d, curb: DEF_INP.curb, drain: DEF_INP.drain, tolerance: 0.51, source }));
    }
  };
  const pickPan = (key) => {
    if (option || kitDirty || manual.length) { setConfirmPan(key); return; }
    hardReset(key);
  };

  // Solve the room. With "overall max" on, every fully open edge gives up
  // its curb's width (minus the ½" pan lap) before the solver runs, and the
  // options come back re-based into the full stated footprint
  // (applyCurbInset) — a typed drain position is measured from the room's
  // own origin, so it shifts into the reduced space the same way.
  const insetFor = (i, maxOn) => {
    if (!maxOn || i.curb === "curbless" || opts.curbKey === null) return null;
    const wl = walls.filter((x) => x.on).map((x) => ({ side: x.id, len: +x.len || (x.id === "back" ? +i.w || 0 : +i.d || 0) }));
    extraWalls.forEach((x) => wl.push({ side: x.edge, len: +x.len || 0, at: x.at === "hi" ? "hi" : "lo" }));
    return curbInsets({ w: +i.w || 0, d: +i.d || 0 }, wl, opts.curbKey || SKU.curbLean60, tileIn);
  };
  const solveRoom = (i, maxOn) => {
    const ins = insetFor(i, maxOn);
    const dx = +i.drainX || 0, dy = +i.drainY || 0;
    const res = solve({
      w: round2((+i.w || 0) - (ins ? ins.left + ins.right : 0)),
      d: round2((+i.d || 0) - (ins ? ins.back + ins.entry : 0)),
      curb: i.curb, drain: i.drain, tolerance: 0.51,
      drainX: dx > 0 ? Math.max(0, round2(dx - (ins ? ins.left : 0))) : 0,
      drainY: dy > 0 ? Math.max(0, round2(dy - (ins ? ins.back : 0))) : 0,
      anchor: i.anchor || "left",
      source,
    });
    return ins ? res.map((o) => applyCurbInset(o, ins, { w: +i.w || 0, d: +i.d || 0 })) : res;
  };
  const runSolve = (next) => {
    const i = next || inp;
    const res = solveRoom(i, maxIn);
    retuneWalls();
    setResults(res);
    if (res.length) { setOption(res[0]); setPanKey(res[0].pan.key); } else { setOption(null); setPanKey(null); }
    resetBuild();
  };
  const setInput = (patch) => { const next = { ...inp, ...patch }; setInp(next); runSolve(next); };
  // Flipping the source re-solves an ACTIVE custom room (options re-rank);
  // with only a kit loaded it refreshes the option cards without touching
  // the build — runSolve would adopt res[0] and wipe the kit selection.
  const srcMounted = useRef(false);
  useEffect(() => {
    if (!srcMounted.current) { srcMounted.current = true; return; }
    if (option) runSolve();
    else setResults(solveRoom(inp, maxIn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);
  const selectOption = (k) => { const o = results[k]; if (!o) return; retuneWalls(); setOption(o); setPanKey(o.pan.key); resetBuild(); };

  // One-shot at mount: the room always arrives solved, so the Custom tab is
  // never a bare form claiming "no option fits" for a size it hasn't tried.
  // Only a seed that NAMED a room picks an option — otherwise the cards sit
  // unselected beside whatever the build column already holds.
  const solved = useRef(false);
  useEffect(() => {
    if (solved.current) return;
    solved.current = true;
    const i = { ...inp, ...(s0.solveInput || {}) };
    const res = solveRoom(i, !!s0.maxIn);
    setResults(res);
    if (!s0.solveInput || !res.length) return;
    // A saved cfg keeps its own pan; a fresh room seed takes the top option.
    setOption(s0.panKey ? (res.find((o) => o.pan.key === s0.panKey) || res[0]) : res[0]);
    if (!s0.panKey) setPanKey(res[0].pan.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once a kit's geometry is modified it IS a custom shower (owner rule
  // 2026-07-30): the main pane moves to the Custom shower tab with the room
  // form seeded from the kit. The option cards land unselected, so the build
  // column keeps the modified kit until the user re-solves or picks a card.
  const geomSig = JSON.stringify([walls, extraWalls, corners, wallFlip, wallH]);
  useEffect(() => {
    if (!(pan && !option && geomDirty && tab === "kits")) return;
    seedFormFromKit(pan);
    setTab("custom");
    say("Modified kit — it's a custom shower now. Kit cards ask before overwriting it.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomSig]);

  // A framed bench that asks for a smaller pan and GETS one takes the kit's own
  // pan out of the build (owner rule 2026-07-31), so it moves to the Custom
  // shower tab like a geometry change — one-way, and the build column keeps
  // what's there. Every other bench is an add-on the kit still carries: a 2"
  // build-up, a premade, a suspended seat, and framed + "cut it down" all leave
  // the pan alone. The swap lands either as the re-solved clear-space plan
  // (panPlan) or the plain largest-that-fits fallback, so the test is the floor
  // pan the build actually figured, not the choice.
  const floorPanKey = !build ? null
    : build.panPlan ? build.panPlan.option.pan.key
      : build.lines.find((l) => l.group === "floor" && (l.item.group === "pan" || l.item.group === "module"))?.item.key || null;
  const panSwapped = !!(panKey && floorPanKey && floorPanKey !== panKey
    && benches.some((b) => b.build === "framed" && b.panFit === "smaller"));
  useEffect(() => {
    if (!(pan && !option && panSwapped && tab === "kits")) return;
    seedFormFromKit(pan);
    setTab("custom");
    say("Framed bench swapped the pan — it's a custom shower now. Kit cards ask before overwriting it.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panSwapped]);

  // Adopt the card that matches what is already on screen. Unlike runSolve this
  // keeps the build standing — it is a RE-FIT, not a fresh start.
  //
  // A kit loaded off the Kits tab has a pan but no picked card, and that used to
  // mean the re-fits below did nothing you could see: "Max — curb inside" moved
  // the numbers and left the drawing alone until you picked a card or retyped
  // the room (owner 2026-08-03). The pan is the answer either way, so the click
  // adopts the card carrying it and the drawing moves on the click. An empty
  // solve only clears a card that was already picked — a kit is left standing.
  const refit = (res) => {
    const same = (panKey && res.find((x) => x.pan.key === panKey)) || res[0] || null;
    if (!same && !option) return;
    setOption(same);
    setPanKey(same ? same.pan.key : null);
  };

  // With "overall max" on, the walls, the curb pick and the tile thickness
  // shape the pan space — re-fit the option cards when they change, without
  // wiping the build.
  const insetSigOf = (maxOn) => (maxOn ? JSON.stringify([walls.map((w) => w.on), extraWalls.map((x) => x.edge + ":" + (x.at || "lo") + ":" + x.len),
    opts.curbKey === undefined ? "" : opts.curbKey, tileIn]) : "");
  const insetSig = insetSigOf(maxIn);
  const insetSeen = useRef(insetSig);
  useEffect(() => {
    if (insetSig === insetSeen.current) return;
    insetSeen.current = insetSig;
    if (!maxIn) return;
    const res = solveRoom(inp, true);
    setResults(res);
    refit(res);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insetSig]);

  // "Sizes are" restates what the typed numbers MEAN, so it re-fits the build
  // the way the wall and curb changes above do (owner ask 2026-07-31) rather
  // than starting over: re-solve for the new reading, re-pick the equivalent
  // option, and leave the benches, walls, add-ons, overrides and manual lines
  // standing — the build re-figures itself from the new pan. Stamping
  // insetSeen keeps the effect above from solving the same flip twice.
  const setMaxMode = (nextMax) => {
    if (nextMax === maxIn) return;
    setMaxIn(nextMax);
    insetSeen.current = insetSigOf(nextMax);
    const res = solveRoom(inp, nextMax);
    setResults(res);
    refit(res);
  };

  // --- the drawings ---------------------------------------------------------
  const diag = useMemo(() => {
    if (option) return option;
    if (!panKey) return null;
    const p = item(panKey);
    if (p.group === "module") {
      // The module is the channel; the floor is the module plus the extension
      // of its own length, exactly as kitFor lists it.
      const ext = group("modExt").filter((m) => m.len === p.len)[0];
      const pieces = [{ kind: "module", item: p, x: 0, y: 0, w: p.len, d: MODULE_DEPTH, cut: null }];
      if (ext) pieces.push({ kind: "modExt", item: ext, x: 0, y: MODULE_DEPTH, w: p.len, d: MODEXT_DEPTH, cut: null });
      return {
        pieces: pieces,
        drain: p.drain ? { ...p.drain } : null,
        room: { w: p.len, d: round2(MODULE_DEPTH + (ext ? MODEXT_DEPTH : 0)) },
        warnings: [], title: p.name,
      };
    }
    // Orient the pan the way the walls read: the BACK wall is the long side (or
    // the short one after Flip), so the drawing and the build column agree.
    const auto = autoWallLens(p, null);
    const bw = auto.back, bd = auto.left;
    const rot = bw !== p.w;
    let drain = null;
    if (p.drain) {
      drain = {
        type: p.drain.type, x: rot ? p.drain.y : p.drain.x, y: rot ? p.drain.x : p.drain.y,
        len: p.drain.len || 0,
        axis: p.drain.axis ? (rot ? (p.drain.axis === "w" ? "d" : "w") : p.drain.axis) : null,
        note: p.drain.note || "",
      };
    }
    return {
      pieces: [{ kind: "pan", item: p, x: 0, y: 0, w: bw, d: bd, cut: null }],
      drain, room: { w: bw, d: bd }, warnings: [], title: p.name,
    };
  }, [panKey, option, wallFlip]);

  // Framed bench + "smaller": the drawings show the CLEAR space's re-solved
  // layout — the sub-option's pieces and centered drain shifted past the
  // bench — while the room (and the walls figured on it) stays the full
  // shower size. kind "drainat" turns on the two rust drain measurements,
  // taken from the shower's own origin like any pinned drain.
  const drawDiag = useMemo(() => {
    const plan = build && build.panPlan;
    if (!diag || !plan) return diag;
    // the plan's pieces live in the pan-space coords: past the framed bench
    // AND past any curb pulled inside the line ("overall max")
    const ox = plan.offset.x + (diag.inset ? diag.inset.left : 0);
    const oy = plan.offset.y + (diag.inset ? diag.inset.back : 0);
    return {
      ...diag,
      kind: "drainat",
      pieces: plan.option.pieces.map((p) => ({ ...p, x: round2(p.x + ox), y: round2(p.y + oy) })),
      drain: plan.option.drain
        ? { ...plan.option.drain, x: round2(plan.option.drain.x + ox), y: round2(plan.option.drain.y + oy) }
        : diag.drain,
      warnings: (diag.warnings || []).concat(plan.option.warnings || []),
    };
  }, [diag, build]);

  const dWalls = useMemo(() => {
    if (!panKey) return [];
    // expandWallFaces appends the extra faces AFTER the base walls, so
    // detail[i] still belongs to buildWalls[i].
    const det = panelFit ? panelPlan(expandWallFaces(buildWalls)).detail : null;
    return buildWalls.map((w, i) => ({
      side: w.side, len: w.len, h: w.h, extra: !!w.extra, at: w.at === "hi" ? "hi" : "lo",
      faces: w.faces || "in", wid: w.wid, courses: det ? det[i].courses : [],
    }));
  }, [panKey, buildWalls, panelFit]);

  // Which corners can take a 45° cut (not boxed in by two walls), and where
  // the curb runs — the open edges, drawn only when the build carries a curb.
  const cornerOpenMap = useMemo(() => (diag ? openCorners(diag.room, buildWalls) : null), [diag, buildWalls]);
  // cuts drive the chamfer in both drawings (curbless showers cut too); the
  // curb bands only draw when the build actually carries a curb line.
  const curb = useMemo(() => {
    if (!diag) return { segs: [], diags: [], cuts: [] };
    const runs = curbRuns(diag.room, buildWalls, ["bl", "br", "fl", "fr"].filter((k) => corners[k]),
      (build && build.benches) || []);
    const line = build && build.lines.find((l) => l.item.group === "curb");
    return {
      segs: line ? runs.segs : [], diags: line ? runs.diags : [], cuts: runs.diags,
      h: line ? curbHeight(line.item) : 0, w: line ? curbWidth(line.item) : 0,
    };
  }, [diag, build, buildWalls, corners]);
  // A wall change can box a cut corner in — drop the cut rather than draw a
  // cut through a standing wall.
  useEffect(() => {
    if (!cornerOpenMap) return;
    setCorners((c) => {
      let changed = false;
      const n = { ...c };
      Object.keys(n).forEach((k) => { if (n[k] && !cornerOpenMap[k]) { n[k] = false; changed = true; } });
      return changed ? n : c;
    });
  }, [cornerOpenMap]);

  // --- swaps ----------------------------------------------------------------
  const swapChoices = (line) => {
    const g = line.item.group;
    if (g === "panel") return { title: "Wall panel", list: bySource(group("panel").filter((p) => p.sf)), set: (k) => setOpts((o) => ({ ...o, panelKey: k || undefined })) };
    if (g === "cover" && line.item.sub === "point") return { title: "Drain cover — 4×4 finish", list: bySource(group("cover").filter((c) => c.sub === "point")), set: (k) => setOpts((o) => ({ ...o, coverKey: k || undefined })) };
    if (g === "cover" && line.item.sub === "linear") {
      const nom = line.item.len;
      return { title: "Linear cover — " + nom + '" channel', list: bySource(group("cover").filter((c) => c.sub === "linear" && c.len === nom)), set: (k) => setOpts((o) => ({ ...o, coverKey: k || undefined })) };
    }
    if (g === "coverFrame") {
      return {
        title: "Cover frame — " + line.item.len + '" channel',
        list: bySource(group("coverFrame").filter((f) => f.len === line.item.len)), none: "No frame",
        set: (k) => setOpts((o) => ({ ...o, coverFrame: k ? item(k).finish : undefined })),
      };
    }
    if (g === "curb") return { title: "Curb", list: bySource(curbs()), none: "No curb", set: (k) => setOpts((o) => ({ ...o, curbKey: k || null })) };
    if (g === "sealant" && line.item.sub === "joint") {
      return { title: "Joint sealant form", list: [item(SKU.sealantTube), item(SKU.sealantSausage)], set: (k) => setOpts((o) => ({ ...o, sealantForm: k === SKU.sealantSausage ? "sausage" : "tube" })) };
    }
    if (g === "recess" || g === "ramp") {
      return { title: "Curbless entry", list: [item(SKU.recessKit), item(SKU.ramp)], none: "Recess the subfloor (no part)", set: (k) => setOpts((o) => ({ ...o, recess: k === SKU.ramp ? "ramp" : k ? "kit" : "none" })) };
    }
    if (["niche", "seat", "bench", "shelf"].includes(g)) {
      return {
        title: GROUP_LABEL[g], list: bySource(group(g)), set: (k) => {
          if (!k) return;
          setAddons((a) => a.map((x) => (x === line.item.key ? k : x)));
          setManual((mm) => mm.map((x) => (x.key === line.item.key ? { ...x, key: k } : x)));
        },
      };
    }
    return null;
  };
  // The channel frames that match the build's linear cover — empty (so the
  // chip stays hidden) on a 4×4 point drain, which has no frame.
  const frameOpts = useMemo(() => {
    const cl = build && build.lines.find((l) => l.item.group === "cover");
    return cl ? coverFrames(cl.item) : [];
  }, [build]);
  // An add-on chip with one possible part adds it outright; more than one
  // opens a picker (owner ask 2026-07-30) — stock first, then cheapest.
  const chipChoices = (g) => {
    if (g === "gun") return [item(SKU.gun)];
    if (g === "recess") return [item(SKU.recessKit), item(SKU.ramp)];
    if (g === "coverFrame") return bySource(frameOpts);
    return bySource(group(g).slice().sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || a.retail - b.retail));
  };
  const chipPick = (g, key) => {
    if (g === "recess") setOpts((o) => ({ ...o, recess: key === SKU.ramp ? "ramp" : "kit" }));
    else if (g === "coverFrame") setOpts((o) => ({ ...o, coverFrame: (item(key) || {}).finish }));
    else setAddons((a) => [...a, key]);
    setChipMenu(null);
  };

  // --- kit cards ------------------------------------------------------------
  // What each house kit sells for through the tier lens with the current wall
  // setup — ONE number per card, matching the build column's total (owner ask
  // 2026-07-31; supersedes feedback 20's our-stock-cost line, which read as a
  // second confusing price beside the pan's).
  const kitTotals = useMemo(() => {
    const out = {};
    const fams = FAM_DEFS.map((f) => (f[0] === "module" ? group("module").filter((m) => m.sub === "neo") : pans({ family: f[0] })));
    fams.forEach((list) => list.forEach((p) => {
      const wl = wallsArr(p, null);
      const lens = autoWallLens(p, null);
      const b = kitFor(p.key, { walls: wl, sealantForm: opts.sealantForm, room: { w: lens.back, d: lens.left } });
      if (!b) return;
      const lines = panelFit ? applyPanelFit(b.lines, wl, b.panelSf) : b.lines;
      out[p.key] = round2(lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
    }));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walls, extraWalls, wallH, wallFlip, panelFit, opts.sealantForm, tierId, customPct, salePct, bPct]);

  const cat = catalog();
  const nStock = useMemo(() => cat.filter((e) => e.stock).length, [cat]);

  // --- totals ---------------------------------------------------------------
  const totals = useMemo(() => {
    if (!build) return null;
    const retail = round2(build.lines.reduce((t, l) => t + l.item.retail * l.qty, 0));
    const sell = round2(build.lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
    const cost = round2(build.lines.reduce((t, l) => t + l.item.cost * l.qty, 0));
    return { retail, sell, cost, margin: round2(sell - cost) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, tierId, customPct, salePct, bPct]);

  const rows = useMemo(() => (build ? lineItems(build, { tier: tierId, builderPct: bPct }) : []), [build, tierId, bPct]);

  const copyList = () => {
    const txt = build.lines.map((l) => (l.item.stock ? l.item.erp + "\t" + l.qty : "wedi " + l.item.us + " — " + l.item.name + " × " + l.qty)).join("\n");
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
      () => say("Copied — stocked lines as SKU ⇥ qty, special order by description"),
      () => say("Clipboard blocked — copy the list from the print sheet"));
  };

  // ==========================================================================
  // renders
  // ==========================================================================
  const tierBar = (
    <div className="tierbar">
      {TIERS.map((t) => {
        const on = tierId === t;
        const sub = t === "builder" ? "× " + bMult.toFixed(2) : t === "sale" ? "−" + salePct + "%"
          : t === "custom" ? null : TIER_SUB[t];
        // Retail is the kit's ink fill (which flips in dark mode); the coloured
        // tiers are saturated enough to keep white text in both themes.
        const fill = on
          ? (TIER_COLOR[t] ? { background: TIER_COLOR[t].main, color: "#fff" } : { background: "var(--ft-accent)", color: "var(--ft-accent-ink)" })
          : undefined;
        if (t === "custom") return (
          <button key={t} className={on ? "on" : ""} onClick={() => setTier({ priceTier: "custom" })} style={fill} title="Custom % off retail">
            Custom
            <small>−<input value={customPct ?? ""} onClick={(e) => e.stopPropagation()}
              onChange={(e) => setTier({ priceTier: "custom", customPct: e.target.value })} />%</small>
          </button>
        );
        return (
          <button key={t} className={on ? "on" : ""} onClick={() => setTier({ priceTier: t })} style={fill}>
            {t[0].toUpperCase() + t.slice(1)}{sub ? <small>{sub}</small> : null}
          </button>
        );
      })}
    </div>
  );

  const kitsTab = (
    <>
      {FAM_DEFS.map((fd) => {
        const list = fd[0] === "module" ? group("module").filter((m) => m.sub === "neo") : pans({ family: fd[0] });
        if (!list.length) return null;
        const usualDrain = majority(list, (p) => (p.group === "module" ? "module" : p.drain?.type || ""));
        return (
          <div className="fam" key={fd[0]}>
            <div className="fam-h"><div className="t">{fd[1]}</div></div>
            <div className="cards">
              {[...list].sort(panOrder).map((p) => {
                const tag = panTag(p, usualDrain);
                return (
                  <button key={p.key} disabled={source === "stock" && !p.stock}
                    className={"pancard" + (panKey === p.key && !option ? " on" : "") + (source === "stock" && !p.stock ? " dis" : "")}
                    onClick={() => pickPan(p.key)} data-wedi-pan={p.key}
                    title={unwedi(p.name) + (p.group === "module" ? ` · ${inch(p.channel)}″ channel` : ` · ${p.drain.type} drain`)}>
                    {p.stock && <div className="dot" title="stocked" />}
                    <div className="sz">
                      {p.group === "module"
                        ? <><b>{ftIn(p.len)}</b>{inch(p.len)}″</>
                        : <><b>{ftIn(p.w)} × {ftIn(p.d)}</b>{inch(p.w)} × {inch(p.d)}</>}
                    </div>
                    {tag && <div className="nm">{tag}</div>}
                    <div className="pr" style={{ color: tierColor }}>{fm(kitTotals[p.key] != null ? kitTotals[p.key] : tierOf(p))}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );

  // --- the wall editor ------------------------------------------------------
  // It used to live in the build column's Walls group, beside the panel LINES
  // (owner 2026-08-03: "this should be in the wall section of the custom shower
  // tab and not in the build column"). The rows are the ROOM, not the bill —
  // they belong with the size, the curb and the drain in the Custom shower
  // form, and the build column is left listing what the room costs. The tab's
  // own "Which get wedi" chips are gone with the move: each row's name button
  // is the same on/off switch, with the length, the height and the sf beside it.
  const wallEditor = (() => {
    const cornerOn = CORNER_LBL.filter((c) => corners[c[0]]);
    const openList = CORNER_LBL.filter((c) => cornerOpenMap && cornerOpenMap[c[0]]);
    const allCut = openList.length > 0 && openList.every((c) => corners[c[0]]);
    return (
      <>
        <div className="wallrows">
          {walls.map((w) => (
            <div className="wallrow" key={w.id}>
              <button className={"wname" + (w.on ? " on" : "")} onClick={() => setWalls((ws) => ws.map((x) => (x.id === w.id ? { ...x, on: !x.on } : x)))}>{w.label}</button>
              <NumIn className="win" value={w.len} placeholder={String(autoNow[w.id] || "")} disabled={!w.on} title="length, in"
                onCommit={(v) => setWalls((ws) => ws.map((x) => (x.id === w.id ? { ...x, len: v } : x)))} />
              <span>×</span>
              <NumIn className="win" value={w.h} placeholder={String(wallH)} disabled={!w.on} title="height, in — 40 for a half wall"
                onCommit={(v) => setWalls((ws) => ws.map((x) => (x.id === w.id ? { ...x, h: v } : x)))} />
              <span className="wu">{w.on
                ? sfOfWall(+w.len || autoNow[w.id] || 0, +w.h || +wallH || 96, w.faces || "in") + " sf"
                  + (w.faces === "both" ? " · 2-side" : w.faces === "in-end" ? " · +end" : "")
                : "off"}</span>
            </div>
          ))}
          {extraWalls.map((w) => (
            <div className="wallrow" key={w.id}>
              <button className="wname on" title={"which end it returns from — click to move it (" + endLabel(w) + "). The × on the right removes it"}
                onClick={() => setExtraWalls((xs) => xs.map((x) => (x.id === w.id ? { ...x, at: (x.at === "hi" ? "lo" : "hi") } : x)))}>
                {EDGE_LBL[w.edge] || "Wall"} <small>{endLabel(w)}</small></button>
              <NumIn className="win" value={w.len} title="length, in"
                onCommit={(v) => setExtraWalls((xs) => xs.map((x) => (x.id === w.id ? { ...x, len: v } : x)))} />
              <span>×</span>
              <NumIn className="win" value={w.h} placeholder={String(wallH)} title="height, in"
                onCommit={(v) => setExtraWalls((xs) => xs.map((x) => (x.id === w.id ? { ...x, h: v } : x)))} />
              <span className="wu">{sfOfWall(+w.len || 0, +w.h || +wallH || 96, w.faces || "in")} sf
                {w.faces === "both" ? " · 2-side" : w.faces === "in-end" ? " · +end" : ""} ·{" "}
                <b className="xdel" onClick={() => setExtraWalls((xs) => xs.filter((x) => x.id !== w.id))}>×</b></span>
            </div>
          ))}
        </div>
        <div className="addchips" style={{ paddingTop: 5 }}>
          <button className={"addchip" + (placing ? " on" : "")} disabled={!pan} onClick={() => {
            const next = !placing;
            setPlacing(next);
            if (next) say("Click an edge on the drawing to add a wall — an open corner toggles a corner cut");
          }}>{placing ? "Click an edge on the drawing…" : "+ Add wall"}</button>
          <button className={"addchip" + (allCut ? " on" : "")} disabled={!openList.length}
            title="cut the pan at every corner not boxed in by walls — straight to a nearby wall end, 45° otherwise; single corners click on the drawing"
            onClick={() => setCorners((o) => {
              const n = { ...o };
              openList.forEach((c) => { n[c[0]] = !allCut; });
              return n;
            })}>✂ {allCut ? "Uncut corners" : "Cut open corners"}</button>
          {cornerOn.length > 0 && (
            <span className="wu" style={{ fontSize: "9.5px", alignSelf: "center" }}>corner cuts: {cornerOn.map((c) => c[1]).join(", ")}</span>
          )}
          <span className="wdefh">Default height
            <NumIn className="win" value={wallH} title="the height every wall starts at, in" onCommit={(v) => setWallH(+v || 96)} />in
          </span>
        </div>
      </>
    );
  })();

  const customTab = (() => {
    const sel = option && results.includes(option) ? option : null;
    const tileEats = maxIn && inp.curb !== "curbless";
    return (
      <>
        <div className="roomform">
          <div className="rfgrid">
            <div className="rfgrp wide">
              <div className="h">Size &amp; curb</div>
              <div className="rfflow">
                <div className="rf"><label>Shower size</label>
                  <div className="dims">
                    <NumIn className="rinp" value={inp.w} onCommit={(v) => setInput({ w: +v || 0 })} />
                    <span>×</span>
                    <NumIn className="rinp" value={inp.d} onCommit={(v) => setInput({ d: +v || 0 })} />
                    <span>in</span>
                  </div>
                </div>
                <div className="rf"><label>Curb</label>
                  <div className="rseg">
                    {["curbed", "curbless"].map((v) => (
                      <button key={v} className={inp.curb === v ? "on" : ""} onClick={() => setInput({ curb: v })}>{v[0].toUpperCase() + v.slice(1)}</button>
                    ))}
                  </div>
                </div>
                {/* Disabled, not just dimmed, wherever it can't bite (owner
                    2026-08-03): a box that takes a number and does nothing with
                    it is worse than no box. Its own tooltip says which switch
                    turns it on. */}
                <div className={"rf" + (tileEats ? "" : " dim")} title={tileEats
                  ? "what the finished tile adds on the curb's outer face — the curb steps that much further inside the stated line so the tiled face lands on it"
                  : inp.curb === "curbless"
                    ? "a curbless shower has no curb face to tile — nothing to hold back"
                    : 'only matters on "Max — curb inside": with the numbers read as the pan, the curb and its tile land outside them anyway'}>
                  <label>Tile thickness</label>
                  <div className="dims">
                    <NumIn className="rinp tin" disabled={!tileEats} placeholder={tileEats ? "0 or 3/8" : "—"} value={tileT}
                      onCommit={(v) => { const n = parseIn(v); setTileT(n ? String(n) : ""); }} />
                    <span>in</span>
                  </div>
                </div>
                <div className="rf"><label>Sizes are</label>
                  <div className="rseg">
                    <button className={!maxIn ? "on" : ""} title="the pan's size — a curb adds its width outside the line"
                      onClick={() => setMaxMode(false)}>Pan size</button>
                    <button className={maxIn ? "on" : ""}
                      title={'the overall footprint — every open edge pulls its curb inside the line and the pan gives up its width (the curb laps ½" onto the pan)'}
                      onClick={() => setMaxMode(true)}>Max — curb inside</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="rfgrp">
              <div className="h">Drain</div>
              <div className="rfflow">
                <div className="rf"><label>Preference</label>
                  <div className="rseg">
                    {["any", "center", "offset", "linear"].map((v) => (
                      <button key={v} className={inp.drain === v ? "on" : ""} onClick={() => setInput({ drain: v })}>{v[0].toUpperCase() + v.slice(1)}</button>
                    ))}
                  </div>
                </div>
                <div className="rf"><label>Drain — from left × back</label>
                  <div className="dims">
                    <NumIn className="rinp" placeholder="auto" value={inp.drainX} onCommit={(v) => setInput({ drainX: v.trim() })} />
                    <span>×</span>
                    <NumIn className="rinp" placeholder="auto" value={inp.drainY} onCommit={(v) => setInput({ drainY: v.trim() })} />
                    <span>in</span>
                  </div>
                </div>
                <div className="rf"><label>Pan against</label>
                  <div className="rseg">
                    <button className={inp.anchor !== "right" ? "on" : ""} onClick={() => setInput({ anchor: "left" })}>Left</button>
                    <button className={inp.anchor === "right" ? "on" : ""} onClick={() => setInput({ anchor: "right" })}>Right</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="rfgrp span">
              <div className="h rowh">Walls
                <span className="wallctl">
                  <button className="wtgl" disabled={!pan}
                    title={option ? "rotate the room — width ↔ depth, drain position follows, re-solves" : "swap which side is the back (long ↔ short)"}
                    onClick={() => {
                      if (option) {
                        const next = { ...inp, w: +inp.d || 0, d: +inp.w || 0, drainX: inp.drainY, drainY: inp.drainX };
                        setInp(next);
                        runSolve(next);
                      } else { retuneWalls(); setWallFlip((v) => !v); }
                    }}>⇄</button>
                </span>
              </div>
              {wallEditor}
            </div>
          </div>
        </div>

        {!results.length ? (
          <div className="nores">
            No option fits {inch(inp.w)}″ × {inch(inp.d)}″ {inp.curb}
            {inp.drain !== "any" ? " with a " + inp.drain + " drain" : ""} — extensions reach{" "}
            {inp.curb === "curbless" ? "24″" : "36″"} past the biggest pan.
          </div>
        ) : (<>
          <div className="optrow">
            {results.map((o, k) => {
              const kit = kitFor(o.pan.key, { option: o, walls: wallsArr(o.pan, o.room) });
              const floor = round2(o.floorLines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
              const full = kit ? kit.lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0) : 0;
              return (
                <button key={o.id + k} className={"optcard" + (sel === o ? " on" : "")} onClick={() => selectOption(k)} data-wedi-opt={k}>
                  <div className="bdg">{o.badges.map((b, bi) => (
                    <span key={b + bi} className={"badge" + (bi === 0 && /Cheapest|Perfect/.test(b) ? " hot" : "")}>{b}</span>
                  ))}</div>
                  <div className="t">{o.title}</div>
                  <div className="p" style={{ color: tierColor }}>{fm(floor)}<small>floor · full kit {fm0(full)}</small></div>
                  <div className="wrn">{o.warnings.length ? "⚠ " + o.warnings[0].split(" — ")[0] : " "}</div>
                  <div className="thumb"><TopDown o={o} w={120} h={86} mini wallOn={wallOnMap} /></div>
                </button>
              );
            })}
          </div>
          {sel && (
            <div className="warnlist">
              {sel.pieces.filter((p) => p.cut).map((p, i) => (
                <div className="warnrow" key={"cut" + i}><span className="ic">✂</span>
                  <span>Cut {p.item.us || p.item.erp} to {inch(p.w)}″ × {inch(p.d)}″ (from {inch(p.cut.w)}″ × {inch(p.cut.d)}″)
                    {p.kind === "pan" ? "" : " — trim the thick edge; the slope lands on the pan"}</span>
                </div>
              ))}
              {CORNER_LBL.filter((c) => corners[c[0]]).map((c) => {
                const d = curb.cuts.find((x) => x.corner === c[0]);
                const legs = d ? inch(d.h) + "″ × " + inch(d.v) + "″" : "12″ × 12″";
                const even = !d || d.h === d.v;
                return (
                  <div className="warnrow" key={"cc" + c[0]}><span className="ic">✂</span>
                    <span>Corner cut at {c[1]} — {legs} legs{even ? " (45°)" : ", straight to the wall end"}; cut the pan on site, glass or framing runs the line</span>
                  </div>
                );
              })}
              {sel.warnings.map((wt, i) => (
                <div className={"warnrow" + (/re-create|re-formed|mitre|off the room/.test(wt) ? " bad" : "")} key={"w" + i}>
                  <span className="ic">•</span><span>{wt}</span>
                </div>
              ))}
              {sel.drain && sel.drain.note && <div className="warnrow"><span className="ic">•</span><span>{sel.drain.note}</span></div>}
            </div>
          )}
        </>)}
      </>
    );
  })();

  const browseTab = (() => {
    const sfDefault = build ? build.panelSf : 0;
    const sf = figSf === "" ? sfDefault : +figSf || 0;
    const fig = figureConsumables(sf, opts.sealantForm);
    const activeSec = BROWSE_SECTIONS.find((s) => s.key === sec) || null;
    const activeSub = activeSec && activeSec.subs ? activeSec.subs.find((s) => s.key === sub) || null : null;
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = cat.filter((e) => {
      if (source === "stock" && !e.stock) return false;   // the switch as a hard constraint (P2)
      if (sec === "starred" && !starred.has(e.key)) return false;
      if (activeSec && !(activeSub ? activeSub.hit(e) : sectionHit(activeSec, e))) return false;
      if (!toks.length) return true;
      const hay = (e.name + " " + e.us + " " + e.erp + " " + e.desc + " " + (GROUP_LABEL[e.group] || "") + " " + e.sizeText).toLowerCase();
      return toks.every((t) => hay.indexOf(t) >= 0);
    }).sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || (a.group > b.group ? 1 : a.group < b.group ? -1 : 0) || a.retail - b.retail);
    const MAX = 48;
    const addFigured = () => {
      let next = manual.slice();
      fig.lines.forEach((l) => {
        const cur = qtyIn(l.item.key);
        if (cur >= l.qty) return;
        const need = l.qty - cur;
        const m = next.find((x) => x.key === l.item.key);
        next = m ? next.map((x) => (x === m ? { ...x, qty: x.qty + need } : x)) : [...next, { key: l.item.key, qty: need }];
      });
      setManual(next);
      say("Sealant + fasteners added for " + sf + " sf");
    };
    return (
      <>
        <div className="browsebar">
          <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the wedi catalog — name, SKU, group…" />
          <button className={"gchip" + (figOpen ? " on" : "")} style={{ flex: "none" }}
            onClick={() => setFigOpen((v) => !v)}>Figure sealant &amp; fasteners</button>
        </div>
        {figOpen && (
          <div className="figcard">
            <div className="fr">
              Panel area <NumIn className="inp" value={figSf === "" ? (sfDefault ? String(sfDefault) : "") : figSf}
                placeholder={String(sfDefault || "sf")} onCommit={(v) => setFigSf(v)} /> sf
              {" · "}
              <span className="seg" style={{ display: "inline-flex" }}>
                <button className={opts.sealantForm === "tube" ? "on" : ""} onClick={() => setOpts((o) => ({ ...o, sealantForm: "tube" }))}>10.5 oz tube</button>
                <button className={opts.sealantForm === "sausage" ? "on" : ""} onClick={() => setOpts((o) => ({ ...o, sealantForm: "sausage" }))}>20 oz sausage</button>
              </span>
              {sf > 0 && (<>
                {" → "}<b>{fig.fastenerCount}</b> fasteners = <b>{fig.lines[0].qty}</b> kit{fig.lines[0].qty > 1 ? "s" : ""}
                {" · "}<b>{fig.sealantOz}</b> oz = <b>{fig.lines[1].qty}</b> {opts.sealantForm === "tube" ? "tubes" : "sausages"}
                <button className="wbtn" style={{ flex: "none", padding: "5px 10px", marginLeft: 6 }} onClick={addFigured}>Add to build</button>
              </>)}
            </div>
            <div className="figfoot">wedi's own planning rates: 1 screw + washer per ft² of panel · 1.2 oz sealant per ft² — Illustrated Price List pp. 19–21 · spacing 12″ walls / 6″ ceilings</div>
          </div>
        )}
        {/* The filter board (owner sketch 2026-07-30): the project header's
            column cards — each section a labeled column of stacked rows, the
            quick filters their own boxes down the right. One thing active at
            a time; clicking it again returns to All. */}
        <div className="seccols">
          {BROWSE_SECTIONS.filter((s) => s.subs).map((s) => {
            const secOn = sec === s.key && !sub;
            return (
              <div className="ft-hcol" style={{ minWidth: 116 }} key={s.key}>
                <button className="ft-hhead w-full text-left cursor-pointer"
                  style={secOn ? { background: "var(--ft-text)", color: "var(--ft-cream)" } : undefined}
                  title={"everything in " + s.label}
                  onClick={() => { const off = secOn; setSec(off ? "" : s.key); setSub(""); }}>
                  {s.label}<small>{cat.filter((e) => sectionHit(s, e)).length}</small>
                </button>
                {s.subs.map((sb) => {
                  const on = sec === s.key && sub === sb.key;
                  return (
                    <button key={sb.key} className={"ft-hopt" + (on ? " on bg-indigo-600" : "")}
                      onClick={() => { setSec(on ? "" : s.key); setSub(on ? "" : sb.key); }}>
                      {sb.label}<small>{cat.filter(sb.hit).length}</small>
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div className="quickstack">
            {BROWSE_SECTIONS.filter((s) => !s.subs).map((s) => {
              const on = sec === s.key;
              return (
                <div className="ft-hcol" key={s.key}>
                  <button className={"ft-hopt" + (on ? " on bg-indigo-600" : "")}
                    onClick={() => { setSec(on ? "" : s.key); setSub(""); }}>
                    {s.label}<small>{cat.filter((e) => sectionHit(s, e)).length}</small>
                  </button>
                </div>
              );
            })}
            <div className="ft-hcol">
              <button className={"ft-hopt" + (!sec ? " on bg-indigo-600" : "")} onClick={() => { setSec(""); setSub(""); }}>
                All<small>{cat.length}</small>
              </button>
            </div>
            <div className="ft-hcol">
              <button className={"ft-hopt" + (sec === "starred" ? " on bg-indigo-600" : "")}
                title="items pinned with the row star"
                onClick={() => { setSec(sec === "starred" ? "" : "starred"); setSub(""); }}>
                ★ Starred<small>{starred.size}</small>
              </button>
            </div>
          </div>
        </div>
        {list.slice(0, MAX).map((e) => {
          const n = qtyIn(e.key);
          // Cover FRAMES lead with what the buyer picks by — Size · Type ·
          // COLOR (color a shade bolder) — the vendor name drops to the small
          // line (owner ask 2026-07-30). Covers themselves say all three in
          // their catalog name now (owner 2026-08-06), so they read generic.
          const cf = e.group === "coverFrame" && finName(e);
          // Two lines, not one (owner 2026-08-02): the description owns the full
          // column width and the SKU / price / quantity sit under it. Sharing one
          // line with them left ~170px for a name once the columns went equal,
          // which truncated nearly everything to "Subli…".
          return (
            <div className={"brow" + (e.stock ? " stk" : "")} key={e.key}>
              <div className="bn" title={[unwedi(e.name), e.sizeText, e.stock ? e.erp : e.us].filter(Boolean).join(" · ")}>
                <span className={"sdot" + (e.stock ? "" : " so")} title={e.stock ? "stocked" : "special order"} />
                {cf
                  ? <div className="n"><FinDot e={e} />{e.sizeText} · {e.sub === "linear" ? "Linear" : "Square"} · <b style={{ fontWeight: 800 }}>{finName(e)}</b></div>
                  : <div className="n"><FinDot e={e} />{sizeLed(e) ? unwedi(e.name) : [e.sizeText, browseName(e)].filter(Boolean).join(" · ")}</div>}
              </div>
              <div className="bmeta">
                <div className="s">{cf ? unwedi(e.name) + (e.stock ? " · stock" : " · special order") : browseSub(e)}</div>
                <div className="sku">{e.stock ? e.erp : e.us}</div>
                <button className={"starb" + (starred.has(e.key) ? " on" : "")}
                  title={starred.has(e.key) ? "unpin from Starred" : "pin to Starred"}
                  onClick={() => toggleStar(e.key)}>{starred.has(e.key) ? "★" : "☆"}</button>
                <div className="pr" style={{ color: tierColor }}>{fm(tierOf(e))}<small>{tierId !== "retail" ? "retail " + fm(e.retail) : " "}</small></div>
                <div className="stepper">
                  <button onClick={() => step(e.key, -1)}>−</button>
                  <span className={"q" + (n ? "" : " zero")}>{n}</span>
                  <button onClick={() => step(e.key, 1)}>+</button>
                </div>
              </div>
            </div>
          );
        })}
        {list.length > MAX && <div className="more">{list.length - MAX} more — narrow the search or pick a section chip</div>}
        {sec === "starred" && !starred.size && (
          <div className="nores">Nothing starred yet — the ☆ on any row pins it here.</div>
        )}
      </>
    );
  })();

  // --- build column ---------------------------------------------------------
  const buildCol = (() => {
    if (!build) return (
      <>
        <div className="bc-scroll">
          <div className="bc-h"><div className="t">The build</div></div>
          <div className="bc-empty">Nothing yet.<br /><br />Click a pan card to assemble its house kit, solve a custom shower, or step items in from Browse.</div>
        </div>
        <div className="bc-foot">
          <div className="btnrow">
            <button className="wbtn primary" disabled>Add to product lines</button>
            <button className="wbtn" disabled>Print</button>
            <button className="wbtn" disabled>Order entry</button>
          </div>
        </div>
      </>
    );
    return (
      <>
        <div className="bc-scroll">
          <div className="bc-h">
            <div className="t">The build</div>
            <div className="sub">{pan ? (option ? option.title : unwedi(pan.name)) : "manual — from Browse"}</div>
          </div>

          {BUCKETS.map((bk) => {
            const lines = build.lines.filter((l) => l.group === bk[0]);
            const isAddon = bk[0] === "addon";
            if (!lines.length && !isAddon) return null;
            return (
              <div className="bgroup" key={bk[0]}>
                <div className="bg-h">{bk[1]}
                  {bk[0] === "walls" && (
                    <span className="wallctl">
                      <span className="pfseg">
                        <button className={panelFit ? "on" : ""} title="mixed sheet sizes, level courses, minimal vertical seams" onClick={() => setPanelFit(true)}>Fit</button>
                        <button className={!panelFit ? "on" : ""} title="one sheet size, by area" onClick={() => setPanelFit(false)}>One size</button>
                      </span>
                    </span>
                  )}
                </div>
                {lines.map((l) => {
                  const e = l.item;
                  const price = tierOf(e);
                  const can = e.group === "panel" && panelFit ? null : swapChoices(l);
                  return (
                    <div className="bline" key={e.key + l.group}>
                      <div className="bn">
                        <div className="n"><FinDot e={e} />{unwedi(e.name)}</div>
                        {(() => {
                          // Contents lead, the auto note follows — the line truncates from
                          // the right, and "100 ct" is the part that must survive it.
                          const meta = [finName(e) || e.sizeText, l.note].filter(Boolean);
                          return (
                            <div className="m" title={meta.join(" · ") || undefined}><b>{e.stock ? e.erp : "SO " + e.us}</b>
                              {meta.map((s) => " · " + s).join("")}</div>
                          );
                        })()}
                      </div>
                      {can && <button className="swapb" title="swap" onClick={(ev) => setSwap({ key: e.key, rect: ev.currentTarget.getBoundingClientRect() })}>⇄</button>}
                      <div className="stepper">
                        <button onClick={() => step(e.key, -1)}>−</button>
                        <span className={"q" + (l.ov ? " ov" : "")} title={l.ov ? "hand-set — auto is " + l.autoQty : undefined}>{l.qty}</span>
                        <button onClick={() => step(e.key, 1)}>+</button>
                      </div>
                      <div className="lp" style={{ color: tierColor }}>{fm(round2(price * l.qty))}
                        <small>{fm(price)}{e.unit && e.unit !== "EA" ? "/" + e.unit.toLowerCase() : " ea"}</small></div>
                    </div>
                  );
                })}
                {isAddon && pan && (
                  <div className="addchips">
                    {ADDON_CHIPS.filter((ac) => (ac[0] === "recess" ? pan && pan.sub === "curbless"
                      : ac[0] === "coverFrame" ? frameOpts.length > 0 : true)).map((ac) => {
                      const on = ac[0] === "gun" ? build.lines.some((l) => l.item.key === SKU.gun)
                        : ac[0] === "recess" ? build.lines.some((l) => l.item.group === "recess" || l.item.group === "ramp")
                          : build.lines.some((l) => l.item.group === ac[0]);
                      return (
                        <button key={ac[0]} className={"addchip" + (on ? " on" : "")} onClick={(ev) => {
                          if (ac[0] === "gun") { setAddons((a) => (a.includes(SKU.gun) ? a.filter((k) => k !== SKU.gun) : [...a, SKU.gun])); return; }
                          const cur = build.lines.find((l) => ac[0] === "recess"
                            ? l.item.group === "recess" || l.item.group === "ramp" : l.item.group === ac[0]);
                          if (cur) {
                            if (ac[0] === "recess") setOpts((o) => ({ ...o, recess: "none" }));
                            else if (ac[0] === "coverFrame") setOpts((o) => ({ ...o, coverFrame: undefined }));
                            else {
                              setAddons((a) => a.filter((k) => { const it = item(k); return !it || it.group !== ac[0]; }));
                              setManual((mm) => mm.filter((m) => { const it = item(m.key); return !it || it.group !== ac[0]; }));
                            }
                            setQtyOv((o) => { const n = { ...o }; delete n[cur.item.key]; return n; });
                          } else {
                            const ch = chipChoices(ac[0]).filter(Boolean);
                            if (ch.length > 1) setChipMenu({ group: ac[0], label: ac[1], rect: ev.currentTarget.getBoundingClientRect() });
                            else if (ch.length) chipPick(ac[0], ch[0].key);
                          }
                        }}>{(on ? "✓ " : "+ ") + ac[1]}</button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {build.hints.includes("sausage-gun") && (
            <div className="whint">Sausage sealant with no gun on the job
              <button onClick={() => setAddons((a) => (a.includes(SKU.gun) ? a : [...a, SKU.gun]))}>Add gun {fm(tierOf(item(SKU.gun)))}</button>
            </div>
          )}
          {build.hints.includes("small-order") && (
            <div className="whint">Special-order net {fm(build.soNet)} runs under wedi's $500 minimum — 10% small-order handling applies</div>
          )}

        </div>

        <div className="bc-foot">
          <div className="totrow">
            {tierId === "retail"
              ? <div><div className="k">Lines</div><div className="v">{build.lines.length}</div></div>
              : <div><div className="k">Retail</div><div className="v">{fm(totals.retail)}</div></div>}
            <div className="sell">
              <div className="k">{tierId}{tierId === "builder" ? " × " + bMult.toFixed(2) : ""}</div>
              <div className="v" style={{ color: tierColor }} data-wedi-sell>{fm(totals.sell)}</div>
            </div>
          </div>
          <button type="button" className="marginrow" onClick={() => setShowMargin((v) => !v)}
            title={showMargin ? "Hide cost & margin" : "Show cost & margin"}>
            {showMargin
              ? <>cost {fm(totals.cost)}<span>margin {fm(totals.margin)} · {totals.sell ? Math.round(totals.margin / totals.sell * 100) : 0}%</span></>
              : <><Eye size={11} /> cost &amp; margin</>}
          </button>
          <div className="btnrow">
            <button className="wbtn primary" onClick={() => setPayload(rows)} data-wedi-add><Plus size={13} /> Add to product lines</button>
            <button className="wbtn" disabled={!diag} onClick={() => setPrinting(true)}><Printer size={13} /> Print layout</button>
            <button className="wbtn" onClick={copyList}><Copy size={13} /> Order entry</button>
          </div>
        </div>
      </>
    );
  })();

  const diagRail = (
    <div className="diagcol" ref={railRef}>
      {!diag ? (<>
        <div className="dc-h">The shower</div>
        <div className="dc-empty">Pick a pan or solve a custom shower — the drawings render here for whatever is selected.</div>
      </>) : (<>
        {placing && <div className="dc-hint">Click an edge to add a wall — an open corner toggles a corner cut</div>}
        <TopDown o={drawDiag} w={railFit.w} h={railFit.plan} wallOn={wallOnMap} dWalls={dWalls} benches={(build && build.benches) || []}
          framedFit={!!(build && build.panPlan)} itemFn={item} normBenchFn={normBench}
          cuts={curb.cuts} curbs={curb.segs} curbDiags={curb.diags} curbW={curb.w} placing={placing}
          onBenchMenu={(z, x, y) => setBenchMenu({ ...z, x, y })}
          onWallMenu={(ref, x, y) => setWallMenu({ ...ref, x, y })}
          onCorner={(c) => {
            if (cornerOpenMap && !cornerOpenMap[c]) { say("That corner sits between two walls — shorten or turn one off to cut it"); return; }
            setCorners((o) => ({ ...o, [c]: !o[c] }));
            setPlacing(false);
          }}
          onEdge={(edge, geo) => {
            wallSeq.current += 1;
            const at = geo.at === "hi" ? "hi" : "lo";
            setExtraWalls((xs) => [...xs, {
              id: wallSeq.current, edge, at,
              len: String(round2(edge === "entry" ? Math.min(24, geo.rw) : edge === "back" ? geo.rw : geo.rd)),
              h: "", faces: "in",
            }]);
            setPlacing(false);
            say("Wall added on the " + edge + " side, returning from the "
              + ((edge === "back" || edge === "entry") ? (at === "hi" ? "right" : "left") : (at === "hi" ? "entry" : "back"))
              + " — set its length and height in the Walls group, or right-click it for both ends");
          }} />
        <Iso o={drawDiag} w={railFit.w} h={railFit.iso} dWalls={dWalls} panelFit={panelFit} benches={(build && build.benches) || []}
          framedFit={!!(build && build.panPlan)}
          cuts={curb.cuts} curbs={curb.segs} curbDiags={curb.diags} curbH={curb.h} curbW={curb.w}
          onWallMenu={(ref, x, y) => setWallMenu({ ...ref, x, y })} />
      </>)}
    </div>
  );

  const swapPanel = (() => {
    if (!swap || !build) return null;
    const line = build.lines.find((l) => l.item.key === swap.key);
    if (!line) return null;
    const ch = swapChoices(line);
    if (!ch) return null;
    const r = swap.rect;
    const style = { top: Math.min(window.innerHeight - 356, r.bottom + 6), left: Math.max(12, r.right - 300) };
    const choose = (k) => {
      setQtyOv((o) => { const n = { ...o }; delete n[line.item.key]; return n; });
      ch.set(k);
      setSwap(null);
    };
    // A portal still bubbles through the REACT tree, so without this a pick
    // would reach the popup's backdrop and read as "close the configurator".
    return createPortal(
      <div className="wedi-swap" style={style} onClick={(e) => e.stopPropagation()}>
        <div className="ph">{ch.title}</div>
        {ch.none && (
          <button className="srow" onClick={() => choose(null)}>
            <span className="sdot so" /><span className="n">{ch.none}</span><span className="p" />
          </button>
        )}
        {ch.list.map((e) => (
          <button key={e.key} className={"srow" + (e.key === line.item.key ? " on" : "") + (e.stock ? " stk" : "")} onClick={() => choose(e.key)}>
            <span className={"sdot" + (e.stock ? "" : " so")} />
            <span className="n"><FinDot e={e} />{unwedi(e.name)}
              <small>{[finName(e), e.sizeText, e.stock ? e.erp : "SO — " + e.us].filter(Boolean).join(" · ")}</small></span>
            <span className="p">{fm(tierOf(e))}</span>
          </button>
        ))}
      </div>, document.body);
  })();

  // The add-on chip picker: same anchored popover as a swap, listing the
  // chip's possible parts — a chip with one part never gets here.
  const chipPanel = (() => {
    if (!chipMenu) return null;
    const listC = chipChoices(chipMenu.group).filter(Boolean);
    const r = chipMenu.rect;
    const style = { top: Math.min(window.innerHeight - 356, r.bottom + 6), left: Math.max(12, Math.min(window.innerWidth - 312, r.left)) };
    return createPortal(
      <div className="wedi-swap wedi-chipmenu" style={style} onClick={(e) => e.stopPropagation()}>
        <div className="ph">{chipMenu.group === "recess" ? "Curbless entry" : GROUP_LABEL[chipMenu.group] || chipMenu.label}</div>
        {listC.map((e) => (
          <button key={e.key} className={"srow" + (e.stock ? " stk" : "")} onClick={() => chipPick(chipMenu.group, e.key)}>
            <span className={"sdot" + (e.stock ? "" : " so")} />
            <span className="n"><FinDot e={e} />{unwedi(e.name)}
              <small>{[finName(e), e.sizeText, e.stock ? e.erp : "SO — " + e.us].filter(Boolean).join(" · ")}</small></span>
            <span className="p">{fm(tierOf(e))}</span>
          </button>
        ))}
      </div>, document.body);
  })();

  // The right-click wall menu: size + which faces get wedi. Anchored at the
  // cursor, portalled like the swap popover; edits write straight into the
  // walls / extraWalls rows the build already reads.
  const wallMenuPanel = (() => {
    if (!wallMenu) return null;
    const row = wallMenu.extra ? extraWalls.find((x) => x.id === wallMenu.wid) : walls.find((x) => x.id === wallMenu.wid);
    if (!row) return null;
    const label = wallMenu.extra ? (EDGE_LBL[row.edge] || "Added").replace(" +", "") + " wall (added)" : row.label + " wall";
    const faces = row.faces || "in";
    const len = +row.len || (wallMenu.extra ? 0 : autoNow[row.id] || 0);
    const hh = +row.h || +wallH || 96;
    const upd = (patch) => (wallMenu.extra
      ? setExtraWalls((xs) => xs.map((x) => (x.id === wallMenu.wid ? { ...x, ...patch } : x)))
      : setWalls((ws) => ws.map((x) => (x.id === wallMenu.wid ? { ...x, ...patch } : x))));
    const style = {
      top: Math.min(window.innerHeight - 200, wallMenu.y + 4),
      left: Math.min(window.innerWidth - 292, Math.max(12, wallMenu.x - 120)),
    };
    return createPortal(
      <div className="wedi-swap wedi-wallmenu" style={style} data-wedi-wallmenu
        onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
        <div className="ph">{label} — {sfOfWall(len, hh, faces)} sf of wedi</div>
        <div className="wm-row">
          <label>Size</label>
          <NumIn className="win" value={row.len} placeholder={wallMenu.extra ? "" : String(autoNow[row.id] || "")} title="length, in"
            onCommit={(v) => upd({ len: v })} />
          <span>×</span>
          <NumIn className="win" value={row.h} placeholder={String(wallH)} title="height, in" onCommit={(v) => upd({ h: v })} />
          <span>in</span>
        </div>
        {wallMenu.extra && (() => {
          const horiz = row.edge === "back" || row.edge === "entry";
          const at = row.at === "hi" ? "hi" : "lo";
          const twin = extraWalls.some((x) => x.edge === row.edge && x.id !== row.id && (x.at === "hi" ? "hi" : "lo") !== at);
          return (
            <div className="wm-row">
              <label>End</label>
              <span className="pfseg">
                <button className={at === "lo" ? "on" : ""} title={horiz ? "return from the left side wall" : "run from the back wall"}
                  onClick={() => upd({ at: "lo" })}>{horiz ? "Left" : "Back"}</button>
                <button className={at === "hi" ? "on" : ""} title={horiz ? "return from the right side wall" : "run from the entry"}
                  onClick={() => upd({ at: "hi" })}>{horiz ? "Right" : "Entry"}</button>
              </span>
              <button className="wm-act" disabled={twin} title={twin
                ? "there is already a wall on the other end of this edge"
                : "add the matching wall on the other end — two returns with the walk-in between them"}
                onClick={() => {
                  wallSeq.current += 1;
                  const mirror = { ...row, id: wallSeq.current, at: at === "hi" ? "lo" : "hi" };
                  setExtraWalls((xs) => [...xs, mirror]);
                  setWallMenu(null);
                  say("Matching wall added on the other end — the walk-in is what is left between them");
                }}>Both ends</button>
            </div>
          );
        })()}
        <div className="wm-row">
          <label>wedi</label>
          <span className="pfseg">
            <button className={faces === "in" ? "on" : ""} title="panel the inside face only" onClick={() => upd({ faces: "in" })}>Inside</button>
            <button className={faces === "both" ? "on" : ""} title="panel both sides" onClick={() => upd({ faces: "both" })}>Both sides</button>
            <button className={faces === "in-end" ? "on" : ""} title={'inside plus the exposed 4" end of the run'} onClick={() => upd({ faces: "in-end" })}>In + end</button>
          </span>
        </div>
        <div className="wm-note">
          {faces === "both" ? "both faces panel — this wall's wedi area doubles"
            : faces === "in-end" ? 'the exposed 4" end takes a wedi strip too'
              : "wedi on the shower side only"}
        </div>
        <div className="wm-row" style={{ paddingTop: 7, gap: 8 }}>
          <button className="wm-act" title="remove the wall — the curb runs this edge instead, butted square to the standing walls and figured at its longest point"
            onClick={() => {
              if (wallMenu.extra) setExtraWalls((xs) => xs.filter((x) => x.id !== wallMenu.wid));
              else setWalls((ws) => ws.map((x) => (x.id === wallMenu.wid ? { ...x, on: false, len: "", h: "", faces: "in" } : x)));
              if (build && !build.lines.some((l) => l.item.group === "curb"))
                setOpts((o) => ({ ...o, curbKey: pan && pan.sub === "curbless" ? SKU.curbLean60 : undefined }));
              setWallMenu(null);
              say("Wall turned into a curb — the run butts the walls square, figured at its longest point");
            }}>Turn into a curb</button>
          {wallMenu.extra && (
            <button className="wm-del" onClick={() => { setExtraWalls((xs) => xs.filter((x) => x.id !== wallMenu.wid)); setWallMenu(null); }}>
              Remove</button>
          )}
        </div>
      </div>, document.body);
  })();

  // The bench menu (issue 069): everything about the zone's bench lives in
  // this one popover — premade vs built, sizes, the framed pan choice —
  // anchored at the click like the wall menu.
  const benchMenuPanel = (() => {
    if (!benchMenu) return null;
    const zid = benchMenu.side || benchMenu.corner;
    const row = benches.find((b) => b.kind === benchMenu.kind && (b.side || b.corner) === zid);
    const room = diag ? diag.room : { w: 60, d: 36 };
    const title = benchMenu.kind === "corner"
      ? "Corner bench — " + (BENCH_CORNER_LBL[benchMenu.corner] || "")
      : "Bench — " + benchMenu.side + " wall";
    const style = {
      top: Math.min(window.innerHeight - 320, benchMenu.y + 4),
      left: Math.min(window.innerWidth - 312, Math.max(12, benchMenu.x - 140)),
    };
    const add = (spec) => setBenches((xs) => [...xs, {
      kind: benchMenu.kind,
      ...(benchMenu.kind === "corner" ? { corner: benchMenu.corner } : { side: benchMenu.side }),
      ...spec,
    }]);
    const upd = (patch) => setBenches((xs) => xs.map((b) => (b === row ? { ...b, ...patch } : b)));
    const del = () => { setBenches((xs) => xs.filter((b) => b !== row)); setBenchMenu(null); };
    const norm = row ? normBench(row, room) : null;
    const pres = bySource(benchPremades(benchMenu.kind === "corner" ? "corner" : "wall"));
    // The pricelist's first sentence says what the piece IS — "Suspended
    // Corner Seat", "Floor-mounted Triangular Corner Shower Bench Kit".
    const blurb = (e) => String(e.details || "").split(". ")[0].replace(/\.$/, "");
    const framedPanNote = (() => {
      if (!pan || !norm || norm.build !== "framed") return "";
      const pr = benchPanRoom([norm], room);
      if (norm.panFit === "smaller") {
        const pl = benchPanPlan(pan, [norm], room);
        if (pl) {
          const p2 = pl.option.pan;
          return "re-solves the clear " + inch(pl.clear.w) + "×" + inch(pl.clear.d) + '" space — '
            + inch(Math.max(p2.w, p2.d)) + "×" + inch(Math.min(p2.w, p2.d)) + '" pan ('
            + (p2.stock ? p2.erp : "SO — " + p2.us) + "), drain centered";
        }
        const sw = smallerPanFor(pan, pr.w, pr.d);
        return sw
          ? "swaps to the " + inch(Math.max(sw.w, sw.d)) + "×" + inch(Math.min(sw.w, sw.d)) + '" pan (' + (sw.stock ? sw.erp : "SO — " + sw.us) + ")"
          : "no smaller pan fits — the current one cuts to " + inch(pr.w) + "×" + inch(pr.d) + '"';
      }
      return "the pan cuts to " + inch(pr.w) + "×" + inch(pr.d) + '" and the bench sits on the subfloor';
    })();
    return createPortal(
      <div className="wedi-swap wedi-wallmenu wedi-benchmenu" style={style} data-wedi-benchmenu
        onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
        <div className="ph">{title}</div>
        {!row ? (<>
          <button className="bm-opt" onClick={() => add({ build: "site" })}>
            <b>wedi 2″ build-up</b><small>the pan runs underneath — 2″ top &amp; face, a support about every foot</small>
          </button>
          {benchMenu.kind !== "corner" && (
            <button className="bm-opt" onClick={() => add({ build: "framed" })}>
              <b>Framed by the installer</b><small>wrapped with ½″ panel — the pan butts the bench: cut it down, or solve a smaller pan with the drain centered</small>
            </button>
          )}
          <div className="ph">Premade wedi benches</div>
          {pres.map((e) => (
            <button key={e.key} className={"srow" + (e.stock ? " stk" : "")} onClick={() => add({ part: e.key })}>
              <span className={"sdot" + (e.stock ? "" : " so")} />
              <span className="n">{unwedi(e.name)}<small>{[blurb(e), e.sizeText, e.stock ? e.erp : "SO — " + e.us].filter(Boolean).join(" · ")}</small></span>
              <span className="p">{fm(tierOf(e))}</span>
            </button>
          ))}
        </>) : (<>
          {norm.build !== "premade" && norm.kind === "corner" && (
            <div className="wm-row">
              <label>Legs</label>
              <NumIn className="win" value={row.size ?? ""} placeholder={String(norm.size)} title="from the corner out along each wall, in" onCommit={(v) => upd({ size: v })} />
              <span>× h</span>
              <NumIn className="win" value={row.h ?? ""} placeholder={String(norm.h)} title="to the top, in" onCommit={(v) => upd({ h: v })} />
              <span>in</span>
            </div>
          )}
          {norm.build !== "premade" && norm.kind !== "corner" && (
            <div className="wm-row">
              <label>Size</label>
              <NumIn className="win" value={row.len ?? ""} placeholder={String(norm.len)} title="length along the wall, in" onCommit={(v) => upd({ len: v })} />
              <span>×</span>
              <NumIn className="win" value={row.depth ?? ""} placeholder={String(norm.depth)} title="seat depth, in" onCommit={(v) => upd({ depth: v })} />
              <span>×</span>
              <NumIn className="win" value={row.h ?? ""} placeholder={String(norm.h)} title="to the top, in" onCommit={(v) => upd({ h: v })} />
              <span>in</span>
            </div>
          )}
          {norm.build === "premade" && (
            <div className="wm-note">
              {unwedi((item(row.part) || {}).name || "")}{(item(row.part) || {}).sizeText ? " — " + item(row.part).sizeText : ""}
              {norm.kind === "corner" ? ". " + inch(norm.size) + '" out along each wall, triangle across the front.' : "."}
              {norm.suspended ? " Suspended — hangs on the walls, " + inch(norm.thick) + "″ thick slab, top at " + inch(norm.h) + "″, floor clear beneath." : ""}
            </div>
          )}
          {norm.build !== "premade" && norm.kind !== "corner" && (
            <div className="wm-row">
              <label>Build</label>
              <span className="pfseg">
                <button className={norm.build === "site" ? "on" : ""} title='2" wedi material — the pan runs underneath' onClick={() => upd({ build: "site" })}>2″ build-up</button>
                <button className={norm.build === "framed" ? "on" : ""} title='installer-framed, wrapped with ½" panel — the pan stops at its face' onClick={() => upd({ build: "framed" })}>Framed</button>
              </span>
            </div>
          )}
          {norm.build !== "premade" && norm.build === "framed" && (
            <div className="wm-row">
              <label>Pan</label>
              <span className="pfseg">
                <button className={norm.panFit !== "smaller" ? "on" : ""} onClick={() => upd({ panFit: "cut" })}>Cut it down</button>
                <button className={norm.panFit === "smaller" ? "on" : ""} onClick={() => upd({ panFit: "smaller" })}>Smaller pan</button>
              </span>
            </div>
          )}
          {norm.build !== "premade" && (
            <div className="wm-note">
              {norm.build === "framed" ? framedPanNote
                : norm.kind === "corner" ? inch(norm.size) + '" out along each wall, triangle across the front — 2" top, face & supports, sealant figured in'
                  : '2" top & face with a support about every foot; the pan runs underneath'}
            </div>
          )}
          <div className="wm-row" style={{ paddingTop: 7 }}>
            <button className="wm-del" onClick={del}>Remove bench</button>
          </div>
        </>)}
      </div>, document.body);
  })();

  // Kit card over a custom shower: confirm before wiping it (owner rule
  // 2026-07-30) — yes resets everything to the chosen kit's stock setup.
  const confirmModal = confirmPan && (() => {
    const p = item(confirmPan);
    const nm = p ? (p.group === "module" ? inch(p.len) + '" module' : inch(p.w) + "×" + inch(p.d)) : "";
    return (
      <div className="print:hidden fixed inset-0 z-[80] flex items-center justify-center p-8" style={{ background: "rgba(20,15,10,.5)" }}
        onClick={(e) => { e.stopPropagation(); setConfirmPan(null); }}>
        <div className="wedi-pop w-full max-w-[460px] rounded-xl overflow-hidden shadow-2xl" style={{ background: "var(--ft-cream)" }}
          onClick={(e) => e.stopPropagation()} data-wedi-overwrite>
          <div className="px-5 pt-4 pb-1 text-[14px] font-extrabold">Overwrite the custom shower?</div>
          <div className="px-5 pb-4 text-[12px] leading-relaxed" style={{ color: "var(--ft-muted)" }}>
            This build has been customized — walls, cuts, or parts differ from a stock kit. Starting the{" "}
            <b style={{ color: "var(--ft-text)" }}>{nm}</b> kit resets all of it.
          </div>
          <div className="flex gap-2 px-5 py-3 border-t" style={{ borderColor: "var(--ft-border-strong)", background: "var(--ft-sand)" }}>
            <button className="wbtn" onClick={() => setConfirmPan(null)}>Keep the custom shower</button>
            <button className="wbtn primary" data-wedi-overwrite-yes
              onClick={() => { hardReset(confirmPan); setConfirmPan(null); }}>Overwrite — start the kit</button>
          </div>
        </div>
      </div>
    );
  })();

  const payloadModal = payload && (
    // Stop the click here: this backdrop sits inside the popup's own backdrop,
    // which would otherwise read the same press as "close the configurator".
    <div className="print:hidden fixed inset-0 z-[80] flex items-center justify-center p-8" style={{ background: "rgba(20,15,10,.5)" }}
      onClick={(e) => { e.stopPropagation(); setPayload(null); }}>
      <div className="wedi-pop w-full max-w-[900px] max-h-[82vh] flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{ background: "var(--ft-cream)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: "var(--ft-border-strong)" }}>
          <div className="text-sm font-extrabold">Add to product lines — the payload</div>
          <div className="text-[11px] font-semibold text-slate-500">{payload.length} rows land on the job sheet{areaName ? " in " + areaName : ""}</div>
          <button className="xbtn ml-auto" onClick={() => setPayload(null)}><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <table className="ptable">
            <thead><tr>
              <th>SKU</th><th>Description</th><th className="num">Qty</th><th className="num">Retail</th>
              <th className="num">Cost</th><th className="num">tierPrice × {bMult.toFixed(2)}</th><th>wedi marker</th>
            </tr></thead>
            <tbody>
              {payload.map((r, i) => (
                <tr key={i}>
                  <td className="mono">{r.sku || "—"}</td>
                  <td>{r.brandColor}</td>
                  <td className="num">{r.qty}</td>
                  <td className="num">{fm(+r.priceSqft)}</td>
                  <td className="num">{fm(+r.costSqft)}</td>
                  <td className="num" style={{ color: TIER_COLOR.builder.main }}>{fm(+r.tierPrice)}</td>
                  <td>{r.wedi.part ? <span className="mark part">part</span> : <span className="mark">{r.wedi.mode} cfg — Reconfigure</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mnote">
            Rows land <b>RETAIL</b> — the job sheet's own tier lens reprices them (ADR 0018). The one wedi rule rides
            along: every line carries <b>tierPrice = retail × {bMult.toFixed(2)}</b>, which pricing.js prefers over the
            flat Builder %. The anchor (pan) row carries <b>wedi:{"{mode,cfg}"}</b> so the "wedi — reconfigure" chip
            reopens this popup pre-filled; companions carry <b>wedi:{"{part:true}"}</b>. Stocked rows key the ERP SKU;
            special-order rows go by description with the US-SKU leading it.
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--ft-border-strong)", background: "var(--ft-sand)" }}>
          <span className="text-[11px] font-semibold text-slate-500">Quantities and prices stay editable on the row afterwards.</span>
          <button className="wbtn" style={{ flex: "none", padding: "8px 14px" }} onClick={() => setPayload(null)}>Cancel</button>
          <button className="wbtn primary" style={{ flex: "none", padding: "8px 16px" }} data-wedi-confirm
            onClick={() => { setPayload(null); onAdd(payload); }}>
            <Plus size={13} /> Add {payload.length} row{payload.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );

  const printSheet = printing && diag && build && createPortal(
    <div className="wedi-printsheet">
      <style>{PRINT_CSS}</style>
      <div className="ps-head">
        <div className="t">wedi Shower Layout</div>
        {projectName ? <div className="sub">{projectName}</div> : null}
        <div className="dt">{new Date().toLocaleDateString()}</div>
      </div>
      <div className="ps-diags">
        <div className="d">
          <TopDown o={drawDiag} w={460} h={360} wallOn={wallOnMap} dWalls={dWalls} benches={(build && build.benches) || []}
            framedFit={!!(build && build.panPlan)} itemFn={item} normBenchFn={normBench}
            cuts={curb.cuts} curbs={curb.segs} curbDiags={curb.diags} curbW={curb.w} /></div>
        <div className="d">
          <Iso o={drawDiag} w={460} h={360} dWalls={dWalls} panelFit={panelFit} benches={(build && build.benches) || []}
            framedFit={!!(build && build.panPlan)} cuts={curb.cuts} curbs={curb.segs} curbDiags={curb.diags} curbH={curb.h} curbW={curb.w} /></div>
      </div>
      {(drawDiag.pieces.some((p) => p.cut) || (drawDiag.warnings || []).length || CORNER_LBL.some((c) => corners[c[0]])) && (<>
        <div className="ps-sec">Cuts &amp; install notes</div>
        {drawDiag.pieces.filter((p) => p.cut).map((p, i) => (
          <div className="ps-warn" key={"c" + i}>✂ Cut {p.item.us || p.item.erp} to {inch(p.w)}″ × {inch(p.d)}″ (from {inch(p.cut.w)}″ × {inch(p.cut.d)}″)</div>
        ))}
        {(drawDiag.warnings || []).map((wt, i) => <div className="ps-warn" key={"w" + i}>• {wt}</div>)}
        {CORNER_LBL.filter((c) => corners[c[0]]).map((c) => {
          const d = curb.cuts.find((x) => x.corner === c[0]);
          const legs = d ? inch(d.h) + "″ × " + inch(d.v) + "″" : "12″ × 12″";
          return (
            <div className="ps-warn" key={c[0]}>✂ Corner cut at {c[1]} — {legs} legs{!d || d.h === d.v ? " (45°)" : ", straight to the wall end"}; glass or framing runs the line</div>
          );
        })}
        {drawDiag.drain && drawDiag.drain.note && <div className="ps-warn">• {drawDiag.drain.note}</div>}
      </>)}
      <div className="ps-sec">Materials</div>
      <table className="ps-table">
        <thead><tr><th>SKU</th><th>Description</th><th>Size</th><th className="num">Qty</th><th className="num">{tierId}</th><th className="num">Total</th></tr></thead>
        <tbody>
          {BUCKETS.flatMap((bk) => build.lines.filter((l) => l.group === bk[0]).map((l) => {
            const p = tierOf(l.item);
            return (
              <tr key={bk[0] + l.item.key}>
                <td>{l.item.stock ? l.item.erp : "wedi " + l.item.us}</td>
                <td>{unwedi(l.item.name)}</td><td>{l.item.sizeText || ""}</td>
                <td className="num">{l.qty}</td><td className="num">{fm(p)}</td><td className="num">{fm(round2(p * l.qty))}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
      <div className="ps-tot"><span>{build.lines.length} lines</span><span>{tierId} total {fm(totals.sell)}</span></div>
    </div>, document.body);

  const TAB_DEFS = [
    ["kits", "Kits", pans().length + " pans"],
    ["custom", "Custom shower", "solver"],
    ["browse", "Browse", nStock + " stock · " + (cat.length - nStock) + " SO"],
  ];

  return (
    // Embedded (the Apps hub, like Sheoga): no backdrop or fixed overlay — the
    // hub's main column is the frame; the outer scroll keeps the 1120px body
    // usable on narrow windows the way the popup's overlay scroll does.
    <div ref={shellRef} className={embedded
        ? "relative flex-1 min-h-0 flex flex-col overflow-auto"
        : "print:hidden fixed inset-0 z-[70] flex items-start justify-center overflow-auto p-4"}
      style={embedded ? undefined : { background: "rgba(20,15,10,.55)" }} onClick={embedded ? undefined : onClose}>
      <style>{CSS}</style>
      <div className={`wedi-pop relative w-full flex flex-col overflow-hidden ${embedded
          ? "flex-1 min-h-0 min-w-[1120px]"
          : "max-w-[1680px] rounded-xl border shadow-2xl"}`}
        style={embedded
          ? { background: "var(--ft-cream)", zoom: uiZoom }
          : { background: "var(--ft-cream)", borderColor: "var(--ft-border-strong)", height: fit.h, minHeight: 560, zoom: uiZoom }}
        onClick={embedded ? undefined : (e) => e.stopPropagation()} data-wedi-pop>
        <div className="pop-head">
          <div>
            <div className="eyebrow">Vendor configurator</div>
            <div className="name">wedi shower systems <small>sell = book retail · cost = distributor net</small></div>
          </div>
          <button className="rclear" data-wedi-clear
            title="wipe the build — walls, cuts, parts — and reset the custom shower form"
            onClick={() => { hardReset(null); say("Design cleared"); }}>Clear design</button>
          <SourceSwitch source={source} onChange={setSource} />
          {tierBar}
          {!embedded && <button className="xbtn" onClick={onClose} title="Close"><X size={15} /></button>}
        </div>
        <div className="modetabs">
          {TAB_DEFS.map((d) => (
            <button key={d[0]} className={"modetab" + (tab === d[0] ? " on" : "")} onClick={() => setTab(d[0])}>{d[1]}<small>{d[2]}</small></button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-x-auto flex">
          <div className="pop-body flex-1">
            <div className="main">{tab === "kits" ? kitsTab : tab === "custom" ? customTab : browseTab}</div>
            <div className="buildcol">{buildCol}</div>
            {diagRail}
          </div>
        </div>
      </div>
      {swapPanel}
      {chipPanel}
      {wallMenuPanel}
      {benchMenuPanel}
      {confirmModal}
      {payloadModal}
      {printSheet}
      {toast && createPortal(<div className="wedi-toast" onClick={(e) => e.stopPropagation()}>{toast}</div>, document.body)}
    </div>
  );
}

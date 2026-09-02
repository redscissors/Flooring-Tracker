// Schluter shower-system configurator popup (issue 097 phase 3) — the React
// port of .scratch/097_schluter-configurator/prototype.html (owner-approved
// 2026-08-20, P1/P2), wedi's sibling over the same shell idioms and the shared
// showerdraw rail. Presentation only: the knowledge layer is src/schluter.js,
// and every row it sees crosses src/schluteradapter.js — this popup reads the
// LIVE registry books (the stock cache + any active Schluter order book,
// fetched on open, ADR 0026/0032), never a transcribed table.
//
// The Source switch (Stock only / Full catalog) is the popup's own header
// control for now; phase 4 lifts it into the shared shell so wedi inherits it.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Eye, Printer, Copy } from "lucide-react";
import { useEscClose, SourceSwitch, NumIn, KitBasketPanel, KitOverwriteConfirm } from "./widgets.jsx";
import { TIER_COLOR } from "./uiconst.js";
import {
  trayCandidates, pickRolls, buildKit, tierPrice, lineItems, orderCopyLines, normBench, benchTrayRoom,
  boardPlan, expandBoardFaces, wallArea, halfBoardPool, buildFromMarker, ovKey, sessionFromRows,
} from "./schluter.js";
import { mortarItemFrom, MORTAR_BED_SF_PER_BAG } from "./schluteradapter.js";
import { useSchluterCatalog } from "./useschlutercatalog.js";
import { normKitBasketEntry } from "./model.js";
import { schluterDiag, schluterWalls, schluterWallOn, schluterCurb, schluterOpenCorners, schluterCuts } from "./schluterdraw.js";
import { TopDown, Iso, railSplit, RAIL_DESIGN_W, round2, WALL_THICK } from "./showerdraw.jsx";

// The Compare tab drags in comparekit → BOTH engines' tables, so it stays its
// own chunk behind this popup's own lazy boundary (ADR 0026).
const CompareTab = lazy(() => import("./CompareTab.jsx"));

const fm = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clampPct = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; };

// The wedi shrink-to-fit rig (issue 084): drawn at one width, zoomed to the
// frame, floored so type never gets unreadable — below the floor it scrolls.
const SCH_DESIGN_W = 1420;
const SCH_ZOOM_FLOOR = 0.66;
const RAIL_PAD_X = 24, RAIL_PAD_Y = 24, RAIL_MIN_W = 240;

const TIERS = ["retail", "builder", "employee", "sale", "custom"];
const TIER_SUB = { retail: "1.5× cost", employee: "cost × 1.06" };

// The Browse filter board — the wedi BROWSE_SECTIONS idiom over the Schluter
// groups (ported from the prototype's SLT_SECTIONS).
const SECTIONS = [
  { key: "trays", label: "Trays", subs: [
    { key: "point", label: "Point drain", hit: (i) => i.g === "tray" && i.drain !== "linear" },
    { key: "linear", label: "Linear (LTS)", hit: (i) => i.g === "tray" && i.drain === "linear" }] },
  { key: "drains", label: "Drains", subs: [
    { key: "flanges", label: "Flanges", hit: (i) => i.g === "drain" && i.part === "flange" },
    { key: "grates", label: "Grates", hit: (i) => i.g === "drain" && i.part === "grate" },
    { key: "vario", label: "Line-Vario", hit: (i) => i.g === "drain" && i.drain === "linear" }] },
  { key: "wp", label: "Waterproofing", subs: [
    { key: "membrane", label: "KERDI rolls", hit: (i) => i.g === "membrane" },
    { key: "band", label: "Band", hit: (i) => i.g === "seam" && i.lf },
    { key: "corners", label: "Corners & seals", hit: (i) => i.g === "seam" && !i.lf }] },
  { key: "build", label: "Build", subs: [
    { key: "board", label: "KERDI-BOARD", hit: (i) => i.g === "board" },
    { key: "curbs", label: "Curbs & ramp", hit: (i) => i.g === "curb" },
    { key: "set", label: "Setting", hit: (i) => i.g === "set" }] },
  { key: "extras", label: "Extras", hit: (i) => i.g === "extra" },
  { key: "kits", label: "Factory kits", hit: (i) => i.g === "kit" },
];
const sectionHit = (s, i) => (s.hit ? s.hit(i) : s.subs.some((sb) => sb.hit(i)));

const GROUPS = ["Base", "Drain", "Walls", "Seams", "Curb", "Setting", "Extras"];

const inches = (n) => (n % 12 === 0 ? n / 12 + "'" : n + '"');
const szLbl = (t) => `${inches(t.w)}×${inches(t.d)}`;

const EDGE_LBL = { back: "Back", left: "Left", right: "Right", entry: "Entry" };
// Which end of its edge an added wall returns from (the wedi naming): a
// back/entry wall reads left/right, a side wall back/entry.
const endLabel = (x) => ((x.edge === "back" || x.edge === "entry")
  ? (x.at === "hi" ? "right" : "left") : (x.at === "hi" ? "entry" : "back"));

// Add-on chip labels: the catalog names are long; the chips keep the part
// that differs (the prototype's replacements).
const extraLbl = (name) => String(name || "")
  .replace(/kerdi-board-sn-lt lighted niche/i, "Lit niche")
  .replace(/kerdi-board-sn niche/i, "Niche")
  .replace(/kerdi-board-sb bench/i, "Bench")
  .replace(/kers-b bench corner kit/i, "Bench corner kit")
  .replace(/ triangular/i, " tri")
  .replace(/ rectangular/i, "");

const CSS = `
.sch-pop{--s-rust:#B4552D;--s-paper:#FBFAF5;--s-stock:color-mix(in oklab, var(--ft-brand) 11%, var(--ft-card));
  color:var(--ft-text);font-family:var(--ft-ui);line-height:normal}
.sch-pop button{font-family:inherit}
.sch-pop input,.sch-pop select{font-family:inherit}
.sch-pop .pop-head{display:flex;align-items:center;gap:14px;padding:12px 16px 0;background:var(--ft-cream)}
.sch-pop .eyebrow{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:var(--ft-brand-deep)}
.sch-pop .name{font-size:18px;font-weight:800;letter-spacing:-.01em}
.sch-pop .name small{font-weight:600;color:var(--ft-muted);font-size:12px;margin-left:6px}
.sch-pop .xbtn{width:30px;height:30px;border-radius:6px;border:1px solid var(--ft-border);background:var(--ft-card);color:var(--ft-muted);font-size:15px;font-weight:700;cursor:pointer;flex:none;display:flex;align-items:center;justify-content:center}
.sch-pop .headctl{margin-left:auto;display:flex;align-items:center;gap:10px}
.sch-pop .rclear{border:1px solid var(--ft-border);border-radius:6px;background:transparent;color:var(--ft-muted);font-size:11px;font-weight:700;padding:5px 10px;cursor:pointer;white-space:nowrap}
.sch-pop .rclear:hover{background:var(--ft-hover);color:var(--ft-text)}
.sch-pop .srcseg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.sch-pop .srcseg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:6px 11px;cursor:pointer}
.sch-pop .srcseg button + button{border-left:1px solid var(--ft-border-strong)}
.sch-pop .srcseg button:hover:not(.on){background:var(--ft-hover)}
.sch-pop .srcseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.sch-pop .tierbar{display:flex;align-items:stretch;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.sch-pop .tierbar button{border:none;background:none;color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:6px 11px;cursor:pointer;line-height:1.1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.sch-pop .tierbar button:not(.on):hover{background:var(--ft-hover)}
.sch-pop .tierbar button.on{font-weight:800;box-shadow:inset 0 2px 4px rgba(0,0,0,.28)}
.sch-pop .tierbar button + button{border-left:1px solid var(--ft-border-strong)}
.sch-pop .tierbar small{display:block;font-size:8.5px;font-weight:600;opacity:.75}
.sch-pop .tierbar input{width:34px;border:none;background:transparent;font-size:11.5px;font-weight:700;text-align:center;color:inherit}
.sch-pop .tierbar input:focus{outline:none}
.sch-pop .modetabs{display:flex;gap:2px;padding:10px 16px 0;border-bottom:1px solid var(--ft-border-strong);background:var(--ft-cream)}
.sch-pop .modetab{border:1px solid var(--ft-border);border-bottom:none;background:var(--ft-sand);color:var(--ft-muted);font-size:12.5px;font-weight:700;padding:8px 16px;border-radius:7px 7px 0 0;cursor:pointer}
.sch-pop .modetab small{font-weight:600;color:var(--ft-faint);margin-left:5px;font-size:10.5px}
.sch-pop .modetab.on{background:var(--ft-card);color:var(--ft-text);border-color:var(--ft-border-strong);position:relative}
.sch-pop .modetab.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--ft-card)}
.sch-pop .pop-body{flex:1;display:flex;min-height:0;min-width:1120px;background:var(--ft-card)}
.sch-pop .main{flex:1 1 0;min-width:0;overflow-y:auto;background:var(--ft-card);padding:9px 11px 14px}
.sch-pop .fam-h{display:flex;align-items:baseline;gap:9px;margin:8px 0 3px}
.sch-pop .fam-h:first-child{margin-top:0}
.sch-pop .fam-h .t{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ft-brand-deep)}
.sch-pop .fam-h .hint{font-size:10.5px;color:var(--ft-faint);font-weight:600;line-height:1.4}
.sch-pop .kitrow{display:flex;align-items:center;gap:10px;width:100%;padding:2px 6px;border:0;border-bottom:1px solid var(--ft-row-line);background:none;cursor:pointer;text-align:left;color:inherit;min-height:23px}
.sch-pop .kitrow:hover{background:var(--ft-hover)}
.sch-pop .kitrow.dis{opacity:.38;cursor:not-allowed}
.sch-pop .kitrow.on{background:var(--ft-tint);box-shadow:inset 2px 0 0 var(--ft-brand)}
.sch-pop .kitrow .sz{font-weight:800;width:110px;flex:none;font-size:12px;letter-spacing:-.01em}
.sch-pop .kitrow .sz small{font-weight:600;color:var(--ft-faint);font-size:10px;margin-left:4px}
.sch-pop .kitrow .tag{font-size:9.5px;font-weight:700;color:var(--ft-muted);background:var(--ft-sand);border-radius:4px;padding:1px 6px;flex:none}
.sch-pop .kitrow .tag.so{color:var(--s-rust);background:var(--ft-hover-red,#F7E8E1)}
.sch-pop .kitrow .sku{font-size:10.5px;color:var(--ft-faint);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.sch-pop .kitrow .pr{font-weight:800;margin-left:auto;flex:none;font-size:11.5px;font-variant-numeric:tabular-nums}
.sch-pop .roomform{background:var(--ft-tint);border:1px solid var(--ft-tint-border);border-radius:10px;padding:5px;margin-bottom:10px}
.sch-pop .rfgrid{display:flex;flex-wrap:wrap;gap:5px}
.sch-pop .rfgrp{flex:1 1 232px;min-width:0;background:var(--ft-card);border:1px solid var(--ft-border);border-radius:8px;padding:4px 7px 5px}
.sch-pop .rfgrp > .h{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.13em;color:var(--ft-brand-deep);margin-bottom:3px}
.sch-pop .rfflow{display:flex;flex-wrap:wrap;gap:5px 9px}
.sch-pop .rf{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.sch-pop .rf label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ft-muted)}
.sch-pop .rf .dims{display:flex;align-items:center;gap:5px}
.sch-pop .rf .dims span{font-size:12px;color:var(--ft-faint);font-weight:700}
.sch-pop .rinp{border:1px solid var(--ft-border-strong);border-radius:7px;background:var(--ft-card);color:var(--ft-text);font-size:12.5px;font-weight:700;padding:3px 5px;width:46px}
.sch-pop .rinp:focus{outline:2px solid var(--ft-brand);outline-offset:1px;border-color:transparent}
.sch-pop .rfgrp.room{flex-grow:1.5}
.sch-pop .rseg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.sch-pop .rf{max-width:100%}
.sch-pop .rf.dim{opacity:.55}
.sch-pop .rseg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:3px 8px;cursor:pointer;white-space:nowrap}
.sch-pop .rseg button + button{border-left:1px solid var(--ft-border)}
.sch-pop .rseg button:hover:not(.on):not(:disabled){background:var(--ft-hover);color:var(--ft-text)}
.sch-pop .rseg button:disabled{opacity:.5;cursor:not-allowed}
.sch-pop .rseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.sch-pop .wsnote{font-size:10px;color:var(--ft-faint);font-weight:600;line-height:1.4;margin-top:3px;max-width:280px}
.sch-pop .wallrow{display:flex;align-items:center;gap:5px;padding:2px 0;border-bottom:1px dashed var(--ft-row-line);font-size:10px;color:var(--ft-faint);font-weight:600}
.sch-pop .wallrow:last-child{border-bottom:none}
.sch-pop .wname{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:5px;font-size:9.5px;font-weight:800;color:var(--ft-faint);padding:2px 0;cursor:pointer;width:44px;text-align:center;flex:none}
.sch-pop .wname.on{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff}
.sch-pop .win{width:40px;flex:none;border:1px solid var(--ft-border-strong);border-radius:4px;font-size:10.5px;font-weight:700;text-align:center;padding:2px;background:var(--ft-card);color:var(--ft-text)}
.sch-pop .win:disabled{opacity:.5}
.sch-pop .wallrow .wu{margin-left:auto;font-variant-numeric:tabular-nums;white-space:nowrap}
.sch-pop .wname small{font-weight:600;margin-left:3px;opacity:.8;font-size:8.5px;text-transform:none}
.sch-pop .rfgrp .h.rowh{display:flex;align-items:center;gap:6px}
.sch-pop .wtgl{margin-left:auto;border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:5px;font-size:11px;font-weight:800;color:var(--ft-muted);padding:0 6px;cursor:pointer;line-height:1.5}
.sch-pop .wtgl:hover{background:var(--ft-hover);color:var(--ft-text)}
.sch-pop .wdefh{display:flex;align-items:center;gap:5px;margin-left:auto;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ft-muted)}
.sch-pop .wdefh .win{width:36px}
.sch-pop .wname.x{width:auto;min-width:44px;padding:2px 6px}
.sch-pop .xdel{cursor:pointer;color:var(--s-rust);font-weight:800;padding:0 2px}
.sch-pop .addchips{display:flex;flex-wrap:wrap;gap:5px;padding:5px 0 2px}
.sch-pop .addchip{border:1px dashed var(--ft-border-strong);background:var(--ft-card);border-radius:20px;padding:3px 10px;font-size:10.5px;font-weight:700;color:var(--ft-muted);cursor:pointer}
.sch-pop .addchip.on{border-style:solid;background:var(--ft-brand-soft);border-color:var(--ft-brand);color:var(--ft-brand-deep)}
.sch-pop .addchip:disabled{opacity:.4;cursor:not-allowed}
.sch-pop .diagcol .dc-hint{background:#FBF3E4;border:1px solid #E5C07B;border-radius:6px;color:#7A5B1F;font-size:10.5px;font-weight:700;padding:6px 9px;margin-bottom:6px}
.sch-pop .optrow{display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:9px;margin-bottom:10px}
.sch-pop .optcard{min-width:0;border:1px solid var(--ft-border-strong);border-radius:9px;background:var(--ft-card);padding:9px 11px;cursor:pointer;text-align:left;color:inherit}
.sch-pop .optcard:hover{border-color:var(--ft-brand)}
.sch-pop .optcard.on{outline:2px solid var(--ft-brand);outline-offset:-1px;background:var(--ft-tint)}
.sch-pop .optcard .rank{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-brand-deep)}
.sch-pop .optcard .rank.warn{color:var(--s-rust)}
.sch-pop .optcard .big{font-size:15px;font-weight:800;margin:2px 0 1px;letter-spacing:-.01em}
.sch-pop .optcard .sub{font-size:10.5px;color:var(--ft-muted);line-height:1.45;min-height:29px}
.sch-pop .optcard .thumb{margin-top:6px}
.sch-pop .optcard .thumb svg{display:block;width:100%;height:auto;background:var(--s-paper);border:1px solid var(--ft-border);border-radius:6px}
.sch-pop .swapb{flex:none;border:1px solid var(--ft-border);background:var(--ft-card);border-radius:5px;color:var(--ft-muted);font-size:11px;font-weight:800;width:22px;height:20px;cursor:pointer;line-height:1}
.sch-pop .swapb:hover{border-color:var(--ft-brand);color:var(--ft-brand-deep)}
.sch-pop .starb{flex:none;border:none;background:none;color:var(--ft-faint);font-size:13px;cursor:pointer;padding:0 2px;line-height:1}
.sch-pop .starb.on{color:var(--ft-brand-deep)}
.sch-pop .optcard .foot{display:flex;align-items:center;gap:6px;margin-top:6px}
.sch-pop .optcard .foot .pr{font-weight:800;font-size:12.5px;margin-left:auto;font-variant-numeric:tabular-nums}
.sch-pop .stockdot{display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:700;color:var(--ft-brand-deep);background:var(--ft-brand-soft);border-radius:4px;padding:1px 6px}
.sch-pop .stockdot.so{color:var(--s-rust);background:var(--ft-hover-red,#F7E8E1)}
.sch-pop .mortarcard{background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:9px;padding:9px 12px;margin-bottom:10px;font-size:11.5px;color:var(--ft-muted);font-weight:600;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.sch-pop .mortarcard select{border:1px solid var(--ft-border-strong);border-radius:6px;background:var(--ft-card);color:var(--ft-text);font-size:11.5px;font-weight:700;padding:3px 6px}
.sch-pop .browsebar{display:flex;gap:8px;margin-bottom:10px}
.sch-pop .inp{border:1px solid var(--ft-border-strong);border-radius:7px;background:var(--ft-card);color:var(--ft-text);font-size:13.5px;font-weight:700;padding:7px 9px}
.sch-pop .browsebar .inp{flex:1;width:auto}
.sch-pop .inp:focus{outline:2px solid var(--ft-brand);outline-offset:1px;border-color:transparent}
.sch-pop .gchip{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:20px;padding:4px 11px;font-size:11px;font-weight:700;color:var(--ft-muted);cursor:pointer;flex:none}
.sch-pop .gchip.on{background:var(--ft-seg-on-bg);border-color:var(--ft-brand);color:var(--ft-brand-deep);box-shadow:inset 0 0 0 .5px var(--ft-brand)}
.sch-pop .fboard{display:flex;gap:8px;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap}
.sch-pop .fbcol{min-width:108px;flex:0 0 auto;display:flex;flex-direction:column;gap:2px}
.sch-pop .fbhead{border:none;background:var(--ft-sand);color:var(--ft-text);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;padding:5px 8px;border-radius:6px 6px 0 0;cursor:pointer;text-align:left}
.sch-pop .fbhead.on{background:var(--ft-text);color:var(--ft-cream)}
.sch-pop .fbhead small,.sch-pop .fbopt small{float:right;font-weight:600;opacity:.6;font-size:9.5px;padding-left:8px}
.sch-pop .fbopt{border:1px solid var(--ft-border);background:var(--ft-card);color:var(--ft-muted);font-size:11px;font-weight:700;padding:4px 8px;cursor:pointer;text-align:left}
.sch-pop .fbopt.on{background:var(--ft-seg-on-bg);border-color:var(--ft-brand);color:var(--ft-brand-deep)}
.sch-pop .figcard{background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:9px;padding:11px 13px;margin-bottom:12px;font-size:12px;color:var(--ft-muted);font-weight:600}
.sch-pop .figcard b{color:var(--ft-text);font-variant-numeric:tabular-nums}
.sch-pop .figcard .inp{width:64px;padding:3px 6px;font-size:12px}
.sch-pop .figfoot{font-size:10px;color:var(--ft-faint);margin-top:5px;line-height:1.4}
.sch-pop .brow{display:flex;flex-direction:column;gap:1px;padding:5px 8px 6px;border-top:1px solid var(--ft-row-line)}
.sch-pop .brow:last-child{border-bottom:1px solid var(--ft-row-line)}
.sch-pop .brow.stk{background:var(--s-stock)}
.sch-pop .sdot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--ft-brand)}
.sch-pop .sdot.so{background:transparent;border:1.4px solid var(--ft-faint)}
.sch-pop .brow .bn{display:flex;align-items:center;gap:8px;min-width:0}
.sch-pop .brow .bn .n{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sch-pop .brow .bmeta{display:flex;align-items:center;gap:8px;padding-left:15px}
.sch-pop .brow .bmeta .s{flex:1;min-width:0;font-size:10.5px;color:var(--ft-faint);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sch-pop .brow .sku{flex:none;font-size:10.5px;color:var(--ft-muted);font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
.sch-pop .brow .pr{flex:none;width:74px;text-align:right;font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums}
.sch-pop .stepper{flex:none;display:inline-flex;align-items:center;border:1px solid var(--ft-border-strong);border-radius:6px;overflow:hidden}
.sch-pop .stepper button{border:none;background:var(--ft-card);width:24px;height:24px;font-size:13px;font-weight:800;color:var(--ft-muted);cursor:pointer;line-height:1}
.sch-pop .stepper .q{width:28px;text-align:center;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
.sch-pop .stepper .q.zero{color:var(--ft-faint);font-weight:600}
.sch-pop .bline .stepper button{width:20px;height:20px;font-size:12px}
.sch-pop .bline .stepper .q{width:24px;font-size:11px}
.sch-pop .bline .stepper .q.ov{color:var(--s-rust)}
.sch-pop .more{font-size:11px;color:var(--ft-faint);padding:8px 4px}
.sch-pop .loading{font-size:12.5px;color:var(--ft-faint);padding:26px 10px;line-height:1.6}
.sch-pop .diagcol{flex:1 1 0;min-width:0;border-left:1px solid var(--ft-border-strong);background:var(--ft-tint);overflow-y:auto;scrollbar-gutter:stable;padding:10px 12px 14px;order:3}
.sch-pop .diagcol .dc-h{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-muted);margin:4px 0}
.sch-pop .diagcol .dc-h:first-child{margin-top:0}
.sch-pop .diagcol svg{display:block;width:100%;height:auto;background:var(--s-paper);border:1px solid var(--ft-border);border-radius:8px}
.sch-pop .diagcol svg + svg{margin-top:10px}
.sch-pop .diagcol .dc-empty{font-size:11.5px;color:var(--ft-faint);line-height:1.6;padding:18px 4px}
.sch-pop .warnrow{display:flex;gap:8px;font-size:11px;color:var(--ft-muted);padding:4px 0;border-top:1px solid var(--ft-row-line);line-height:1.45}
.sch-pop .warnrow .ic{flex:none;font-weight:800}
.sch-pop .buildcol{flex:1 1 0;border-left:1px solid var(--ft-border-strong);background:var(--ft-cream);display:flex;flex-direction:column;min-height:0;order:2}
.sch-pop .bc-scroll{flex:1;overflow-y:auto;padding:10px 13px 6px}
.sch-pop .bc-h{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.sch-pop .bc-h .t{font-size:14px;font-weight:800}
.sch-pop .bc-h .sub{font-size:10.5px;color:var(--ft-faint);font-weight:600;margin-left:auto;text-align:right}
.sch-pop .bc-empty{font-size:12px;color:var(--ft-faint);line-height:1.6;padding:22px 6px}
.sch-pop .bgroup{margin-top:8px}
.sch-pop .bg-h{display:flex;align-items:center;gap:7px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-muted);padding-bottom:4px;border-bottom:1px solid var(--ft-border-strong)}
.sch-pop .bg-h .wallctl{margin-left:auto;display:flex;align-items:center;gap:4px;text-transform:none;letter-spacing:0}
.sch-pop .pfseg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:5px;overflow:hidden}
.sch-pop .pfseg button{border:none;background:var(--ft-card);color:var(--ft-faint);font-size:9px;font-weight:800;padding:3px 7px;cursor:pointer}
.sch-pop .pfseg button + button{border-left:1px solid var(--ft-border-strong)}
.sch-pop .pfseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.sch-pop .bline{display:flex;align-items:center;gap:7px;padding:3px 0;border-bottom:1px solid var(--ft-row-line)}
.sch-pop .bline .bn{flex:1;min-width:0}
.sch-pop .bline .bn .n{font-size:11.5px;font-weight:700;line-height:1.25;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.sch-pop .bline .bn .n .sotag{font-size:8.5px;font-weight:800;color:var(--s-rust);background:var(--ft-hover-red,#F7E8E1);border-radius:4px;padding:0 5px;margin-left:6px;vertical-align:1px}
.sch-pop .bline .bn .m{font-size:9.5px;color:var(--ft-faint);font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sch-pop .bline .bn .m b{color:var(--ft-muted);font-weight:700}
.sch-pop .bline .lp{flex:none;text-align:right;font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;width:62px}
.sch-pop .bline .lp small{display:block;font-size:9px;color:var(--ft-faint);font-weight:600}
.sch-pop .bline.note .bn .n{color:var(--ft-muted);font-style:italic;font-weight:600}
.sch-pop .bc-meter{padding:7px 0 2px}
.sch-pop .bc-meter .mlab{display:flex;justify-content:space-between;font-size:9.5px;font-weight:700;color:var(--ft-muted)}
.sch-pop .meterbar{height:6px;border-radius:3px;background:var(--ft-sand);overflow:hidden;margin-top:3px}
.sch-pop .meterbar i{display:block;height:100%;background:var(--ft-brand)}
.sch-pop .bc-foot{flex:none;border-top:1px solid var(--ft-border-strong);background:var(--ft-sand);padding:8px 13px 9px}
.sch-pop .totrow{display:flex;align-items:baseline;gap:12px}
.sch-pop .totrow .k{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-muted)}
.sch-pop .totrow .v{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
.sch-pop .totrow .sell{margin-left:auto;text-align:right}
.sch-pop .totrow .sell .v{font-size:19px}
.sch-pop .marginrow{font-size:10.5px;color:var(--ft-muted);font-weight:600;margin-top:2px;display:flex;align-items:center;gap:4px;width:100%;background:none;border:0;padding:0;font-family:inherit;text-align:left;cursor:pointer}
.sch-pop .marginrow:hover{color:var(--ft-text)}
.sch-pop .marginrow span{margin-left:auto}
.sch-pop .btnrow{display:flex;gap:7px;margin-top:9px}
.sch-pop .wbtn{flex:1;border:1px solid var(--ft-border-strong);background:var(--ft-card);color:var(--ft-text);border-radius:7px;font-size:11.5px;font-weight:800;padding:7px 6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}
.sch-pop .wbtn.primary{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff}
.sch-pop .wbtn.primary:hover{background:var(--ft-brand-deep)}
.sch-pop .wbtn:disabled{opacity:.45;cursor:not-allowed}
.sch-pop .ptable{width:100%;border-collapse:collapse;font-size:11.5px}
.sch-pop .ptable th{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ft-muted);text-align:left;padding:4px 8px;border-bottom:1px solid var(--ft-border-strong)}
.sch-pop .ptable td{padding:5px 8px;border-bottom:1px solid var(--ft-row-line);vertical-align:top}
.sch-pop .ptable .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
.sch-pop .ptable .mono{font-weight:700;white-space:nowrap}
.sch-pop .ptable .mark{font-size:9.5px;font-weight:700;color:var(--ft-brand-deep);background:var(--ft-brand-soft);border-radius:4px;padding:1px 6px;white-space:nowrap}
.sch-pop .ptable .mark.part{color:var(--ft-faint);background:var(--ft-sand)}
.sch-pop .mnote{font-size:11px;color:var(--ft-muted);line-height:1.55;margin-top:10px}
.sch-pop .mnote b{color:var(--ft-text)}
.sch-pop .bg-hint{font-size:9.5px;color:var(--ft-faint);font-weight:600;line-height:1.4;padding:2px 0 0}
.sch-swap{position:fixed;z-index:90;background:var(--ft-card);color:var(--ft-text);border:1px solid var(--ft-border-strong);border-radius:9px;box-shadow:0 18px 50px rgba(0,0,0,.3);width:300px;max-height:340px;overflow-y:auto;padding:6px;font-family:var(--ft-ui)}
.sch-swap .ph{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-muted);padding:6px 8px 4px}
.sch-swap .srow{display:flex;align-items:center;gap:8px;width:100%;border:none;background:none;padding:6px 8px;border-radius:6px;cursor:pointer;text-align:left}
.sch-swap .srow:hover{background:var(--ft-tint)}
.sch-swap .srow.on{background:var(--ft-brand-soft)}
.sch-swap .srow.stk{background:color-mix(in oklab, var(--ft-brand) 11%, var(--ft-card))}
.sch-swap .sdot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--ft-brand)}
.sch-swap .sdot.so{background:transparent;border:1.3px solid var(--ft-faint)}
.sch-swap .n{flex:1;min-width:0;font-size:11.5px;font-weight:700;color:var(--ft-text);line-height:1.3}
.sch-swap .n small{display:block;font-size:9.5px;color:var(--ft-faint);font-weight:600}
.sch-swap .p{font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ft-text)}
.sch-wallmenu{width:256px;padding:9px 10px}
.sch-wallmenu .wm-row{display:flex;align-items:center;gap:6px;padding:4px 2px;font-size:10.5px;color:var(--ft-faint);font-weight:600}
.sch-wallmenu .wm-row label{width:38px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ft-muted)}
.sch-wallmenu .win{width:46px;border:1px solid var(--ft-border-strong);border-radius:4px;font-size:11px;font-weight:700;text-align:center;padding:3px;background:var(--ft-card);color:var(--ft-text)}
.sch-wallmenu .pfseg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:5px;overflow:hidden}
.sch-wallmenu .pfseg button{border:none;background:var(--ft-card);color:var(--ft-faint);font-size:9px;font-weight:800;padding:3px 7px;cursor:pointer}
.sch-wallmenu .pfseg button + button{border-left:1px solid var(--ft-border-strong)}
.sch-wallmenu .pfseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.sch-wallmenu .wm-del{border:1px solid var(--ft-border);background:var(--ft-card);border-radius:5px;font-size:10px;font-weight:800;color:#B4552D;padding:3px 8px;cursor:pointer}
.sch-wallmenu .wm-act{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:5px;font-size:10px;font-weight:800;color:var(--ft-text);padding:3px 8px;cursor:pointer}
.sch-wallmenu .wm-act:hover{border-color:var(--ft-brand)}
.sch-wallmenu .wm-act:disabled{opacity:.4;cursor:not-allowed}
.sch-wallmenu .wm-note{font-size:9px;color:var(--ft-faint);font-weight:600;padding:3px 2px 0;line-height:1.4}
.sch-benchmenu{width:300px}
.sch-benchmenu .bm-opt{display:block;width:100%;text-align:left;border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:7px;padding:7px 9px;cursor:pointer;margin:4px 0;color:var(--ft-text)}
.sch-benchmenu .bm-opt:hover{border-color:var(--ft-brand)}
.sch-benchmenu .bm-opt b{display:block;font-size:11px;font-weight:800}
.sch-benchmenu .bm-opt small{display:block;font-size:9px;color:var(--ft-faint);font-weight:600;line-height:1.35;margin-top:1px}
.sch-benchmenu .bm-opt:disabled{opacity:.4;cursor:not-allowed}
.sch-swap .srow:disabled{opacity:.4;cursor:not-allowed}
.sch-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:var(--ft-text);color:var(--ft-cream);border:1px solid var(--ft-border-strong);font-size:12.5px;font-weight:700;border-radius:8px;padding:10px 18px;z-index:95;box-shadow:0 12px 40px rgba(0,0,0,.4);font-family:var(--ft-ui)}
`;

// The print layout sheet (round 8, the wedi PRINT_CSS port): hidden on
// screen, the ONLY thing that prints.
const PRINT_CSS = `
.sch-printsheet{display:none}
@media print{
  body > *:not(.sch-printsheet){display:none !important}
  .sch-printsheet{display:block;color:#111;background:#fff;font-family:var(--ft-ui)}
  .sch-printsheet .ps-head{display:flex;align-items:baseline;gap:12px;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:14px}
  .sch-printsheet .ps-head .t{font-size:20px;font-weight:800}
  .sch-printsheet .ps-head .sub{font-size:12px;color:#333;font-weight:700}
  .sch-printsheet .ps-head .dt{margin-left:auto;font-size:11px;color:#555}
  .sch-printsheet .ps-diags{display:flex;gap:18px;align-items:flex-start;margin-bottom:6px}
  .sch-printsheet .ps-diags .d{flex:1}
  .sch-printsheet .ps-diags svg{width:100%;height:auto;border:1px solid #ddd;border-radius:6px;background:#fff}
  .sch-printsheet .ps-sec{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:#555;margin:14px 0 4px}
  .sch-printsheet .ps-warn{font-size:11px;color:#333;padding:2px 0}
  .sch-printsheet .ps-table{width:100%;border-collapse:collapse;font-size:11px}
  .sch-printsheet .ps-table th{text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#555;border-bottom:1.5px solid #111;padding:3px 6px}
  .sch-printsheet .ps-table td{border-bottom:1px solid #ddd;padding:4px 6px;vertical-align:top}
  .sch-printsheet .ps-table .num{text-align:right;font-variant-numeric:tabular-nums}
  .sch-printsheet .ps-tot{display:flex;justify-content:flex-end;gap:26px;font-size:12px;font-weight:800;margin-top:8px}
}
`;

const DEF_WALLS = [
  { name: "Back", on: true, len: "", h: "", faces: "" },
  { name: "Left", on: true, len: "", h: "", faces: "" },
  { name: "Right", on: true, len: "", h: "", faces: "" },
];
const DEF_WALL_H = 84;

const CORNER_LBL = [["bl", "back left"], ["br", "back right"], ["fl", "front left"], ["fr", "front right"]];

// Tile thickness comes off a tape measure, not a calculator (the wedi
// parseIn): "3/8", "1 1/16" parse alongside 0.375.
const parseIn = (v) => {
  const s = String(v == null ? "" : v).trim().replace(/["″]/g, "");
  const m = /^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/.exec(s);
  const n = m ? (+m[1] || 0) + (+m[3] ? +m[2] / +m[3] : 0) : +s;
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) / 1000 : 0;
};

function seedState(seed) {
  const s = {
    tab: "kits", w: "60", d: "38", curbed: true, drain: "point", wallSys: "membrane",
    walls: DEF_WALLS.map((x) => ({ ...x })), xwalls: [], wallH: String(DEF_WALL_H),
    corners: {}, maxIn: false, tileT: "", benches: [], mortarName: "", ramp: false,
    drainX: "", drainY: "", drainRef: "left",
    // Stock only by default (owner 2026-09-02); a saved marker reopens under
    // the catalog it was built from (below).
    manual: [], q: "", source: "stock", kitPick: false, pick: null, swaps: {},
  };
  if (!seed) return s;
  const cfg = seed.cfg;
  if (cfg && cfg.w) {
    // a saved product.schluter marker — reopen the room as it was built.
    // cfg.w/d are the EFFECTIVE (tray) dims; a max-mode build recovers the
    // stated depth by adding the curb + tile back.
    s.tab = "custom";
    s.maxIn = !!cfg.maxIn;
    s.tileT = +cfg.tileT > 0 ? String(cfg.tileT) : "";
    s.w = String(cfg.w);
    s.d = String(s.maxIn ? round2(+cfg.d + 4.5 + (+cfg.tileT || 0)) : cfg.d);
    s.curbed = cfg.curbed !== false;
    s.drain = ["point", "offset", "linear", "any"].includes(cfg.drain) ? cfg.drain : "point";
    s.wallSys = cfg.wallSys === "board" ? "board" : "membrane";
    if (Array.isArray(cfg.walls) && cfg.walls.length === 3) {
      // a stored len/h that only matches the auto value stays an auto blank
      s.walls = s.walls.map((w, i) => {
        const cw = cfg.walls[i], auto = i === 0 ? +cfg.w || 0 : +cfg.d || 0;
        return {
          ...w, on: cw.on !== false,
          len: +cw.len > 0 && Math.abs(+cw.len - auto) >= 0.01 ? String(cw.len) : "",
          h: +cw.h > 0 && +cw.h !== DEF_WALL_H ? String(cw.h) : "",
          faces: cw.faces === "both" || cw.faces === "in-end" ? cw.faces : "",
        };
      });
    }
    s.ramp = !!cfg.ramp;
    if (Array.isArray(cfg.corners)) cfg.corners.forEach((k) => {
      if (["bl", "br", "fl", "fr"].includes(k)) s.corners[k] = true;
    });
    s.xwalls = Array.isArray(cfg.xwalls) ? cfg.xwalls.map((x, i) => ({
      id: i + 1, edge: ["back", "left", "right", "entry"].includes(x.edge) ? x.edge : "entry",
      at: x.at === "hi" ? "hi" : "lo", len: String(+x.len || ""), h: String(+x.h || ""),
      faces: x.faces === "both" || x.faces === "in-end" ? x.faces : "",
    })) : [];
    // the marker's drainX is canonical from-left; a right-referenced build
    // reopens showing the number the builder actually gave
    if (cfg.drainRef === "right") {
      s.drainRef = "right";
      s.drainX = +cfg.drainX > 0 ? String(round2(+cfg.w - +cfg.drainX)) : "";
    } else {
      s.drainX = +cfg.drainX > 0 ? String(cfg.drainX) : "";
    }
    s.drainY = +cfg.drainY > 0 ? String(cfg.drainY) : "";
    // benches array (parity round 3); a legacy cfg.bench flag reopens as one
    // back-wall bench so pre-round-3 markers keep their bill
    s.benches = Array.isArray(cfg.benches) ? cfg.benches.map((b, i) => ({ id: i + 1, ...b }))
      : cfg.bench === "framed" ? [{ id: 1, kind: "wall", side: "back", build: "framed" }]
        : cfg.bench === "buildup" ? [{ id: 1, kind: "wall", side: "back", build: "site" }] : [];
    s.mortarName = cfg.mortarItem?.name || "";
    s.swaps = cfg.swaps && typeof cfg.swaps === "object" ? { ...cfg.swaps } : {};
    s.manual = Array.isArray(cfg.manual) ? cfg.manual.map((m) => ({ ...m })) : [];
    s.source = cfg.source === "stock" ? "stock" : "all";
    s.pick = typeof cfg.pick === "string" ? cfg.pick : null;
    s.kitPick = seed.mode === "kit";
    return s;
  }
  if (seed.tab) s.tab = ["custom", "browse", "compare"].includes(seed.tab) ? seed.tab : "kits";
  if (seed.input) {
    if (seed.input.w) s.w = String(seed.input.w);
    if (seed.input.d) s.d = String(seed.input.d);
    if (seed.input.curbed != null) s.curbed = !!seed.input.curbed;
    if (["point", "offset", "linear"].includes(seed.input.drain)) s.drain = seed.input.drain;
    if (seed.input.wallSys === "board" || seed.input.wallSys === "membrane") s.wallSys = seed.input.wallSys;
  }
  if (seed.search) s.q = seed.search;
  return s;
}

export default function SchluterConfigurator({
  seed, tier, onTierChange, schluterBuilderPct, wediBuilderPct, onAdd, onAddNew, editing = null, editRows = null,
  basket, onBasketChange, onMoveEntries, placed, onOpenPlaced, onDeleteKit,
  onClose, areaName, projectName,
  onConfigChange, onQuoteOptions, embedded = false,
  stockRows, bookStockReady, books, loadBookItems, mortars, mortarDefault,
}) {
  const init = useRef(null);
  if (!init.current) init.current = seedState(seed);
  const s0 = init.current;

  const [tab, setTab] = useState(s0.tab);
  const [source, setSource] = useState(s0.source);
  const [w, setW] = useState(s0.w);
  const [d, setD] = useState(s0.d);
  const [curbed, setCurbed] = useState(s0.curbed);
  const [drain, setDrain] = useState(s0.drain);
  const [wallSys, setWallSys] = useState(s0.wallSys);
  const [walls, setWalls] = useState(s0.walls);
  const [xwalls, setXwalls] = useState(s0.xwalls);
  const [placing, setPlacing] = useState(false);
  const wallSeq = useRef(s0.xwalls.length);
  const [wallH, setWallH] = useState(s0.wallH);
  const [corners, setCorners] = useState(s0.corners);
  const [maxIn, setMaxIn] = useState(s0.maxIn);
  const [tileT, setTileT] = useState(s0.tileT);
  const [drainX, setDrainX] = useState(s0.drainX);
  const [drainY, setDrainY] = useState(s0.drainY);
  const [drainRef, setDrainRef] = useState(s0.drainRef);
  const [benches, setBenches] = useState(s0.benches);
  const benchSeq = useRef(s0.benches.length);
  const [wallMenu, setWallMenu] = useState(null);   // { wid, extra, x, y } — right-clicked wall band
  const [benchMenu, setBenchMenu] = useState(null); // { kind, side|corner, x, y } — tray zone clicked
  const [picker, setPicker] = useState(null);       // { key: "niche", x, y } — an add-on chip's choice list
  const [mortarName, setMortarName] = useState(s0.mortarName);
  const [ramp, setRamp] = useState(!!s0.ramp);
  const [swaps, setSwaps] = useState(s0.swaps);
  const [swap, setSwap] = useState(null);           // { key, rect } — a line's ⇄ popover
  const [confirmKit, setConfirmKit] = useState(null); // tray clicked over a customized build
  const [manual, setManual] = useState(s0.manual);
  const [qtyOv, setQtyOv] = useState({}); // hand-stepped line quantities (the wedi idiom) — session only, never in the marker
  const [pick, setPick] = useState(s0.pick);    // chosen tray candidate's sku
  const [kitPick, setKitPick] = useState(s0.kitPick);
  // Fit | One size (round 7, the wedi panelFit): session-only, never in the
  // marker — the Fit plan is the default presentation, not a customization
  const [panelFit, setPanelFit] = useState(true);
  const [q, setQ] = useState(s0.q);
  const [sec, setSec] = useState("");
  const [sub, setSub] = useState("");
  // Starred items (the wedi owner sketch 2026-07-30): a per-device pin list,
  // the ★ filter shows just them — localStorage, never the shared record.
  const [starred, setStarred] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("ft-schluter-starred") || "[]")); } catch (x) { return new Set(); }
  });
  const toggleStar = (sku) => setStarred((s) => {
    const n = new Set(s);
    if (n.has(sku)) n.delete(sku); else n.add(sku);
    try { localStorage.setItem("ft-schluter-starred", JSON.stringify([...n])); } catch (x) { }
    return n;
  });
  const [figOpen, setFigOpen] = useState(false);
  const [figSf, setFigSf] = useState("");
  const [payload, setPayload] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [showMargin, setShowMargin] = useState(false);
  const [toast, setToast] = useState("");
  const [basketOpen, setBasketOpen] = useState(false);
  const [basketSel, setBasketSel] = useState({});

  const toastT = useRef(null);
  const say = (msg) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(""), 2600);
  };
  useEffect(() => () => clearTimeout(toastT.current), []);

  // The layout sheet unmounts on afterprint, not right after window.print()
  // returns — Safari (and Chrome sometimes) return with the dialog still up,
  // and an unmounted sheet prints blank. The timer is the belt-and-braces
  // fallback for anything that never fires the event (the wedi rig).
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    window.print();
    const t = setTimeout(done, 2500);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); };
  }, [printing]);

  // Modifying a kit's geometry makes it a custom shower and moves the main
  // pane there (the wedi owner rule 2026-07-30) — the build column keeps it.
  const leaveKit = () => {
    if (kitPick && tab === "kits") {
      setTab("custom");
      say("Modified kit — it's a custom shower now.");
    }
  };
  // any edit to the room makes the build a custom shower, not the kit
  const custom = (fn) => (...a) => { leaveKit(); setKitPick(false); setPick(null); fn(...a); };
  // wall/corner edits are geometry too, but they never change which tray
  // fits — the picked option card stays picked
  const geom = (fn) => (...a) => { leaveKit(); setKitPick(false); fn(...a); };

  // --- the catalog: live registry rows through the adapter -------------------
  // Stock side: the boot cache's stock-kind rows (bookStockReady gates it).
  // Special-order side: any active order book that says Schluter, fetched on
  // open (ADR 0026's re-fetch-on-open pattern; the EFT import lands here).
  // Shared with the Compare tab (task 3) — see useschlutercatalog.js.
  const { cat, catReady } = useSchluterCatalog({ stockRows, bookStockReady, books, loadBookItems });

  // --- price level: a lens on the JOB's tier, exactly like wedi's ------------
  const [localTier, setLocalTier] = useState({ tier: "retail", customPct: "" });
  const tierCtl = !!(tier && onTierChange);
  const tierId = (tierCtl ? tier.tier : localTier.tier) || "retail";
  const customPct = tierCtl ? tier.customPct : localTier.customPct;
  const salePct = (tierCtl ? tier.salePct : null) ?? 10;
  const setTier = (patch) => (tierCtl ? onTierChange(patch) : setLocalTier((t) => ({ tier: patch.priceTier ?? t.tier, customPct: patch.customPct ?? t.customPct })));
  const bPct = schluterBuilderPct == null ? 8 : schluterBuilderPct;
  const tierColor = TIER_COLOR[tierId]?.main || "var(--ft-text)";
  const tierOf = (e) => {
    const retail = tierPrice(e, "retail", {});
    switch (tierId) {
      case "builder": return tierPrice(e, "builder", { builderPct: bPct });
      case "employee": return round2((+e.cost || 0) * 1.06);
      case "sale": return round2(retail * (1 - salePct / 100));
      case "custom": return round2(retail * (1 - clampPct(customPct) / 100));
      default: return retail;
    }
  };

  useEscClose(true, () => {
    if (payload) setPayload(null);
    else if (confirmKit) setConfirmKit(null);
    else if (swap) setSwap(null);
    else if (picker) setPicker(null);
    else if (benchMenu) setBenchMenu(null);
    else if (wallMenu) setWallMenu(null);
    else if (placing) setPlacing(false);
    else if (basketOpen) setBasketOpen(false);
    else onClose();
  });

  // --- shrink-to-fit + rail sizing (the wedi rig) ----------------------------
  const shellRef = useRef(null);
  const [fit, setFit] = useState({ zoom: 1, h: 940 });
  useEffect(() => {
    const el = shellRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const pad = embedded ? 0 : 32;
    const on = () => {
      const fw = el.clientWidth - pad;
      if (fw <= 0) return;
      const zoom = Math.round(Math.min(1, Math.max(SCH_ZOOM_FLOOR, fw / SCH_DESIGN_W)) * 1000) / 1000;
      const h = Math.round(Math.min(940, (el.clientHeight - pad) / zoom));
      setFit((p) => (p.zoom === zoom && p.h === h ? p : { zoom, h }));
    };
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [embedded]);

  const railRef = useRef(null);
  const [railBox, setRailBox] = useState({ w: RAIL_DESIGN_W, h: 0 });
  useEffect(() => {
    const el = railRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const on = () => {
      const bw = Math.max(RAIL_MIN_W, Math.floor(el.clientWidth - RAIL_PAD_X));
      const bh = Math.max(0, Math.floor(el.clientHeight - RAIL_PAD_Y));
      setRailBox((p) => (p.w === bw && p.h === bh ? p : { w: bw, h: bh }));
    };
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
    // the Compare tab unmounts the rail — re-attach the observer to the new
    // node when it comes back, or the drawings freeze at their last size
  }, [tab]);
  const railFit = useMemo(() => railSplit(railBox, false), [railBox]);

  // --- the build -------------------------------------------------------------
  const mortarItem = useMemo(
    () => mortarItemFrom(mortarName || mortarDefault || "", mortars || {}),
    [mortarName, mortarDefault, mortars]);
  const wallHNum = +wallH || DEF_WALL_H;
  const tileNum = parseIn(tileT);
  const liveXwalls = useMemo(
    () => xwalls.filter((x) => +x.len > 0).map((x) => ({
      id: x.id, edge: x.edge, at: x.at, len: +x.len, h: +x.h || wallHNum,
      ...(x.faces === "both" || x.faces === "in-end" ? { faces: x.faces } : {}),
    })),
    [xwalls, wallHNum]);
  // the raw bench rows less their local ids — what the cfg (and so the saved
  // marker) carries; normBench fills the rest at read time
  const cfgBenchRows = useMemo(
    () => benches.map(({ id, ...b }) => b),
    [benches]);
  const cfg = useMemo(() => {
    // "Max — curb inside": the stated depth is the OVERALL footprint, so the
    // entry curb (4½") plus the tile on its outer face comes inside the line
    // and the tray gives up that depth. Only bites curbed — curbless has no
    // curb face to hold back (the wedi rule).
    const inset = maxIn && curbed ? 4.5 + tileNum : 0;
    const effW = +w || 0, effD = Math.max(0, round2((+d || 0) - inset));
    const base = {
      w: effW, d: effD, curbed, drain, wallSys,
      ...(cfgBenchRows.length ? { benches: cfgBenchRows } : {}),
      walls: walls.map((x, i) => ({
        name: x.name, on: x.on,
        len: +x.len > 0 ? +x.len : i === 0 ? effW : effD,
        h: +x.h > 0 ? +x.h : wallHNum,
        ...(x.faces === "both" || x.faces === "in-end" ? { faces: x.faces } : {}),
      })),
      ...(liveXwalls.length ? { xwalls: liveXwalls } : {}),
      ...(!curbed && ramp ? { ramp: true } : {}),
      ...(inset > 0 ? { maxIn: true, ...(tileNum > 0 ? { tileT: tileNum } : {}) } : {}),
      // the engine's drainX is canonical FROM THE LEFT; a right-referenced
      // measurement (the builder called it off the right wall) converts here
      // so nobody does the subtraction by hand, and the marker carries the
      // reference so Reconfigure shows the number as it was given
      ...(drain !== "linear" && +drainX > 0 && (drainRef !== "right" || effW - +drainX > 0)
        ? { drainX: drainRef === "right" ? round2(effW - +drainX) : +drainX, ...(drainRef === "right" ? { drainRef: "right" } : {}) }
        : {}),
      ...(drain !== "linear" && +drainY > 0 ? { drainY: +drainY } : {}),
      ...(mortarItem ? { mortarItem } : {}),
      ...(Object.keys(swaps).length ? { swaps } : {}),
    };
    // only OPEN corners carry a cut — a corner re-boxed by a wall drops its
    // stale cut everywhere (bill, drawings, marker) at once
    const open = schluterOpenCorners(base);
    const cut = Object.keys(corners).filter((k) => corners[k] && open[k]).sort();
    return cut.length ? { ...base, corners: cut } : base;
  }, [w, d, curbed, drain, wallSys, cfgBenchRows, walls, liveXwalls, drainX, drainY, drainRef, mortarItem, maxIn, tileNum, wallHNum, corners, ramp, swaps]);

  // a blanked size input mid-edit means "no room yet" — no candidates, no
  // build, no drawings (topGeom would divide by the room dims)
  const roomOk = cfg.w > 0 && cfg.d > 0;
  const cands = useMemo(() => (catReady && cat.length && roomOk ? trayCandidates(cfg, cat, { source }) : []), [catReady, cat, cfg, source, roomOk]);
  const pickCand = (pick && cands.find((c) => c.tray && c.tray.sku === pick)) || cands[0] || null;

  // The board Fit plan (round 7): the engine's boardPlan over the same
  // wall order the drawings use. One helper both the build column and
  // kitTotals run through, so the Kits-tab row price can never disagree
  // with what a click builds.
  const planFor = (c) => (panelFit && c.wallSys === "board" && catReady && cat.length
    ? boardPlan(expandBoardFaces(c), cat, { source }) : null);
  const plan = useMemo(() => planFor(cfg),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfg, cat, catReady, source, panelFit]);
  // Swap the recipe's by-area panel line for the plan's per-sheet lines, in
  // place (the fastener line stays — its count is pure area either way).
  // The first plan line carries the wedi note: sf, seam count, stood-vertical
  // count; the rest read "panel plan".
  const applyBoardPlan = (lines, c, p) => {
    if (!p || !p.lines.length) return lines;
    const vWalls = p.detail.filter((d2) => d2.vertical).length;
    const sf = wallArea(c);
    const planLines = p.lines.map((pl, i) => {
      const e = cat.find((x) => x.sku === pl.sku);
      return e && {
        g: "Walls", item: e, qty: pl.qty, so: !e.stock,
        note: i === 0
          ? sf.toFixed(0) + " sf — " + p.vSeams + " vertical seam" + (p.vSeams === 1 ? "" : "s")
            + (vWalls ? " · " + vWalls + " wall" + (vWalls === 1 ? "" : "s") + " stood vertical" : "")
          : "panel plan",
      };
    }).filter(Boolean);
    if (!planLines.length) return lines;
    const idx = lines.findIndex((l) => l.g === "Walls" && l.item.g === "board" && !l.item.fastener);
    const out = lines.filter((l) => !(l.g === "Walls" && l.item.g === "board" && !l.item.fastener));
    out.splice(idx >= 0 ? idx : out.length, 0, ...planLines);
    return out;
  };

  // a stepped quantity keeps winning over the recipe's figure while the
  // line survives; stepped to 0 the line leaves the bill (the wedi rule).
  // The basket drawer runs it too, so a staged entry prices the build that
  // was staged and not just its marker (owner decision 2026-08-31).
  const applyQtyOv = (lines, ov) => lines.map((l) => {
    const q = l.noteOnly ? null : ov[ovKey(l)];
    return q == null ? l : { ...l, autoQty: l.qty, qty: q, ov: true };
  }).filter((l) => l.noteOnly || l.qty > 0);
  const build = useMemo(() => {
    if (!pickCand) return null;
    const b = buildKit(cfg, cat, { source, pick: pickCand });
    b.lines = applyQtyOv(applyBoardPlan(b.lines, cfg, plan), qtyOv);
    manual.forEach((m) => {
      const e = cat.find((i) => i.sku === m.sku);
      if (e) b.lines.push({ g: "Extras", item: e, qty: m.qty, so: !e.stock, manual: true });
    });
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, cat, source, pickCand, manual, qtyOv, plan]);
  // A Reconfigure opens on what the sheet says (owner 2026-09-02, the wedi
  // rule): the placed rows are the truth once a kit lands, so a quantity
  // typed on a row — or stepped here before Add — is the session this
  // reopens with. Derived once the catalog is up, off the marker rebuilt the
  // way the basket drawer prices a placed kit (default session, Fit on).
  const rowsSeeded = useRef(false);
  useEffect(() => {
    if (rowsSeeded.current || !editing || !editRows?.length || !seed?.cfg?.w || !catReady || !cat.length) return;
    rowsSeeded.current = true;
    const b = buildFromMarker(seed, cat);
    if (!b) return;
    const c2 = seed.cfg;
    const lines = applyBoardPlan(b.lines, c2, c2.wallSys === "board" ? boardPlan(expandBoardFaces(c2), cat, { source: c2.source === "stock" ? "stock" : "all" }) : null);
    const s = sessionFromRows(lines, editRows, cat);
    if (Object.keys(s.qtyOv).length) setQtyOv(s.qtyOv);
    if (s.manual.length) setManual((m) => [...m, ...s.manual]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catReady, cat]);
  const mode = kitPick && !manual.length && !benches.length && !liveXwalls.length && !cfg.drainX && !cfg.drainY
    && !(cfg.corners || []).length && !cfg.maxIn && !cfg.ramp && !cfg.swaps ? "kit" : "custom";
  // the saved marker records the PICKED tray too — Reconfigure must reopen on
  // the candidate that was quoted, not whatever ranks first that day
  const markCfg = useMemo(() => ({ ...cfg, manual, source, pick: pickCand?.tray?.sku || null }), [cfg, manual, source, pickCand]);
  const rows = useMemo(
    () => (build ? lineItems({ ...build, mode, cfg: markCfg }, { builderPct: bPct }) : []),
    [build, mode, markCfg, bPct]);

  // --- basket (ADR 0035 step 3) ---------------------------------------------
  // The catalog is LIVE registry rows (ADR 0032): until catReady every entry
  // renders faint instead of pricing — never a crash. Prices re-derive through
  // buildFromMarker + the popup's own board plan + tier lens, so a kit reads
  // the same number in the drawer and the build column.
  // A STAGED entry carries its own session (owner decision 2026-08-31), so its
  // price is the build column's; a PLACED kit is a marker-only derivation —
  // once landed the rows are the truth — and reads the live Fit setting.
  const entryView = (marker, session) => {
    if (!catReady || !cat.length) return { title: "Schluter kit", meta: "waiting on the price books…", price: null, faint: true, lines: null };
    const b = buildFromMarker(marker, cat);
    if (!b) return { title: "Schluter kit", meta: "the catalog no longer knows this kit", price: null, faint: true, lines: null };
    const c2 = marker.cfg;
    const s = session || {};
    const fit = session ? s.panelFit !== false : panelFit;
    let lines = applyBoardPlan(b.lines, c2, fit && c2.wallSys === "board" ? boardPlan(expandBoardFaces(c2), cat, { source: c2.source === "stock" ? "stock" : "all" }) : null);
    lines = applyQtyOv(lines, s.qtyOv || {});
    const bill = lines.filter((l) => !l.noteOnly);
    return {
      title: b.pick && b.pick.tray ? b.pick.tray.name : "Mortar-bed build",
      meta: `${bill.length} lines · ${round2(c2.w)}×${round2(c2.d)}"`,
      price: round2(bill.reduce((t, l) => t + tierOf(l.item) * l.qty, 0)),
      lines: () => lineItems({ ...b, lines, mode: marker.mode || "custom", cfg: c2 }, { builderPct: bPct }),
    };
  };
  // The `|| {}` is the staged fork: a truthy session makes the entry read its
  // OWN Fit flag, where the placed fork (entryView(k.marker)) follows the live
  // toggle. An entry saved without a session must still take the staged path.
  const stagedViews = useMemo(() => (basket || []).map((e) => ({ id: e.id, target: e.target, ...entryView(e.snap, e.session || {}) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [basket, catReady, cat, tierId, customPct, salePct, bPct]);
  const placedViews = useMemo(() => (placed || []).map((k) => ({ ...k, ...entryView(k.marker) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placed, catReady, cat, tierId, customPct, salePct, bPct, panelFit]);
  // "New shower" on the kit-row confirm parks the standing build in the
  // basket and DETACHES the popup from the kit it was opened on: from then on
  // the build is a new kit — it appends instead of replacing, and Basket
  // stages a new entry rather than another update of the same row (the wedi
  // rule, 2026-09-02).
  const [detached, setDetached] = useState(false);
  const edit = detached ? null : editing;
  const commitLines = detached && onAddNew ? onAddNew : onAdd;
  const stageBuild = ({ open = true } = {}) => {
    if (!build || !onBasketChange) return false;
    const entry = normKitBasketEntry({
      addedAt: Date.now(), snap: { mode, cfg: JSON.parse(JSON.stringify(markCfg)) },
      session: { qtyOv: { ...qtyOv }, panelFit },
      target: edit || undefined,
    });
    if (!entry) return false;
    // One pending update per kit: staging a second edit of the same kit
    // REPLACES the first, or moving both would land one on top of the other.
    const rest = entry.target ? (basket || []).filter((b) => b.target?.rowId !== entry.target.rowId) : (basket || []);
    onBasketChange([...rest, entry]);
    if (open) {
      setBasketOpen(true);
      say(entry.target ? "Update staged — moving it replaces this kit's lines" : "Staged in the basket — saved with this job");
    }
    return true;
  };
  const addToBasket = () => stageBuild();
  const moveEntries = (ids) => {
    const picked = (basket || []).filter((b) => ids.includes(b.id));
    const views = picked.map((e) => stagedViews.find((v) => v.id === e.id)).filter((v) => v && v.lines);
    if (!onMoveEntries) return;
    if (!views.length) {
      say(catReady && cat.length ? "Nothing to move — the catalog no longer knows these kits"
        : "Still loading the price books — staged kits can't be priced yet");
      return;
    }
    // Each staged entry is its own kit (its own kitId group) even when several
    // move in one click; a targeted entry carries where it lands, so
    // moveKitEntries replaces that kit instead of appending a second copy.
    const byId = new Map(picked.map((e) => [e.id, e]));
    const groups = views.map((v) => ({ lines: v.lines(), target: byId.get(v.id)?.target }));
    onMoveEntries(groups, (basket || []).filter((b) => !ids.includes(b.id) || !views.some((v) => v.id === b.id)));
    setBasketSel({});
  };

  const totals = useMemo(() => {
    if (!build) return null;
    const bill = build.lines.filter((l) => !l.noteOnly);
    const retail = round2(bill.reduce((t, l) => t + tierPrice(l.item, "retail", {}) * l.qty, 0));
    const sell = round2(bill.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
    const cost = round2(bill.reduce((t, l) => t + tierPrice(l.item, "cost", {}) * l.qty, 0));
    return { retail, sell, cost, margin: round2(sell - cost) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, tierId, customPct, salePct, bPct]);
  const stockStat = useMemo(() => {
    if (!build) return null;
    const bill = build.lines.filter((l) => !l.noteOnly && tierPrice(l.item, "retail", {}) > 0);
    const st = bill.filter((l) => l.item.stock);
    return {
      n: st.length, of: bill.length,
      val: round2(st.reduce((s, l) => s + tierOf(l.item) * l.qty, 0)),
      tot: round2(bill.reduce((s, l) => s + tierOf(l.item) * l.qty, 0)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, tierId, customPct, salePct, bPct]);

  // refresh restore (the wedi ft-open-layer contract)
  useEffect(() => {
    onConfigChange?.({ mode, cfg: markCfg, tab, search: q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, markCfg, tab, q]);

  const qtyIn = (sku) => (manual.find((m) => m.sku === sku) || { qty: 0 }).qty;
  const setQty = (sku, n) => setManual((mm) => {
    const rest = mm.filter((m) => m.sku !== sku);
    return n > 0 ? [...rest, { sku, qty: n }] : rest;
  });
  // a build-column stepper: a hand-added Extras line adjusts its manual row,
  // a recipe line takes a qtyOv override
  const stepLine = (l, delta) => {
    if (l.manual) { setQty(l.item.sku, Math.max(0, l.qty + delta)); return; }
    setQtyOv((o) => ({ ...o, [ovKey(l)]: Math.max(0, l.qty + delta) }));
  };

  // the wedi click-away rule: the wall/bench menus dismiss on an outside
  // CLICK — click, not mousedown, so a blur-committed NumIn value lands
  // before the menu unmounts
  useEffect(() => {
    if (!wallMenu) return;
    const away = (e) => { if (!e.target.closest?.(".sch-wallmenu")) setWallMenu(null); };
    document.addEventListener("click", away, true);
    return () => document.removeEventListener("click", away, true);
  }, [wallMenu]);
  useEffect(() => {
    if (!benchMenu) return;
    const away = (e) => { if (!e.target.closest?.(".sch-benchmenu")) setBenchMenu(null); };
    document.addEventListener("click", away, true);
    return () => document.removeEventListener("click", away, true);
  }, [benchMenu]);
  useEffect(() => {
    if (!picker) return;
    const away = (e) => { if (!e.target.closest?.(".sch-picker")) setPicker(null); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [picker]);
  useEffect(() => {
    if (!swap) return;
    const away = (e) => { if (!e.target.closest?.(".sch-swappanel")) setSwap(null); };
    document.addEventListener("mousedown", away, true);
    return () => document.removeEventListener("mousedown", away, true);
  }, [swap]);

  // --- drawings --------------------------------------------------------------
  const normBenches = useMemo(() => benches.map((b) => normBench(b, cfg, cat)), [benches, cfg, cat]);
  const itemBySku = (sku) => cat.find((i) => i.sku === sku);
  const diag = useMemo(() => (pickCand ? schluterDiag(cfg, pickCand, normBenches) : null), [cfg, pickCand, normBenches]);
  const dWalls = useMemo(() => schluterWalls(cfg, plan), [cfg, plan]);
  const wallOn = useMemo(() => schluterWallOn(cfg), [cfg]);
  const curb = useMemo(() => schluterCurb(cfg, normBenches), [cfg, normBenches]);
  const cornerCuts = useMemo(() => schluterCuts(cfg), [cfg]);
  const openMap = useMemo(() => schluterOpenCorners(cfg), [cfg]);
  // the tray/channel actually billed and drawn — under "any" the picked tray
  // decides (the buildKit rule)
  const effDrain = pickCand && pickCand.tray ? pickCand.tray.drain : drain === "any" ? "point" : drain;

  const cutList = useMemo(() => {
    if (!build || !pickCand) return [];
    const out = [];
    // the tray's own room — a framed bench holds it short of the full size
    const troom = benchTrayRoom(normBenches, cfg);
    if (pickCand.tray && pickCand.cut) {
      // a pinned drain splits the cut between the sides — the saw plan says which
      const bits = [];
      if (pickCand.pinned) {
        const cutR = round2((pickCand.tw - troom.w) - (pickCand.cutL || 0));
        const cutF = round2((pickCand.td - troom.d) - (pickCand.cutB || 0));
        if (pickCand.cutL > 0.05) bits.push(`${pickCand.cutL}″ off the left`);
        if (cutR > 0.05) bits.push(`${cutR}″ off the right`);
        if (pickCand.cutB > 0.05) bits.push(`${pickCand.cutB}″ off the back`);
        if (cutF > 0.05) bits.push(`${cutF}″ off the front`);
      }
      out.push(`✂ Cut ${pickCand.tray.sku} to ${inches(troom.w)} × ${inches(troom.d)} (from ${inches(pickCand.tw)}×${inches(pickCand.td)}${pickCand.rot ? ", laid rotated" : ""})${troom.w < cfg.w || troom.d < cfg.d ? " — stops at the framed bench face" : ""}${bits.length ? " — " + bits.join(", ") + " to land the drain " + (pickCand.centered ? "centred in the clear space" : "on the pin") : ""}${pickCand.deep ? " — deep cut, drain moves off-centre" : ""}`);
    }
    const ch = build.lines.find((l) => l.item.part === "channel");
    const chCut = ch && (ch.note || "").match(/cut to [\d.]+"/);
    if (chCut) out.push(`✂ Trim the Vario channel + grate ${chCut[0].replace("cut to ", "to ")} — end caps supplied, min 10"`);
    const cl = build.lines.find((l) => l.g === "Curb" && l.item.len);
    if (cl && /cut/.test(cl.note || "")) out.push(`✂ ${cl.qty > 1 ? cl.qty + "× " : ""}${cl.item.name} — ${(cl.note || "").split(" — ")[0]}`);
    cornerCuts.forEach((c) => {
      const lbl = (CORNER_LBL.find((x) => x[0] === c.corner) || [])[1] || c.corner;
      out.push(`✂ Corner cut at ${lbl} — ${c.h}″ × ${c.v}″ legs (45°); cut the tray on site, glass or framing runs the line`);
    });
    if (cfg.drainRef === "right" && cfg.drainX) {
      out.push(`• Drain pinned as given: ${round2(cfg.w - cfg.drainX)}″ off the RIGHT wall (= ${cfg.drainX}″ from the left on the drawing)`);
    }
    (diag?.warnings || []).forEach((x) => out.push("• " + x));
    if (cfg.wallSys === "membrane") out.push("• Backer behind the membrane is by others — cement board or drywall");
    if (!cfg.curbed) out.push("• Curbless needs the floor recessed or the ramp — KERDI-SHOWER-FRS recess system lands Fall 2026");
    return out;
  }, [build, pickCand, cfg, diag, cornerCuts, normBenches]);

  // choice lists narrow to stocked rows under Stock only unless none are —
  // then the full list stays so a menu is never empty and a pick lands flagged
  const pool = (list) => (source === "stock" && list.some((i) => i.stock) ? list.filter((i) => i.stock) : list);
  const byShelf = (a, b2) => (b2.stock ? 1 : 0) - (a.stock ? 1 : 0) || tierPrice(a, "retail", {}) - tierPrice(b2, "retail", {});

  // The wedi ⇄ swap popovers (round 9): a line whose role has real
  // alternatives takes a hand pick — the grate finish, the curb, the
  // One-size wall board (under Fit the PLAN chooses the sheets, so the
  // board line doesn't swap — the wedi rule).
  const swapChoices = (l) => {
    const e = l.item;
    if (l.noteOnly) return null;
    if (e.part === "grate") return {
      title: "Drain grate — finish",
      list: pool(cat.filter((i) => i.part === "grate")).sort(byShelf),
      set: (sku) => setSwaps((o) => ({ ...o, grate: sku })),
    };
    if (l.g === "Curb" && e.g === "curb" && e.len) return {
      title: "Curb",
      list: pool(cat.filter((i) => i.g === "curb" && i.len)).slice().sort((a, b2) => a.len - b2.len),
      set: (sku) => setSwaps((o) => ({ ...o, curb: sku })),
    };
    if (l.g === "Walls" && e.g === "board" && !e.fastener && !panelFit) return {
      title: "Wall board — one size",
      list: pool(halfBoardPool(cat, "all")).sort(byShelf),
      set: (sku) => setSwaps((o) => ({ ...o, board: sku })),
    };
    return null;
  };

  // A kit click over customized work asks before wiping it (the wedi
  // overwrite rule) — an untouched kit-to-kit hop stays one click.
  const kitDirty = manual.length > 0 || benches.length > 0 || liveXwalls.length > 0
    || (cfg.corners || []).length > 0 || !!cfg.maxIn || !!cfg.ramp || !!cfg.drainX || !!cfg.drainY
    || Object.keys(qtyOv).length > 0 || Object.keys(swaps).length > 0
    || walls.some((x) => x.len !== "" || x.h !== "" || !x.on || !!x.faces)
    || tileNum > 0 || (!kitPick && pick != null);
  const tryKit = (t) => { if (kitDirty) setConfirmKit(t); else pickKit(t); };

  // "Copy for order entry" (round 8, the wedi rule): stocked lines as
  // SKU ⇥ qty for the ERP, special order by description.
  const copyList = () => {
    const txt = orderCopyLines(build.lines).join("\n");
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
        const subLbl = t === "builder" ? "−" + bPct + "%" : t === "sale" ? "−" + salePct + "%" : t === "custom" ? null : TIER_SUB[t];
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
            {t[0].toUpperCase() + t.slice(1)}{subLbl ? <small>{subLbl}</small> : null}
          </button>
        );
      })}
    </div>
  );

  const loadingPane = (
    <div className="loading">
      {catReady
        ? <>No Schluter shower rows in the registry yet. The configurator prices from the Price book library — import the shop's ERP stock export (Schluter rows) or the Schluter EFT, and this popup fills in with no code change.</>
        : <>Loading the Schluter registry…</>}
    </div>
  );

  const trays = useMemo(() => cat.filter((i) => i.g === "tray"), [cat]);

  // The wedi kit-row rule (owner ask 2026-07-31, ported round 6): the row's
  // ONE price is the FULL shelf kit through the tier lens — the number the
  // build column lands on a click — not the tray's own price. Rows re-price
  // under the Kits tab's wall-system seg, so Membrane vs Board compares in
  // one flip.
  const kitTotals = useMemo(() => {
    if (!catReady || !cat.length) return {};
    const out = {};
    trays.forEach((t) => {
      const kcfg = {
        w: t.w, d: t.d, curbed: !t.thin, drain: t.drain, wallSys,
        walls: [
          { name: "Back", on: true, len: t.w, h: wallHNum },
          { name: "Left", on: true, len: t.d, h: wallHNum },
          { name: "Right", on: true, len: t.d, h: wallHNum },
        ],
      };
      const kc = trayCandidates(kcfg, cat, { source });
      const own = kc.find((c) => c.tray && c.tray.sku === t.sku) || kc[0];
      if (!own || !own.tray) return;
      const b = buildKit(kcfg, cat, { source, pick: own });
      const lines = applyBoardPlan(b.lines, kcfg, planFor(kcfg));
      out[t.sku] = round2(lines.filter((l) => !l.noteOnly).reduce((s, l) => s + tierOf(l.item) * l.qty, 0));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catReady, cat, trays, wallSys, wallHNum, source, tierId, customPct, salePct, bPct, panelFit]);

  // The wedi Kits idiom (issue 075): families by TYPE, each sorted smallest
  // side then longest so every 3-footer sits together. w is the longer dim
  // (classify), so d leads the sort.
  const TRAY_FAMS = [
    ["point", "Point drain — KERDI-SHOWER-T", (t) => t.drain === "point" && !t.thin],
    ["thin", "Curbless — TT (thin, no lip)", (t) => !!t.thin],
    ["offset", "Offset drain — TS", (t) => t.drain === "offset"],
    ["linear", "Linear drain — LTS", (t) => t.drain === "linear"],
  ];
  const bySize = (a, b) => (a.d - b.d) || (a.w - b.w) || a.sku.localeCompare(b.sku);
  // the row leads with the SMALL side (the wedi convention) so the
  // smallest-side sort reads as ascending down the family
  const rowSz = (t) => `${inches(t.d)}×${inches(t.w)}`;

  // "Clear design" (the wedi header action): wipe the whole build — room back
  // to the default, walls, benches, add-ons, hand-set quantities — on any tab.
  const clearDesign = () => {
    setW("60"); setD("38"); setCurbed(true); setDrain("point"); setWallSys("membrane");
    setWalls(DEF_WALLS.map((x) => ({ ...x })));
    setXwalls([]); setPlacing(false); setWallH(String(DEF_WALL_H));
    setCorners({}); setMaxIn(false); setTileT("");
    setDrainX(""); setDrainY(""); setDrainRef("left");
    setBenches([]); setBenchMenu(null); setWallMenu(null); setPicker(null);
    setMortarName(""); setRamp(false); setSwaps({}); setSwap(null); setManual([]); setQtyOv({});
    setPick(null); setKitPick(false);
  };

  // A kit click fills the build column and STAYS here (the wedi Kits-tab
  // behavior — the Custom tab is where a room gets tuned, not a detour every
  // click takes). It hard-resets to the shelf kit: room = tray, add-ons and
  // added walls cleared, curb following the tray's line (TT = curbless).
  const pickKit = (t) => {
    const sys = wallSys;   // the Kits tab's wall-system seg survives the reset
    clearDesign();
    setWallSys(sys);
    setW(String(t.w)); setD(String(t.d)); setDrain(t.drain); setCurbed(!t.thin);
    setPick(t.sku); setKitPick(true);
  };
  // "Keep what I added" (owner 2026-09-02): the kit takes the room's work —
  // walls, extra walls, corners, wall height, drain position, benches,
  // mortar, ramp, tile, hand-added lines — and drops what belonged to the
  // OLD tray: stepped quantities and part swaps. A typed wall length that
  // only tracked the old tray clears and follows the new one (the wedi
  // retune rule); "Max — curb inside" resets because a kit's size IS the
  // tray size.
  const keepAdded = (t) => {
    setWalls((ws) => ws.map((x, i) => (+x.len > 0 && Math.abs(+x.len - (i === 0 ? cfg.w : cfg.d)) < 0.01 ? { ...x, len: "" } : x)));
    setPlacing(false); setWallMenu(null); setBenchMenu(null); setPicker(null); setSwap(null);
    setSwaps({}); setQtyOv({}); setMaxIn(false);
    setW(String(t.w)); setD(String(t.d)); setDrain(t.drain); setCurbed(!t.thin);
    setPick(t.sku); setKitPick(true);
  };
  const newShower = (t) => {
    const parked = stageBuild({ open: false });
    setDetached(true);
    pickKit(t);
    say((parked ? "Parked in the basket — the " : "Nothing to park — the ") + rowSz(t) + " kit starts as a new shower");
  };

  const kitsTab = !catReady || !cat.length ? loadingPane : (
    <>
      <div className="fam-h" style={{ alignItems: "center", gap: 10 }}>
        <div className="t">Wall system</div>
        <div className="rseg">
          <button className={wallSys === "membrane" ? "on" : ""} onClick={() => setWallSys("membrane")} data-schluter-kits-membrane>KERDI over backer</button>
          <button className={wallSys === "board" ? "on" : ""} onClick={() => setWallSys("board")} data-schluter-kits-board>KERDI-BOARD</button>
        </div>
        <div className="hint">every price below is the FULL kit under this wall system — flip to compare</div>
      </div>
      {TRAY_FAMS.map(([key, label, hit]) => {
        const list = trays.filter(hit).sort(bySize);
        if (!list.length) return null;
        // the wedi issue-075 idiom: a row is tagged only where it breaks its
        // family's pattern — two rows must agree before anything is "usual"
        const st = list.filter((x) => x.stock).length;
        const usual = Math.max(st, list.length - st) >= 2 ? st >= list.length - st : null;
        return (
          <div key={key} style={{ marginBottom: 9 }}>
            <div className="fam-h"><div className="t">{label}</div>
              {key === "point" && <div className="hint">click one — the build column fills the shelf kit in and you stay here. The factory boxed kits (special order) live in Browse → Factory kits</div>}
            </div>
            {list.map((t) => {
              const dis = source === "stock" && !t.stock;
              const on = kitPick && pickCand?.tray?.sku === t.sku;
              return (
                <button key={t.sku} className={"kitrow" + (dis ? " dis" : "") + (on ? " on" : "")} disabled={dis} onClick={() => tryKit(t)} data-schluter-tray={t.sku}>
                  <span className="sz">{rowSz(t)}</span>
                  {usual != null && t.stock !== usual && (
                    <span className={"tag" + (t.stock ? "" : " so")}>{t.stock ? "stock" : "special order"}</span>
                  )}
                  <span className="sku">{t.sku} — {t.name}</span>
                  <span className="pr" style={{ color: tierColor }} title="the full shelf kit at this size">{fm(kitTotals[t.sku] != null ? kitTotals[t.sku] : tierOf(t))}</span>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );

  const optCards = cands.map((c, i) => {
    if (c.kind === "mortar") return (
      <div className="optcard on" key="mortar">
        <div className="rank warn">Fallback</div>
        <div className="big">Mortar bed + KERDI</div>
        <div className="sub">No tray covers this room{source === "stock" ? " from stock" : ""} — site-built pitch, membrane floor.</div>
      </div>
    );
    return (
      <button key={c.tray.sku + i} className={"optcard" + (pickCand === c ? " on" : "")}
        onClick={() => { setKitPick(false); setPick(c.tray.sku); }} data-schluter-opt={c.tray.sku}>
        <div className={"rank" + (c.deep ? " warn" : "")}>{c.kind === "exact" ? "Exact tray" : c.deep ? "Deep cut" : "Cut down"}</div>
        <div className="big">{szLbl(c.tray)}</div>
        <div className="sub">{(c.kind === "exact" ? `Drops in as-is${c.rot ? ", laid rotated" : ""}, drain on layout.`
          : `Trim ${c.cut}″ total${c.rot ? ", laid rotated," : ""} to hit ${inches(cfg.w)}×${inches(cfg.d)}${c.deep ? " — past the 6″ soft rule, drain moves off-centre" : ""}.`)
          + (c.pinned ? (c.centered
            ? (c.miss > 0.5 ? ` Drain lands ${Math.round(c.miss)}″ off the clear-space centre.` : " Drain centred in the clear space.")
            : (c.miss > 0.5 ? ` Drain lands ${Math.round(c.miss)}″ off the pin.` : " Cut split lands the drain on the pin.")) : "")}</div>
        <div className="thumb"><TopDown o={schluterDiag(cfg, c, [])} w={120} h={86} mini wallOn={wallOn} /></div>
        <div className="foot">
          <span className={"stockdot" + (c.tray.stock ? "" : " so")}>{c.tray.stock ? "stock" : "special order"}</span>
          <span className="pr" style={{ color: tierColor }}>{fm(tierOf(c.tray))}</span>
        </div>
      </button>
    );
  });

  const mortarNames = Object.keys(mortars || {});
  const mortarCard = pickCand && pickCand.kind === "mortar" && (
    <div className="mortarcard">
      <span>Mortar bed product (Settings → Materials):</span>
      <select value={mortarName || mortarDefault || ""} onChange={(e) => setMortarName(e.target.value)} data-schluter-mortar>
        {!mortarNames.length && <option value="">— none set up —</option>}
        {mortarNames.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <span>bed figured at ≈{MORTAR_BED_SF_PER_BAG} sf/bag @ 1-1/2″ — KERDI goes over the cured bed</span>
    </div>
  );

  // A wall's sf with its faces counted — "both" doubles the plane, an
  // exposed end adds the 4"-wide strip (the wedi sfOfWall rule).
  const sfOfWall = (len, hh, faces) =>
    round2((len * hh * (faces === "both" ? 2 : 1) + (faces === "in-end" ? WALL_THICK * hh : 0)) / 144);
  const facesTag = (faces) => (faces === "both" ? " · 2-side" : faces === "in-end" ? " · +end" : "");

  // The wedi retuneWalls rule: a typed wall length that only tracked the
  // outgoing room was following the kit, so it clears back to auto and
  // follows the new size.
  const setRoom = (patch) => {
    const auto = [cfg.w, cfg.d, cfg.d];
    setWalls((ws) => ws.map((x, i) => (x.len !== "" && Math.abs(+x.len - auto[i]) < 0.01 ? { ...x, len: "" } : x)));
    if (patch.w != null) setW(patch.w);
    if (patch.d != null) setD(patch.d);
  };

  const customTab = !catReady || !cat.length ? loadingPane : (
    <>
      <div className="roomform">
        <div className="rfgrid">
          <div className="rfgrp room">
            <div className="h">Room</div>
            <div className="rfflow">
              <div className="rf"><label>Size</label>
                <div className="dims">
                  <NumIn className="rinp" value={w} onCommit={custom((v) => setRoom({ w: v }))} data-schluter-w />
                  <span>×</span>
                  <NumIn className="rinp" value={d} onCommit={custom((v) => setRoom({ d: v }))} data-schluter-d />
                  <span>in</span>
                </div>
              </div>
              <div className="rf"><label>Entry</label>
                <div className="rseg">
                  <button className={curbed ? "on" : ""} onClick={custom(() => setCurbed(true))}>Curbed</button>
                  <button className={!curbed ? "on" : ""} onClick={custom(() => setCurbed(false))}>Curbless</button>
                </div>
              </div>
              {(() => {
                const tileEats = maxIn && curbed;
                return (
                  <div className={"rf" + (tileEats ? "" : " dim")} title={tileEats
                    ? "what the finished tile adds on the curb's outer face — the curb steps that much further inside the stated line so the tiled face lands on it"
                    : !curbed ? "a curbless shower has no curb face to tile — nothing to hold back"
                      : 'only matters on "Max — curb inside": with the numbers read as the tray, the curb and its tile land outside them anyway'}>
                    <label>Tile thickness</label>
                    <div className="dims">
                      <NumIn className="rinp" disabled={!tileEats} placeholder={tileEats ? "0 or 3/8" : "—"} value={tileT}
                        onCommit={custom((v) => setTileT(v))} data-schluter-tile />
                      <span>in</span>
                    </div>
                  </div>
                );
              })()}
              <div className="rf"><label>Sizes are</label>
                <div className="rseg">
                  <button className={!maxIn ? "on" : ""} title="the tray's size — a curb adds its width outside the line"
                    onClick={custom(() => setMaxIn(false))}>Tray size</button>
                  <button className={maxIn ? "on" : ""}
                    title="the overall footprint — the entry curb and its tile come inside the stated line and the tray gives up that depth"
                    onClick={custom(() => setMaxIn(true))} data-schluter-max>Max — curb inside</button>
                </div>
              </div>
              <div className="rf"><label>Drain</label>
                <div className="rseg">
                  <button className={drain === "any" ? "on" : ""} title="no preference — every tray competes, the pick decides what gets billed"
                    onClick={custom(() => setDrain("any"))} data-schluter-any>Any</button>
                  <button className={drain === "point" ? "on" : ""} onClick={custom(() => setDrain("point"))}>Point · centre</button>
                  <button className={drain === "offset" ? "on" : ""} onClick={custom(() => setDrain("offset"))}>Point · offset</button>
                  <button className={drain === "linear" ? "on" : ""} onClick={custom(() => setDrain("linear"))}>Linear at wall</button>
                </div>
              </div>
              <div className={"rf" + (drain === "linear" ? " dim" : "")}
                title={drain === "linear" ? "a linear channel runs at the back wall — nothing to pin"
                  : "pin an existing waste line — the tray's drain is moulded, so the cut is split between the sides to land it as close as the tray allows"}>
                <label>Drain — from {drainRef} × back</label>
                <div className="dims">
                  <NumIn className="rinp" placeholder="auto" disabled={drain === "linear"} value={drainX}
                    onCommit={(v) => { setKitPick(false); setDrainX(v); }} data-schluter-dx />
                  <span>×</span>
                  <NumIn className="rinp" placeholder="auto" disabled={drain === "linear"} value={drainY}
                    onCommit={(v) => { setKitPick(false); setDrainY(v); }} data-schluter-dy />
                  <span>in</span>
                  {/* the measurement DATUM — a builder calling the drain off
                      the right wall types the number as given, no subtraction */}
                  <div className="rseg" title="which wall the first number is measured from">
                    <button className={drainRef !== "right" ? "on" : ""} disabled={drain === "linear"}
                      onClick={() => { setKitPick(false); setDrainRef("left"); }}>Left</button>
                    <button className={drainRef === "right" ? "on" : ""} disabled={drain === "linear"}
                      onClick={() => { setKitPick(false); setDrainRef("right"); }} data-schluter-dref>Right</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="rfgrp">
            <div className="h">Wall system — the Schluter fork</div>
            <div className="rseg">
              <button className={wallSys === "membrane" ? "on" : ""} onClick={custom(() => setWallSys("membrane"))}>KERDI over backer</button>
              <button className={wallSys === "board" ? "on" : ""} onClick={custom(() => setWallSys("board"))}>KERDI-BOARD</button>
            </div>
            <div className="wsnote">{wallSys === "membrane"
              ? "Membrane needs cement board / drywall behind it (by others) — cheapest material bill."
              : "Foam board is the substrate — no backer, dead flat, wedi-style install."}</div>
          </div>
          <div className="rfgrp">
            <div className="h rowh">Walls
              <button className="wtgl" title="rotate the room — width ↔ depth, the drain pin follows; typed wall lengths reset to auto"
                onClick={custom(() => {
                  const nw = d, nd = w;
                  setW(nw); setD(nd);
                  // a right-referenced X converts to from-left before it
                  // becomes the depth pin — the rotated axes read from
                  // left/back again
                  const fromLeftX = drainRef === "right" && +drainX > 0 ? String(round2((+w || 0) - +drainX)) : drainX;
                  setDrainX(drainY); setDrainY(fromLeftX); setDrainRef("left");
                  setWalls((ws) => ws.map((x) => ({ ...x, len: "" })));
                })} data-schluter-flip>⇄</button>
            </div>
            {walls.map((x, i) => {
              const auto = i === 0 ? cfg.w : cfg.d;
              const len = +x.len > 0 ? +x.len : auto, hh = +x.h > 0 ? +x.h : wallHNum;
              return (
                <div className={"wallrow"} key={x.name}>
                  <button className={"wname" + (x.on ? " on" : "")} onClick={geom(() => setWalls((ws) => ws.map((y, j) => (j === i ? { ...y, on: !y.on } : y))))}>{x.name}</button>
                  <NumIn className="win" value={x.len} placeholder={String(auto)} disabled={!x.on} title="length, in — blank follows the room"
                    onCommit={geom((v) => setWalls((ws) => ws.map((y, j) => (j === i ? { ...y, len: v } : y))))} />
                  <span>×</span>
                  <NumIn className="win" value={x.h} placeholder={String(wallHNum)} disabled={!x.on} title="height, in — 40 for a half wall"
                    onCommit={geom((v) => setWalls((ws) => ws.map((y, j) => (j === i ? { ...y, h: v } : y))))} />
                  <span className="wu">{x.on ? sfOfWall(len, hh, x.faces).toFixed(1) + " sf" + facesTag(x.faces) : "off"}</span>
                </div>
              );
            })}
            {xwalls.map((x) => (
              <div className="wallrow" key={"x" + x.id}>
                <button className="wname x on" title={"which end it returns from — click to move it (" + endLabel(x) + "). The × on the right removes it"}
                  onClick={geom(() => setXwalls((xs) => xs.map((y) => (y.id === x.id ? { ...y, at: y.at === "hi" ? "lo" : "hi" } : y))))}>
                  {EDGE_LBL[x.edge]} <small>{endLabel(x)}</small></button>
                <NumIn className="win" value={x.len} placeholder="len"
                  onCommit={geom((v) => setXwalls((xs) => xs.map((y) => (y.id === x.id ? { ...y, len: v } : y))))} />
                <span>×</span>
                <NumIn className="win" value={x.h} placeholder={String(wallHNum)}
                  onCommit={geom((v) => setXwalls((xs) => xs.map((y) => (y.id === x.id ? { ...y, h: v } : y))))} />
                <span className="wu">{sfOfWall(+x.len || 0, +x.h || wallHNum, x.faces).toFixed(1)} sf{facesTag(x.faces)} ·{" "}
                  <b className="xdel" onClick={() => setXwalls((xs) => xs.filter((y) => y.id !== x.id))}>×</b></span>
              </div>
            ))}
            {(() => {
              const openList = CORNER_LBL.filter((c) => openMap[c[0]]);
              const allCut = openList.length > 0 && openList.every((c) => (cfg.corners || []).includes(c[0]));
              const cutOn = CORNER_LBL.filter((c) => (cfg.corners || []).includes(c[0]));
              return (
                <div className="addchips">
                  <button className={"addchip" + (placing ? " on" : "")}
                    onClick={() => setPlacing((v) => !v)}>{placing ? "Click an edge on the drawing…" : "+ Add wall"}</button>
                  <button className={"addchip" + (allCut ? " on" : "")} disabled={!openList.length}
                    title="cut the tray at every corner not boxed in by walls — 12″ legs at 45°; single corners click on the drawing"
                    onClick={geom(() => setCorners((o) => {
                      const n = { ...o };
                      openList.forEach((c) => { n[c[0]] = !allCut; });
                      return n;
                    }))} data-schluter-cutcorners>✂ {allCut ? "Uncut corners" : "Cut open corners"}</button>
                  {cutOn.length > 0 && (
                    <span className="wu" style={{ fontSize: "9.5px", alignSelf: "center" }}>corner cuts: {cutOn.map((c) => c[1]).join(", ")}</span>
                  )}
                  <span className="wdefh">Default height
                    <NumIn className="win" value={wallH} title="the height every wall starts at, in"
                      onCommit={geom((v) => setWallH(v))} />in
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      {mortarCard}
      <div className="fam-h"><div className="t">Options</div><div className="hint">ranked — click one to build from it. Add-ons and benches live on the build column; bench zones and wall sizes edit on the drawing (the wedi idiom)</div></div>
      <div className="optrow">{optCards}</div>
    </>
  );

  const secObj = SECTIONS.find((s) => s.key === sec) || null;
  const subObj = secObj && secObj.subs ? secObj.subs.find((s) => s.key === sub) || null : null;
  const browseList = useMemo(() => {
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    return cat
      .filter((i) => source === "all" || i.stock)
      .filter((i) => sec !== "starred" || starred.has(i.sku))
      .filter((i) => !secObj || (subObj ? subObj.hit(i) : sectionHit(secObj, i)))
      .filter((i) => {
        if (!toks.length) return true;
        const hay = (i.name + " " + i.sku + " " + (i.erp || "") + " " + (i.size || "") + " " + i.g).toLowerCase();
        return toks.every((t) => hay.indexOf(t) >= 0);
      })
      .sort((a, b) => ((b.stock ? 1 : 0) - (a.stock ? 1 : 0)) || (a.g > b.g ? 1 : a.g < b.g ? -1 : 0) || (+a.price || 0) - (+b.price || 0));
  }, [cat, q, sec, secObj, subObj, source, starred]);

  const wallSfNow = cfg.walls.filter((x) => x.on).reduce((s, x) => s + (x.len * x.h) / 144, 0);
  const floorSfNow = (cfg.w * cfg.d) / 144;
  const figSfVal = figSf === "" ? Math.round(wallSfNow) : +figSf || 0;
  const allset = cat.find((i) => i.sfPerBag);
  const figBags = allset ? Math.max(1, Math.ceil((figSfVal + floorSfNow) / allset.sfPerBag)) : 0;
  const figRolls = pickRolls(figSfVal * 1.1, cat, { source });

  const browseTab = !catReady || !cat.length ? loadingPane : (
    <>
      <div className="browsebar">
        <input className="inp" placeholder="Search the Schluter catalog — name, SKU, group…" value={q} onChange={(e) => setQ(e.target.value)} data-schluter-q />
        <button className={"gchip" + (figOpen ? " on" : "")} onClick={() => setFigOpen((v) => !v)}>Figure thin-set &amp; KERDI</button>
      </div>
      <div className="fboard">
        {SECTIONS.filter((s) => s.subs).map((s) => {
          const secOn = sec === s.key && !sub;
          return (
            <div className="fbcol" key={s.key}>
              <button className={"fbhead" + (secOn ? " on" : "")}
                onClick={() => { const same = sec === s.key && !sub; setSec(same ? "" : s.key); setSub(""); }}>
                {s.label}<small>{cat.filter((i) => sectionHit(s, i)).length}</small></button>
              {s.subs.map((sb) => (
                <button key={sb.key} className={"fbopt" + (sec === s.key && sub === sb.key ? " on" : "")}
                  onClick={() => { const same = sec === s.key && sub === sb.key; setSec(same ? "" : s.key); setSub(same ? "" : sb.key); }}>
                  {sb.label}<small>{cat.filter(sb.hit).length}</small></button>
              ))}
            </div>
          );
        })}
        <div className="fbcol">
          {SECTIONS.filter((s) => !s.subs).map((s) => (
            <button key={s.key} className={"fbopt" + (sec === s.key ? " on" : "")}
              onClick={() => { const same = sec === s.key; setSec(same ? "" : s.key); setSub(""); }}>
              {s.label}<small>{cat.filter((i) => sectionHit(s, i)).length}</small></button>
          ))}
          <button className={"fbopt" + (!sec ? " on" : "")} onClick={() => { setSec(""); setSub(""); }}>All<small>{cat.length}</small></button>
          <button className={"fbopt" + (sec === "starred" ? " on" : "")} title="items pinned with the row star" data-schluter-starfilter
            onClick={() => { const same = sec === "starred"; setSec(same ? "" : "starred"); setSub(""); }}>
            ★ Starred<small>{starred.size}</small></button>
        </div>
      </div>
      {figOpen && (
        <div className="figcard">
          Wall area <NumIn className="inp" value={figSfVal} onCommit={(v) => setFigSf(v)} /> sf
          {" → "}<b>{figRolls.map((p) => p.qty + "× " + ((p.item.size || "").split("=")[1] || p.item.sf + " sf").trim()).join(" + ") || "—"}</b> KERDI
          {allset ? <> · <b>{figBags}</b> bag{figBags > 1 ? "s" : ""} ALL-SET (walls + {floorSfNow.toFixed(0)} sf floor)</> : null}
          {(figRolls.length > 0 || allset) && (
            <button className="gchip" style={{ marginLeft: 8 }} data-schluter-figadd onClick={() => {
              // the wedi top-up rule: what the build already carries counts,
              // only the shortfall lands as Extras
              const inBuild = (sku) => (build ? build.lines.reduce((t, l) => t + (!l.noteOnly && l.item.sku === sku ? l.qty : 0), 0) : 0);
              const want = figRolls.map((p) => [p.item.sku, p.qty]);
              if (allset) want.push([allset.sku, figBags]);
              setManual((mm) => {
                let next = mm.slice();
                want.forEach(([sku, qty]) => {
                  const need = qty - inBuild(sku);
                  if (need <= 0) return;
                  const m = next.find((x) => x.sku === sku);
                  next = m ? next.map((x) => (x === m ? { ...x, qty: Math.max(x.qty, need) } : x)) : [...next, { sku, qty: need }];
                });
                return next;
              });
              say("KERDI + ALL-SET added for " + figSfVal + " sf of wall");
            }}>Add to build</button>
          )}
          <div className="figfoot">ALL-SET at ≈{allset ? allset.sfPerBag : 55} sf/bag (1/4″×1/4″ est.) · KERDI +10% for laps · band rides the build's Seams group — corners + seals come boxed in the drain flange kit</div>
        </div>
      )}
      {browseList.slice(0, 48).map((i) => {
        const n = qtyIn(i.sku);
        return (
          <div className={"brow" + (i.stock ? " stk" : "")} key={i.sku}>
            <div className="bn">
              <span className={"sdot" + (i.stock ? "" : " so")} />
              <span className="n">{i.size && !/cut to length/.test(i.size) ? i.size + " · " : ""}{i.name}</span>
            </div>
            <div className="bmeta">
              <div className="s">{i.g}{i.stock ? " · on the shelf" : " · special order" + (i.lead ? " · " + i.lead : "")}</div>
              <div className="sku">{i.sku}</div>
              <button className={"starb" + (starred.has(i.sku) ? " on" : "")} data-schluter-star={i.sku}
                title={starred.has(i.sku) ? "unpin from Starred" : "pin to Starred"}
                onClick={() => toggleStar(i.sku)}>{starred.has(i.sku) ? "★" : "☆"}</button>
              <div className="pr" style={{ color: tierColor }}>{fm(tierOf(i))}</div>
              <div className="stepper">
                <button onClick={() => setQty(i.sku, Math.max(0, n - 1))}>−</button>
                <span className={"q" + (n ? "" : " zero")}>{n}</span>
                <button onClick={() => setQty(i.sku, n + 1)}>+</button>
              </div>
            </div>
          </div>
        );
      })}
      {browseList.length > 48 && <div className="more">{browseList.length - 48} more — narrow the search or a filter</div>}
      {sec === "starred" && !starred.size
        ? <div className="loading">Nothing starred yet — the ☆ on any row pins it here.</div>
        : !browseList.length && <div className="loading">Nothing matches.</div>}
    </>
  );

  const buildCol = (() => {
    if (!build) return (
      <>
        <div className="bc-scroll">
          <div className="bc-h"><div className="t">Build</div></div>
          <div className="bc-empty">{catReady && !cat.length
            ? "The registry has no Schluter shower rows yet — import the stock export or the EFT in the Price book library."
            : "Pick a kit, a tray, or solve a room."}</div>
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
            <div className="t">Build</div>
            <div className="sub">{inches(cfg.w)}×{inches(cfg.d)}{cfg.maxIn ? " tray (max inside)" : ""} · {cfg.curbed ? "curbed" : "curbless"} · {effDrain} drain · {cfg.wallSys === "board" ? "KERDI-BOARD walls" : "KERDI membrane walls"}{pickCand && pickCand.cut ? ` · tray cut ${pickCand.cut}″` : ""}</div>
          </div>
          {GROUPS.map((g) => {
            const gl = build.lines.filter((l) => l.g === g);
            if (!gl.length) return null;
            return (
              <div className="bgroup" key={g}>
                <div className="bg-h">{g}
                  {g === "Walls" && cfg.wallSys === "board" && (
                    <span className="wallctl">
                      <span className="pfseg">
                        <button className={panelFit ? "on" : ""} title="mixed sheet sizes, level courses, minimal vertical seams" onClick={() => setPanelFit(true)} data-schluter-fit>Fit</button>
                        <button className={!panelFit ? "on" : ""} title="one sheet size, by area" onClick={() => setPanelFit(false)} data-schluter-onesize>One size</button>
                      </span>
                    </span>
                  )}
                </div>
                {gl.map((l, li) => {
                  const e = l.item;
                  const price = tierOf(e);
                  const meta = [e.sku, e.size, l.note].filter(Boolean);
                  return (
                    <div className={"bline" + (l.noteOnly ? " note" : "")} key={g + (e.sku || e.name) + li}>
                      <div className="bn">
                        <div className="n">{e.name}
                          {!l.noteOnly && !e.stock && <span className="sotag">special order</span>}</div>
                        <div className="m" title={meta.join(" · ") || undefined}>{meta.map((s2, k) => (k ? " · " + s2 : <b key="k">{s2}</b>))}</div>
                      </div>
                      {swapChoices(l) && (
                        <button className="swapb" title="swap" data-schluter-swapb={e.sku}
                          onClick={(ev) => setSwap({ key: e.sku || e.name, rect: ev.currentTarget.getBoundingClientRect() })}>⇄</button>
                      )}
                      {!l.noteOnly && (
                        <div className="stepper">
                          <button onClick={() => stepLine(l, -1)} title="one less — at 0 the line leaves the bill">−</button>
                          <span className={"q" + (l.ov ? " ov" : "")} title={l.ov ? "hand-set — the recipe figures " + l.autoQty : undefined}>{l.qty}</span>
                          <button onClick={() => stepLine(l, 1)} title="one more">+</button>
                        </div>
                      )}
                      {!l.noteOnly && (
                        <div className="lp" style={{ color: tierColor }}>{price ? fm(round2(price * l.qty)) : ""}
                          {price ? <small>{fm(price)}{e.unit && e.unit !== "EA" ? "/" + e.unit.toLowerCase() : " ea"}</small> : null}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {/* The wedi add-on idiom, round 3: the chips live on the build
              column so a shelf-kit pick reaches them on every tab, and a chip
              with several possible parts opens a PICKER instead of dumping
              every catalog variant as its own chip. Benches get ONE chip
              whose picker holds every form (build-up / framed / premades) —
              a pick lands on the next open zone; the drawing's zones stay
              the place a bench moves, resizes or changes build. */}
          <div className="bgroup">
            <div className="bg-h">Add-ons</div>
            <div className="addchips">
              {(() => {
                const extras = cat.filter((i) => i.g === "extra");
                const niches = extras.filter((x) => x.extra === "niche");
                const rest = extras.filter((x) => x.extra !== "niche" && x.extra !== "bench" && x.extra !== "benchkit");
                const nicheOn = niches.reduce((n2, x) => n2 + qtyIn(x.sku), 0);
                return (<>
                  <button className={"addchip" + (benches.length ? " on" : "")} data-schluter-benchchip
                    title="benches — 2″ build-up, installer-framed, or the premade SB pieces; a pick lands on the next open wall or corner"
                    onClick={(e) => setPicker((p) => (p ? null : { key: "bench", x: e.clientX, y: e.clientY }))}>
                    {(benches.length ? "✓ " : "+ ") + "Bench" + (benches.length > 1 ? " ×" + benches.length : "")}</button>
                  {niches.length > 0 && (
                    <button className={"addchip" + (nicheOn ? " on" : "")} data-schluter-nichechip
                      title="wall niches — the chip opens the size picker"
                      onClick={(e) => setPicker((p) => (p ? null : { key: "niche", x: e.clientX, y: e.clientY }))}>
                      {(nicheOn ? "✓ " : "+ ") + "Niche" + (nicheOn > 1 ? " ×" + nicheOn : "")}</button>
                  )}
                  {rest.map((x) => {
                    const on = qtyIn(x.sku) > 0;
                    const dis = source === "stock" && !x.stock;
                    return (
                      <button key={x.sku} className={"addchip" + (on ? " on" : "")} disabled={dis}
                        title={x.name + (x.stock ? "" : " — special order")}
                        onClick={() => setQty(x.sku, on ? 0 : 1)} data-schluter-extra={x.sku}>{(on ? "✓ " : "+ ") + extraLbl(x.name)}</button>
                    );
                  })}
                  {!cfg.curbed && (
                    // the ramp is an opt-in, never auto-billed (owner 2026-08-24):
                    // recessing the subfloor needs no part at all
                    <button className={"addchip" + (ramp ? " on" : "")} data-schluter-rampchip
                      title={'curbless entry ramp — 12" run, ADA slope. Recessing the subfloor instead needs no part'}
                      onClick={() => { setKitPick(false); setRamp((v) => !v); }}>{(ramp ? "✓ " : "+ ") + "Ramp"}</button>
                  )}
                  {(() => {
                    // KERDI-FIX left the standing recipe (owner 2026-08-24) —
                    // one click brings it back when a job really wants it
                    const kfix = cat.find((i) => i.adhesive);
                    if (!kfix) return null;
                    const on = qtyIn(kfix.sku) > 0;
                    return (
                      <button className={"addchip" + (on ? " on" : "")} disabled={source === "stock" && !kfix.stock}
                        title={kfix.name + " — sealing adhesive; rides the tub kit, not every shower"}
                        onClick={() => setQty(kfix.sku, on ? 0 : 1)} data-schluter-kfix>{(on ? "✓ " : "+ ") + "KERDI-FIX"}</button>
                    );
                  })()}
                </>);
              })()}
            </div>
            <div className="bg-hint">Benches: the Bench chip, or hover the tray on the drawing along a wall or into a corner and click the zone — a bench's own zone edits its size and build. Right-click a wall band for its size.</div>
          </div>
          {stockStat && (
            <div className="bc-meter">
              <div className="mlab"><span>From stock</span><span>{stockStat.n} of {stockStat.of} lines · {fm(stockStat.val)} of {fm(stockStat.tot)}</span></div>
              <div className="meterbar"><i style={{ width: (stockStat.tot ? Math.round(stockStat.val / stockStat.tot * 100) : 0) + "%" }} /></div>
            </div>
          )}
        </div>
        <div className="bc-foot">
          <div className="totrow">
            {tierId === "retail"
              ? <div><div className="k">Lines</div><div className="v">{build.lines.filter((l) => !l.noteOnly).length}</div></div>
              : <div><div className="k">Retail</div><div className="v">{fm(totals.retail)}</div></div>}
            <div className="sell">
              <div className="k">{tierId}{tierId === "builder" ? " −" + bPct + "%" : ""}</div>
              <div className="v" style={{ color: tierColor }} data-schluter-sell>{fm(totals.sell)}</div>
            </div>
          </div>
          <button type="button" className="marginrow" onClick={() => setShowMargin((v) => !v)}
            title={showMargin ? "Hide cost & margin" : "Show cost & margin"}>
            {showMargin
              ? <>cost {fm(totals.cost)}<span>margin {fm(totals.margin)} · {totals.sell ? Math.round(totals.margin / totals.sell * 100) : 0}%</span></>
              : <><Eye size={11} /> cost &amp; margin</>}
          </button>
          <div className="btnrow">
            <button className="wbtn primary" onClick={() => setPayload(rows)} data-schluter-add><Plus size={13} /> {edit ? "Update this kit" : "Add to product lines"}</button>
            {onBasketChange && <button className="wbtn" onClick={addToBasket} data-schluter-add-basket><Plus size={13} /> Basket</button>}
            <button className="wbtn" disabled={!diag} onClick={() => setPrinting(true)} data-schluter-print><Printer size={13} /> Print layout</button>
            <button className="wbtn" onClick={copyList} data-schluter-copy><Copy size={13} /> Order entry</button>
          </div>
        </div>
      </>
    );
  })();

  const diagRail = (
    <div className="diagcol" ref={railRef}>
      {!diag ? (<>
        <div className="dc-h">The shower</div>
        <div className="dc-empty">Pick a tray or solve a room — the drawings render here for whatever is selected.</div>
      </>) : (<>
        {placing && <div className="dc-hint">Click an edge to add a wall — which half you click picks the end it returns from. An open corner toggles a corner cut</div>}
        <TopDown o={diag} w={railFit.w} h={railFit.plan} wallOn={wallOn} dWalls={dWalls} benches={normBenches}
          itemFn={itemBySku} normBenchFn={(z, room) => normBench(z, room, cat)}
          cuts={cornerCuts} curbs={curb.segs} curbDiags={curb.diags} curbW={curb.w} placing={placing}
          onBenchMenu={(z, x, y) => setBenchMenu({ ...z, x, y })}
          onWallMenu={(ref, x, y) => setWallMenu({ ...ref, x, y })}
          onCorner={(c) => {
            if (!openMap[c]) { say("That corner sits between two walls — shorten or turn one off to cut it"); return; }
            leaveKit();
            setKitPick(false);
            setCorners((o) => ({ ...o, [c]: !o[c] }));
            setPlacing(false);
          }}
          onEdge={(edge, geo) => {
            wallSeq.current += 1;
            const at = geo.at === "hi" ? "hi" : "lo";
            setXwalls((xs) => [...xs, {
              id: wallSeq.current, edge, at,
              len: String(round2(edge === "entry" ? Math.min(24, geo.rw) : edge === "back" ? geo.rw : geo.rd)),
              h: "",
            }]);
            setPlacing(false);
            leaveKit();
            setKitPick(false);
            say("Wall added on the " + edge + " side, returning from the "
              + ((edge === "back" || edge === "entry") ? (at === "hi" ? "right" : "left") : (at === "hi" ? "entry" : "back"))
              + " — set its length and height in the Walls group, or right-click it for both ends");
          }} />
        <Iso o={diag} w={railFit.w} h={railFit.iso} dWalls={dWalls} benches={normBenches}
          itemFn={itemBySku} normBenchFn={(z, room) => normBench(z, room, cat)}
          cuts={cornerCuts} curbs={curb.segs} curbDiags={curb.diags} curbH={curb.h} curbW={curb.w}
          onWallMenu={(ref, x, y) => setWallMenu({ ...ref, x, y })} />
        {cutList.length > 0 && (<>
          <div className="dc-h" style={{ marginTop: 8 }}>Cut list</div>
          {cutList.map((r, i) => (
            <div className="warnrow" key={i}><span className="ic">{r.slice(0, 1)}</span><span>{r.slice(2)}</span></div>
          ))}
        </>)}
      </>)}
    </div>
  );

  const payloadModal = payload && (
    <div className="print:hidden fixed inset-0 z-[80] flex items-center justify-center p-8" style={{ background: "rgba(20,15,10,.5)" }}
      onClick={(e) => { e.stopPropagation(); setPayload(null); }}>
      <div className="sch-pop w-full max-w-[900px] max-h-[82vh] flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{ background: "var(--ft-cream)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 py-3 border-b" style={{ borderColor: "var(--ft-border-strong)" }}>
          <div className="text-sm font-extrabold">{edit ? "Update this kit — the payload" : "Add to product lines — the payload"}</div>
          <div className="text-[11px] font-semibold text-slate-500">{payload.length} rows {edit ? "replace this kit's lines" : "land on the job sheet"}{areaName ? " in " + areaName : ""}</div>
          <button className="xbtn ml-auto" onClick={() => setPayload(null)}><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <table className="ptable">
            <thead><tr>
              <th>SKU</th><th>Description</th><th className="num">Qty</th><th className="num">Retail</th>
              <th className="num">Cost</th><th className="num">tierPrice −{bPct}%</th><th>schluter marker</th>
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
                  <td>{r.schluter.part ? <span className="mark part">part</span> : <span className="mark">{r.schluter.mode} cfg — Reconfigure</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mnote">
            Rows land <b>RETAIL</b> — the job sheet's own tier lens reprices them (ADR 0018). Every line carries
            <b> tierPrice = retail −{bPct}%</b> (the Schluter Builder knob, ADR 0032). The anchor (tray) row carries
            <b> schluter:{"{mode,cfg}"}</b> so the "Schluter — reconfigure" chip reopens this popup pre-filled;
            companions carry <b>schluter:{"{part:true}"}</b>. Stocked rows key the shop's ERP SKU; special-order rows
            go by description.
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: "var(--ft-border-strong)", background: "var(--ft-sand)" }}>
          <span className="text-[11px] font-semibold text-slate-500">Quantities and prices stay editable on the row afterwards.</span>
          <button className="wbtn" style={{ flex: "none", padding: "8px 14px" }} onClick={() => setPayload(null)}>Cancel</button>
          {edit && onAddNew && (
            <button className="wbtn" style={{ flex: "none", padding: "8px 14px" }} data-schluter-addnew
              onClick={() => { setPayload(null); onAddNew(payload); }}>
              <Plus size={13} /> Add as a new kit
            </button>
          )}
          <button className="wbtn primary" style={{ flex: "none", padding: "8px 16px" }} data-schluter-confirm
            onClick={() => { setPayload(null); commitLines(payload); }}>
            <Plus size={13} /> {edit ? "Update" : "Add"} {payload.length} row{payload.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );

  // The right-click wall menu (the wedi idiom): size edits write straight into
  // the walls / xwalls rows the build already reads. No faces seg — the
  // wall-system fork (membrane vs board) is whole-shower, not per wall.
  const wallMenuPanel = (() => {
    if (!wallMenu) return null;
    const xid = wallMenu.extra ? +String(wallMenu.wid).slice(1) : null;
    const wi = wallMenu.extra ? -1 : ["back", "left", "right"].indexOf(wallMenu.wid);
    const row = wallMenu.extra ? xwalls.find((x) => x.id === xid) : walls[wi];
    if (!row) return null;
    const auto = wallMenu.extra ? 0 : wi === 0 ? cfg.w : cfg.d;
    const len = +row.len || auto || 0;
    const hh = +row.h || wallHNum;
    const faces = row.faces === "both" || row.faces === "in-end" ? row.faces : "in";
    const label = wallMenu.extra ? (EDGE_LBL[row.edge] || "Added") + " wall (added · from the " + endLabel(row) + ")" : row.name + " wall";
    const upd = geom((patch) => (wallMenu.extra
      ? setXwalls((xs) => xs.map((x) => (x.id === xid ? { ...x, ...patch } : x)))
      : setWalls((ws) => ws.map((x, j) => (j === wi ? { ...x, ...patch } : x)))));
    const style = {
      top: Math.min(window.innerHeight - 180, wallMenu.y + 4),
      left: Math.min(window.innerWidth - 292, Math.max(12, wallMenu.x - 120)),
    };
    return createPortal(
      <div className="sch-swap sch-wallmenu" style={style} data-schluter-wallmenu
        onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
        <div className="ph">{label} — {sfOfWall(len, hh, faces).toFixed(1)} sf{facesTag(faces)}</div>
        <div className="wm-row">
          <label>Size</label>
          <NumIn className="win" value={row.len} placeholder={auto ? String(auto) : "len"} title="length, in — blank follows the room"
            onCommit={(v) => upd({ len: v })} />
          <span>×</span>
          <NumIn className="win" value={row.h} placeholder={String(wallHNum)} title="height, in — 40 for a half wall"
            onCommit={(v) => upd({ h: v })} />
          <span>in</span>
        </div>
        {wallMenu.extra && (() => {
          const horiz = row.edge === "back" || row.edge === "entry";
          const at = row.at === "hi" ? "hi" : "lo";
          const twin = xwalls.some((x) => x.edge === row.edge && x.id !== row.id && (x.at === "hi" ? "hi" : "lo") !== at);
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
                onClick={geom(() => {
                  wallSeq.current += 1;
                  setXwalls((xs) => [...xs, { ...row, id: wallSeq.current, at: at === "hi" ? "lo" : "hi" }]);
                  setWallMenu(null);
                })}>Both ends</button>
            </div>
          );
        })()}
        {/* which faces get covered — the wedi seg (owner ask 2026-08-24); the
            area feeds the board/membrane pick through the engine's faces rule */}
        <div className="wm-row">
          <label>{wallSys === "board" ? "Board" : "KERDI"}</label>
          <span className="pfseg">
            <button className={faces === "in" ? "on" : ""} title="cover the shower side only" onClick={() => upd({ faces: "" })} data-schluter-faces-in>Inside</button>
            <button className={faces === "both" ? "on" : ""} title="cover both sides — this wall's sf doubles" onClick={() => upd({ faces: "both" })} data-schluter-faces-both>Both sides</button>
            <button className={faces === "in-end" ? "on" : ""} title={'inside plus the exposed 4" end of the run'} onClick={() => upd({ faces: "in-end" })} data-schluter-faces-end>In + end</button>
          </span>
        </div>
        <div className="wm-note">
          {faces === "both" ? (wallSys === "board" ? "board on both faces — this wall's sf doubles" : "membrane on both faces — this wall's sf doubles")
            : faces === "in-end" ? 'the exposed 4" end takes a strip too'
              : wallSys === "board"
                ? "KERDI-BOARD panels the shower side — the sf feeds the wall pick"
                : "KERDI membrane over backer (by others) on the shower side"}
        </div>
        <div className="wm-row" style={{ paddingTop: 7, gap: 8 }}>
          {!wallMenu.extra && (
            <button className="wm-act" data-schluter-wall-off
              title={cfg.curbed
                ? "remove the wall — the curb runs this edge instead, butted square to the standing walls"
                : "turn the wall off — its area leaves the bill; its name button in the Walls group brings it back"}
              onClick={geom(() => {
                setWalls((ws) => ws.map((x, j) => (j === wi ? { ...x, on: false } : x)));
                setWallMenu(null);
                if (cfg.curbed) say("Wall turned into a curb — the run butts the standing walls square");
              })}>{cfg.curbed ? "Turn into a curb" : "Turn off"}</button>
          )}
          {wallMenu.extra && (
            <button className="wm-del" onClick={geom(() => { setXwalls((xs) => xs.filter((x) => x.id !== xid)); setWallMenu(null); })}>Remove</button>
          )}
        </div>
      </div>, document.body);
  })();

  // The bench menu (the wedi issue-069 idiom): everything about the zone's
  // bench lives in this one popover — decision 4's three forms, sizes,
  // Remove — anchored at the click like the wall menu.
  const CORNER_ZONE_LBL = { bl: "back-left", br: "back-right", fl: "entry-left", fr: "entry-right" };
  const benchMenuPanel = (() => {
    if (!benchMenu) return null;
    const zid = benchMenu.side || benchMenu.corner;
    const row = benches.find((b) => b.kind === benchMenu.kind && (b.side || b.corner) === zid);
    const title = benchMenu.kind === "corner"
      ? "Corner bench — " + (CORNER_ZONE_LBL[benchMenu.corner] || "")
      : "Bench — " + benchMenu.side + " wall";
    const style = {
      top: Math.min(window.innerHeight - 320, benchMenu.y + 4),
      left: Math.min(window.innerWidth - 312, Math.max(12, benchMenu.x - 140)),
    };
    const add = geom((spec) => {
      benchSeq.current += 1;
      setBenches((xs) => [...xs, {
        id: benchSeq.current, kind: benchMenu.kind,
        ...(benchMenu.kind === "corner" ? { corner: benchMenu.corner } : { side: benchMenu.side }),
        ...spec,
      }]);
      // a bench is room tuning — the Custom shower tab is where it gets
      // worked (owner rule 2026-08-24)
      setTab("custom");
    });
    const upd = geom((patch) => setBenches((xs) => xs.map((b) => (b === row ? { ...b, ...patch } : b))));
    const del = geom(() => { setBenches((xs) => xs.filter((b) => b !== row)); setBenchMenu(null); });
    const norm = row ? normBench(row, cfg, cat) : null;
    const pres = pool(cat.filter((i) => i.g === "extra" && i.extra === "bench"
      && (benchMenu.kind === "corner") === !!(i.bench && i.bench.corner))).sort(byShelf);
    const framedNote = (() => {
      if (!norm || norm.build !== "framed") return "";
      const t = benchTrayRoom([norm], cfg);
      return norm.trayFit === "smaller"
        ? `the options re-rank for the clear ${inches(t.w)}×${inches(t.d)} — the drain chases its centre unless pinned`
        : `the tray stays as picked and cuts to ${inches(t.w)}×${inches(t.d)} at the bench face — "Smaller tray" re-ranks for the clear space`;
    })();
    return createPortal(
      <div className="sch-swap sch-wallmenu sch-benchmenu" style={style} data-schluter-benchmenu
        onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
        <div className="ph">{title}</div>
        {!row ? (<>
          <button className="bm-opt" onClick={() => add({ build: "site" })} data-schluter-bench-site>
            <b>2″ KERDI-BOARD build-up</b><small>on the finished tray — 2″ top &amp; face + supports; the tray and curb run underneath</small>
          </button>
          {benchMenu.kind !== "corner" && (
            <button className="bm-opt" onClick={() => add({ build: "framed" })} data-schluter-bench-framed>
              <b>Framed by the installer</b><small>wrapped with ½″ KERDI-BOARD — the tray cuts at the bench face; its Smaller-tray option re-ranks for what is left</small>
            </button>
          )}
          {pres.length > 0 && <div className="ph">Premade KERDI-BOARD benches</div>}
          {pres.map((e) => (
            <button key={e.sku} className={"srow" + (e.stock ? " stk" : "")} onClick={() => add({ part: e.sku })} data-schluter-bench-pre={e.sku}>
              <span className={"sdot" + (e.stock ? "" : " so")} />
              <span className="n">{e.name}<small>{[e.size, e.sku, e.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
              <span className="p">{fm(tierOf(e))}</span>
            </button>
          ))}
        </>) : (<>
          {norm.build !== "premade" && norm.kind === "corner" && (
            <div className="wm-row">
              <label>Legs</label>
              <NumIn className="win" value={row.size ?? ""} placeholder={String(norm.size)} title="from the corner out along each wall, in"
                onCommit={(v) => upd({ size: v })} />
              <span>× h</span>
              <NumIn className="win" value={row.h ?? ""} placeholder={String(norm.h)} title="to the top, in"
                onCommit={(v) => upd({ h: v })} />
              <span>in</span>
            </div>
          )}
          {norm.build !== "premade" && norm.kind !== "corner" && (
            <div className="wm-row">
              <label>Size</label>
              <NumIn className="win" value={row.len ?? ""} placeholder={String(norm.len)} title="length along the wall, in"
                onCommit={(v) => upd({ len: v })} />
              <span>×</span>
              <NumIn className="win" value={row.depth ?? ""} placeholder={String(norm.depth)} title="seat depth, in"
                onCommit={(v) => upd({ depth: v })} />
              <span>×</span>
              <NumIn className="win" value={row.h ?? ""} placeholder={String(norm.h)} title="to the top, in"
                onCommit={(v) => upd({ h: v })} />
              <span>in</span>
            </div>
          )}
          {norm.build === "premade" && (
            <div className="wm-note">
              {(itemBySku(row.part) || {}).name || row.part}{(itemBySku(row.part) || {}).size ? " — " + itemBySku(row.part).size : ""}
              {norm.kind === "corner" ? `. ${norm.size}″ out along each wall, triangle across the front.` : "."} Sits on the finished tray, 20″ high, sloped top.
            </div>
          )}
          {norm.build !== "premade" && norm.kind !== "corner" && (
            <div className="wm-row">
              <label>Build</label>
              <span className="pfseg">
                <button className={norm.build === "site" ? "on" : ""} title="2″ KERDI-BOARD on the finished tray" onClick={() => upd({ build: "site" })}>2″ build-up</button>
                <button className={norm.build === "framed" ? "on" : ""} title="installer-framed, wrapped with ½″ board — the tray stops at its face" onClick={() => upd({ build: "framed" })}>Framed</button>
              </span>
            </div>
          )}
          {norm.build === "framed" && (
            // the wedi panFit fork: the tray choice never moves on its own —
            // "Smaller tray" is the opt-in that re-fits the clear space
            <div className="wm-row">
              <label>Tray</label>
              <span className="pfseg">
                <button className={norm.trayFit !== "smaller" ? "on" : ""} title="keep the tray as ranked for the full room — it cuts at the bench face"
                  onClick={() => upd({ trayFit: "cut" })} data-schluter-trayfit-cut>Cut it down</button>
                <button className={norm.trayFit === "smaller" ? "on" : ""} title="re-rank the tray options for the clear space — the drain chases its centre unless pinned"
                  onClick={() => upd({ trayFit: "smaller" })} data-schluter-trayfit-smaller>Smaller tray</button>
              </span>
            </div>
          )}
          {norm.build !== "premade" && (
            <div className="wm-note">
              {norm.build === "framed" ? framedNote
                : norm.kind === "corner" ? `${norm.size}″ out along each wall, triangle across the front — 2″ top, face & supports on the finished tray`
                  : "2″ top & face on the finished tray — the tray and curb run underneath"}
            </div>
          )}
          <div className="wm-row" style={{ paddingTop: 7 }}>
            <button className="wm-del" onClick={del} data-schluter-bench-del>Remove bench</button>
          </div>
        </>)}
      </div>, document.body);
  })();

  // The Niche and Bench chips' pickers: every choice in one list — the wedi
  // "a chip with several possible parts opens a picker" rule.
  const pickerPanel = (() => {
    if (!picker) return null;
    const style = {
      top: Math.min(window.innerHeight - 320, picker.y + 8),
      left: Math.min(window.innerWidth - 312, Math.max(12, picker.x - 150)),
    };
    if (picker.key === "bench") {
      const pres = pool(cat.filter((i) => i.g === "extra" && i.extra === "bench")).sort(byShelf);
      const wallPres = pres.filter((i) => !(i.bench && i.bench.corner));
      const cornerPres = pres.filter((i) => i.bench && i.bench.corner);
      // a chip pick has no clicked zone — it lands on the next open one; the
      // drawing's zone menu is where a bench moves after that
      const freeSide = ["back", "left", "right"].find((z) => !benches.some((b) => b.kind !== "corner" && (b.side || "back") === z));
      const freeCorner = ["bl", "br", "fl", "fr"].find((z) => !benches.some((b) => b.kind === "corner" && (b.corner || "bl") === z));
      const add = (kind, spec) => geom(() => {
        const zone = kind === "corner" ? freeCorner : freeSide;
        if (!zone) return;
        benchSeq.current += 1;
        setBenches((xs) => [...xs, { id: benchSeq.current, kind, ...(kind === "corner" ? { corner: zone } : { side: zone }), ...spec }]);
        // a bench is room tuning — the Custom shower tab is where it gets
        // worked (owner rule 2026-08-24)
        setTab("custom");
      });
      return createPortal(
        <div className="sch-swap sch-picker sch-benchmenu" style={style} data-schluter-picker onClick={(e) => e.stopPropagation()}>
          <div className="ph">Benches — a pick lands on the next open wall or corner; its zone on the drawing edits size, build and placement</div>
          {benches.map((b2) => {
            const nb = normBench(b2, cfg, cat);
            const it = nb.part ? itemBySku(nb.part) : null;
            const zone = nb.kind === "corner" ? (CORNER_ZONE_LBL[nb.corner] || nb.corner) + " corner" : nb.side + " wall";
            const lbl = it ? extraLbl(it.name) : nb.build === "framed" ? "Framed + ½″ wrap" : "2″ KERDI-BOARD build-up";
            return (
              <button key={"b" + b2.id} className="srow on" title="remove this bench" data-schluter-bench-row={b2.id}
                onClick={geom(() => setBenches((xs) => xs.filter((y) => y.id !== b2.id)))}>
                <span className="sdot" />
                <span className="n">✓ {lbl}<small>{zone} · click to remove</small></span>
                <span className="p">{it ? fm(tierOf(it)) : ""}</span>
              </button>
            );
          })}
          <button className="bm-opt" disabled={!freeSide} onClick={add("wall", { build: "site" })} data-schluter-benchpick-site>
            <b>2″ KERDI-BOARD build-up</b><small>on the finished tray, along a wall — 2″ top &amp; face + supports; the tray and curb run underneath</small>
          </button>
          <button className="bm-opt" disabled={!freeCorner} onClick={add("corner", { build: "site" })} data-schluter-benchpick-corner>
            <b>2″ corner build-up</b><small>triangle in a corner on the finished tray — 2″ top, face &amp; supports</small>
          </button>
          <button className="bm-opt" disabled={!freeSide} onClick={add("wall", { build: "framed" })} data-schluter-benchpick-framed>
            <b>Framed by the installer</b><small>wrapped with ½″ KERDI-BOARD — the tray cuts at the bench face; its Smaller-tray option re-ranks for what is left</small>
          </button>
          {(wallPres.length > 0 || cornerPres.length > 0) && <div className="ph">Premade KERDI-BOARD benches</div>}
          {wallPres.map((e) => (
            <button key={e.sku} className={"srow" + (e.stock ? " stk" : "")} disabled={!freeSide}
              onClick={add("wall", { part: e.sku })} data-schluter-benchpick={e.sku}>
              <span className={"sdot" + (e.stock ? "" : " so")} />
              <span className="n">{e.name}<small>{[e.size, e.sku, e.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
              <span className="p">{fm(tierOf(e))}</span>
            </button>
          ))}
          {cornerPres.map((e) => (
            <button key={e.sku} className={"srow" + (e.stock ? " stk" : "")} disabled={!freeCorner}
              onClick={add("corner", { part: e.sku })} data-schluter-benchpick={e.sku}>
              <span className={"sdot" + (e.stock ? "" : " so")} />
              <span className="n">{e.name}<small>{[e.size, e.sku, e.stock ? "stock" : "special order", "corner"].filter(Boolean).join(" · ")}</small></span>
              <span className="p">{fm(tierOf(e))}</span>
            </button>
          ))}
          {(() => {
            // the KERS-B seal kits ride the same dropdown — they're bench
            // goods, but an accessory line, not a placed bench
            const kits = pool(cat.filter((i) => i.g === "extra" && i.extra === "benchkit")).sort(byShelf);
            if (!kits.length) return null;
            return (<>
              <div className="ph">Bench accessories</div>
              {kits.map((e) => {
                const n = qtyIn(e.sku);
                return (
                  <button key={e.sku} className={"srow" + (n ? " on" : e.stock ? " stk" : "")}
                    onClick={() => setQty(e.sku, n ? 0 : 1)} data-schluter-benchkit={e.sku}>
                    <span className={"sdot" + (e.stock ? "" : " so")} />
                    <span className="n">{(n ? "✓ " : "") + e.name}<small>{[e.size, e.sku, e.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
                    <span className="p">{fm(tierOf(e))}</span>
                  </button>
                );
              })}
            </>);
          })()}
        </div>, document.body);
    }
    const list = pool(cat.filter((i) => i.g === "extra" && i.extra === "niche")).sort(byShelf);
    return createPortal(
      <div className="sch-swap sch-picker" style={style} data-schluter-picker onClick={(e) => e.stopPropagation()}>
        <div className="ph">Niches — self-contained: band frame + screws in the box</div>
        {list.map((e) => {
          const n = qtyIn(e.sku);
          return (
            <button key={e.sku} className={"srow" + (n ? " on" : e.stock ? " stk" : "")}
              onClick={() => setQty(e.sku, n ? 0 : 1)} data-schluter-pick={e.sku}>
              <span className={"sdot" + (e.stock ? "" : " so")} />
              <span className="n">{(n ? "✓ " : "") + e.name}<small>{[e.size, e.sku, e.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
              <span className="p">{fm(tierOf(e))}</span>
            </button>
          );
        })}
      </div>, document.body);
  })();

  // The ⇄ swap popover — the wedi anchored panel: the line's alternatives,
  // stock tinted, the standing pick highlighted.
  const swapPanel = (() => {
    if (!swap || !build) return null;
    const line = build.lines.find((l) => !l.noteOnly && (l.item.sku || l.item.name) === swap.key);
    if (!line) return null;
    const ch = swapChoices(line);
    if (!ch) return null;
    const r = swap.rect;
    const style = { top: Math.min(window.innerHeight - 356, r.bottom + 6), left: Math.max(12, r.right - 300) };
    return createPortal(
      <div className="sch-swap sch-swappanel" style={style} onClick={(e) => e.stopPropagation()}>
        <div className="ph">{ch.title}</div>
        {ch.list.map((e) => (
          <button key={e.sku} className={"srow" + (e.sku === line.item.sku ? " on" : "") + (e.stock ? " stk" : "")}
            onClick={() => { ch.set(e.sku); setSwap(null); }} data-schluter-swaprow={e.sku}>
            <span className={"sdot" + (e.stock ? "" : " so")} />
            <span className="n">{e.name}<small>{[e.size, e.sku, e.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
            <span className="p">{fm(tierOf(e))}</span>
          </button>
        ))}
      </div>, document.body);
  })();

  // Kit row over customized work: confirm before wiping it (the wedi
  // overwrite modal, KitOverwriteConfirm — three ways forward, 2026-09-02).
  const confirmModal = confirmKit && (() => {
    const done = (fn) => () => { const t = confirmKit; setConfirmKit(null); fn(t); };
    return (
      <KitOverwriteConfirm vendor="schluter" kitName={rowSz(confirmKit)} kitWord="shelf kit"
        onCancel={() => setConfirmKit(null)}
        onOverwrite={done(pickKit)} onKeep={done(keepAdded)}
        onNew={onBasketChange ? done(newShower) : undefined} />
    );
  })();

  // The print layout (round 8, the wedi sheet): both drawings, the cut list
  // and by-others notes, and the materials table through the tier lens —
  // portalled to body so PRINT_CSS can make it the only thing that prints.
  const printSheet = printing && diag && build && createPortal(
    <div className="sch-printsheet">
      <style>{PRINT_CSS}</style>
      <div className="ps-head">
        <div className="t">Schluter Shower Layout</div>
        {projectName ? <div className="sub">{projectName}</div> : null}
        <div className="dt">{new Date().toLocaleDateString()}</div>
      </div>
      <div className="ps-diags">
        <div className="d">
          <TopDown o={diag} w={460} h={360} wallOn={wallOn} dWalls={dWalls} benches={normBenches}
            itemFn={itemBySku} normBenchFn={(z, room) => normBench(z, room, cat)}
            cuts={cornerCuts} curbs={curb.segs} curbDiags={curb.diags} curbW={curb.w} /></div>
        <div className="d">
          <Iso o={diag} w={460} h={360} dWalls={dWalls} benches={normBenches}
            itemFn={itemBySku} normBenchFn={(z, room) => normBench(z, room, cat)}
            cuts={cornerCuts} curbs={curb.segs} curbDiags={curb.diags} curbH={curb.h} curbW={curb.w} /></div>
      </div>
      {(cutList.length > 0 || build.lines.some((l) => l.noteOnly)) && (<>
        <div className="ps-sec">Cuts &amp; install notes</div>
        {cutList.map((r, i) => <div className="ps-warn" key={i}>{r}</div>)}
        {build.lines.filter((l) => l.noteOnly).map((l, i) => (
          <div className="ps-warn" key={"n" + i}>• {l.item.name}{l.note ? " — " + l.note : ""}</div>
        ))}
      </>)}
      <div className="ps-sec">Materials</div>
      <table className="ps-table">
        <thead><tr><th>SKU</th><th>Description</th><th>Size</th><th className="num">Qty</th><th className="num">{tierId}</th><th className="num">Total</th></tr></thead>
        <tbody>
          {GROUPS.flatMap((g) => build.lines.filter((l) => l.g === g && !l.noteOnly).map((l, li) => {
            const p = tierOf(l.item);
            return (
              <tr key={g + (l.item.sku || l.item.name) + li}>
                <td>{l.item.stock ? l.item.erp || l.item.sku : l.item.sku ? "Schluter " + l.item.sku : "—"}</td>
                <td>{l.item.name}</td><td>{l.item.size || ""}</td>
                <td className="num">{l.qty}</td><td className="num">{fm(p)}</td><td className="num">{fm(round2(p * l.qty))}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
      <div className="ps-tot"><span>{build.lines.filter((l) => !l.noteOnly).length} lines</span><span>{tierId} total {fm(totals.sell)}</span></div>
    </div>, document.body);

  const nStock = cat.filter((e) => e.stock).length;
  const TAB_DEFS = [
    ["kits", "Kits", trays.length + " trays"],
    ["custom", "Custom shower", "solver"],
    ["browse", "Browse", nStock + " stock · " + (cat.length - nStock) + " SO"],
    ["compare", "Compare", "wedi ⇄ Schluter"],
  ];

  // The compare surface spans the whole body — its own two-column grid IS the
  // comparison, so the build column and the drawings rail step aside.
  //
  // The registry bag below is what the tab needs to assemble the OTHER engine's
  // catalog — here, wedi's. wedi.js's catalog is installable module state, see
  // usewedicatalog.js. With nothing installed, the tab's wedi column prices
  // off the transcribed WEDI_STOCK table, and its quote-options footer commits
  // those prices into the project. This popup does NOT call the hook itself —
  // that would drag wedi.js's tables into the Schluter chunk, which the lazy
  // boundary above exists to prevent — so the install happens inside the
  // compare chunk, where both engines already live.
  const compareTab = (
    <Suspense fallback={null}>
      <CompareTab host="schluter" hostCfg={markCfg} hostBuild={build} cat={cat}
        hostMode={mode}
        source={source} tier={tierId}
        wediBuilderPct={wediBuilderPct} schluterBuilderPct={bPct}
        books={books} loadBookItems={loadBookItems} bookStockReady={bookStockReady}
        mortars={mortars} mortarDefault={mortarDefault}
        areaName={areaName} onQuoteOptions={onQuoteOptions} />
    </Suspense>
  );

  return (
    <div ref={shellRef} className={embedded
      ? "relative flex-1 min-h-0 flex flex-col overflow-auto"
      : "print:hidden fixed inset-0 z-[70] flex items-start justify-center overflow-auto p-4"}
      style={embedded ? undefined : { background: "rgba(20,15,10,.55)" }} onClick={embedded ? undefined : onClose}>
      <style>{CSS}</style>
      <div className={`sch-pop relative w-full flex flex-col overflow-hidden ${embedded
        ? "flex-1 min-h-0 min-w-[1120px]"
        : "max-w-[1680px] rounded-xl border shadow-2xl"}`}
        style={embedded
          ? { background: "var(--ft-cream)", zoom: fit.zoom }
          : { background: "var(--ft-cream)", borderColor: "var(--ft-border-strong)", height: fit.h, minHeight: 560, zoom: fit.zoom }}
        onClick={embedded ? undefined : (e) => e.stopPropagation()} data-schluter-pop>
        <div className="pop-head">
          <div>
            <div className="eyebrow">Vendor configurator</div>
            <div className="name">Schluter <small>shower systems · registry-priced (retail = 1.5× cost)</small></div>
          </div>
          <div className="headctl">
            {onBasketChange && <button className="relative inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-slate-50" onClick={() => setBasketOpen(true)} data-schluter-basket>
              🧺 Basket{(basket || []).length > 0 && <span className="rounded-full bg-[color:var(--ft-brand)] text-white text-[11px] font-extrabold min-w-[18px] h-[18px] px-1 flex items-center justify-center">{basket.length}</span>}
            </button>}
            <button className="rclear" data-schluter-clear
              title="wipe the build — room, walls, benches, add-ons — and reset the form"
              onClick={clearDesign}>Clear design</button>
            <SourceSwitch source={source} onChange={(s) => { setSource(s); setPick(null); }} />
            {tierBar}
            {!embedded && <button className="xbtn" onClick={onClose} title="Close"><X size={15} /></button>}
          </div>
        </div>
        <div className="modetabs">
          {TAB_DEFS.map((t) => (
            <button key={t[0]} className={"modetab" + (tab === t[0] ? " on" : "")} onClick={() => setTab(t[0])}>{t[1]}<small>{t[2]}</small></button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-x-auto flex">
          <div className="pop-body flex-1">
            {tab === "compare" ? compareTab : (<>
              <div className="main">{tab === "kits" ? kitsTab : tab === "custom" ? customTab : browseTab}</div>
              <div className="buildcol">{buildCol}</div>
              {diagRail}
            </>)}
          </div>
        </div>
        <div className={`absolute inset-0 z-[55] transition-opacity ${basketOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} style={{ background: "rgba(20,15,10,.4)" }} onClick={() => setBasketOpen(false)} />
        <div className={`absolute top-0 right-0 bottom-0 z-[56] w-[400px] max-w-full bg-white border-l border-slate-300 shadow-2xl transition-transform ${basketOpen ? "translate-x-0" : "translate-x-full"}`}>
          <KitBasketPanel staged={stagedViews} sel={basketSel}
            onToggle={(id) => setBasketSel((s) => ({ ...s, [id]: !s[id] }))}
            onSelectAll={() => { const all = stagedViews.every((v) => basketSel[v.id]); const next = {}; stagedViews.forEach((v) => { next[v.id] = !all; }); setBasketSel(next); }}
            onRemove={(id) => onBasketChange((basket || []).filter((b) => b.id !== id))}
            onMove={onMoveEntries ? () => moveEntries(stagedViews.filter((v) => basketSel[v.id]).map((v) => v.id)) : undefined}
            onMoveAll={() => moveEntries(stagedViews.map((v) => v.id))}
            placed={placedViews} onEditPlaced={(k) => onOpenPlaced?.(k)} onDeletePlaced={(k) => onDeleteKit?.(k)}
            areaName={areaName} tierColor={tierColor} onClose={() => setBasketOpen(false)} />
        </div>
      </div>
      {wallMenuPanel}
      {benchMenuPanel}
      {pickerPanel}
      {swapPanel}
      {confirmModal}
      {payloadModal}
      {printSheet}
      {toast && createPortal(<div className="sch-toast" onClick={(e) => e.stopPropagation()}>{toast}</div>, document.body)}
    </div>
  );
}

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
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Eye } from "lucide-react";
import { useEscClose } from "./widgets.jsx";
import { TIER_COLOR } from "./uiconst.js";
import {
  catalogOf, trayCandidates, pickRolls, buildKit, tierPrice, lineItems,
} from "./schluter.js";
import { adaptBookRows, mortarItemFrom, MORTAR_BED_SF_PER_BAG } from "./schluteradapter.js";
import { schluterDiag, schluterWalls, schluterWallOn, schluterCurb } from "./schluterdraw.js";
import { TopDown, Iso, railSplit, RAIL_DESIGN_W, round2 } from "./showerdraw.jsx";

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
.sch-pop .rseg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:3px 8px;cursor:pointer;white-space:nowrap}
.sch-pop .rseg button + button{border-left:1px solid var(--ft-border)}
.sch-pop .rseg button:hover:not(.on){background:var(--ft-hover);color:var(--ft-text)}
.sch-pop .rseg button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
.sch-pop .wsnote{font-size:10px;color:var(--ft-faint);font-weight:600;line-height:1.4;margin-top:3px;max-width:280px}
.sch-pop .wallrow{display:flex;align-items:center;gap:5px;padding:2px 0;border-bottom:1px dashed var(--ft-row-line);font-size:10px;color:var(--ft-faint);font-weight:600}
.sch-pop .wallrow:last-child{border-bottom:none}
.sch-pop .wname{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:5px;font-size:9.5px;font-weight:800;color:var(--ft-faint);padding:2px 0;cursor:pointer;width:44px;text-align:center;flex:none}
.sch-pop .wname.on{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff}
.sch-pop .win{width:40px;flex:none;border:1px solid var(--ft-border-strong);border-radius:4px;font-size:10.5px;font-weight:700;text-align:center;padding:2px;background:var(--ft-card);color:var(--ft-text)}
.sch-pop .win:disabled{opacity:.5}
.sch-pop .wallrow .wu{margin-left:auto;font-variant-numeric:tabular-nums;white-space:nowrap}
.sch-pop .optrow{display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:9px;margin-bottom:10px}
.sch-pop .optcard{min-width:0;border:1px solid var(--ft-border-strong);border-radius:9px;background:var(--ft-card);padding:9px 11px;cursor:pointer;text-align:left;color:inherit}
.sch-pop .optcard:hover{border-color:var(--ft-brand)}
.sch-pop .optcard.on{outline:2px solid var(--ft-brand);outline-offset:-1px;background:var(--ft-tint)}
.sch-pop .optcard .rank{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-brand-deep)}
.sch-pop .optcard .rank.warn{color:var(--s-rust)}
.sch-pop .optcard .big{font-size:15px;font-weight:800;margin:2px 0 1px;letter-spacing:-.01em}
.sch-pop .optcard .sub{font-size:10.5px;color:var(--ft-muted);line-height:1.45;min-height:29px}
.sch-pop .optcard .foot{display:flex;align-items:center;gap:6px;margin-top:6px}
.sch-pop .optcard .foot .pr{font-weight:800;font-size:12.5px;margin-left:auto;font-variant-numeric:tabular-nums}
.sch-pop .stockdot{display:inline-flex;align-items:center;gap:4px;font-size:9.5px;font-weight:700;color:var(--ft-brand-deep);background:var(--ft-brand-soft);border-radius:4px;padding:1px 6px}
.sch-pop .stockdot.so{color:var(--s-rust);background:var(--ft-hover-red,#F7E8E1)}
.sch-pop .chipset{display:flex;gap:5px;flex-wrap:wrap}
.sch-pop .chip{border:1px solid var(--ft-border-strong);background:var(--ft-card);color:var(--ft-muted);border-radius:6px;font-size:11px;font-weight:700;padding:4px 9px;cursor:pointer}
.sch-pop .chip:hover:not(.on):not(:disabled){background:var(--ft-hover);color:var(--ft-text)}
.sch-pop .chip.on{background:var(--ft-seg-on-bg);border-color:var(--ft-brand);color:var(--ft-brand-deep);font-weight:800;box-shadow:inset 0 0 0 .5px var(--ft-brand)}
.sch-pop .chip:disabled{opacity:.35;cursor:not-allowed}
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
`;

const DEF_WALLS = [
  { name: "Back", on: true, h: "84" },
  { name: "Left", on: true, h: "84" },
  { name: "Right", on: true, h: "84" },
];

function seedState(seed) {
  const s = {
    tab: "kits", w: "60", d: "38", curbed: true, drain: "point", wallSys: "membrane",
    walls: DEF_WALLS.map((x) => ({ ...x })), bench: null, mortarName: "",
    manual: [], q: "", source: "all", kitPick: false,
  };
  if (!seed) return s;
  const cfg = seed.cfg;
  if (cfg && cfg.w) {
    // a saved product.schluter marker — reopen the room as it was built
    s.tab = "custom";
    s.w = String(cfg.w); s.d = String(cfg.d);
    s.curbed = cfg.curbed !== false;
    s.drain = ["point", "offset", "linear"].includes(cfg.drain) ? cfg.drain : "point";
    s.wallSys = cfg.wallSys === "board" ? "board" : "membrane";
    if (Array.isArray(cfg.walls) && cfg.walls.length === 3) {
      s.walls = s.walls.map((w, i) => ({ ...w, on: cfg.walls[i].on !== false, h: String(+cfg.walls[i].h || 84) }));
    }
    s.bench = cfg.bench === "framed" || cfg.bench === "buildup" ? cfg.bench : null;
    s.mortarName = cfg.mortarItem?.name || "";
    s.manual = Array.isArray(cfg.manual) ? cfg.manual.map((m) => ({ ...m })) : [];
    s.source = cfg.source === "stock" ? "stock" : "all";
    s.kitPick = seed.mode === "kit";
    return s;
  }
  if (seed.tab) s.tab = seed.tab === "custom" ? "custom" : seed.tab === "browse" ? "browse" : "kits";
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
  seed, tier, onTierChange, schluterBuilderPct, onAdd, onClose, areaName, projectName,
  onConfigChange, embedded = false,
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
  const [bench, setBench] = useState(s0.bench);
  const [mortarName, setMortarName] = useState(s0.mortarName);
  const [manual, setManual] = useState(s0.manual);
  const [pick, setPick] = useState(null);       // chosen tray candidate's sku
  const [kitPick, setKitPick] = useState(s0.kitPick);
  const [q, setQ] = useState(s0.q);
  const [sec, setSec] = useState("");
  const [sub, setSub] = useState("");
  const [figOpen, setFigOpen] = useState(false);
  const [figSf, setFigSf] = useState("");
  const [payload, setPayload] = useState(null);
  const [showMargin, setShowMargin] = useState(false);

  // any edit to the room makes the build a custom shower, not the kit
  const custom = (fn) => (...a) => { setKitPick(false); setPick(null); fn(...a); };

  // --- the catalog: live registry rows through the adapter -------------------
  // Stock side: the boot cache's stock-kind rows (bookStockReady gates it).
  // Special-order side: any active order book that says Schluter, fetched on
  // open (ADR 0026's re-fetch-on-open pattern; the EFT import lands here).
  const [orderRows, setOrderRows] = useState(null);
  useEffect(() => {
    let alive = true;
    const targets = (books || []).filter((b) => b.kind === "order" && b.active !== false
      && /schluter/i.test((b.name || "") + " " + (b.data?.brandLabel || "")));
    if (!targets.length || !loadBookItems) { setOrderRows([]); return; }
    Promise.all(targets.map((b) => loadBookItems(b.id).catch(() => [])))
      .then((lists) => { if (alive) setOrderRows(lists.flat().filter((it) => it.active !== false && !it.disabled)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const catReady = !!bookStockReady && orderRows !== null;
  const cat = useMemo(() => {
    if (!catReady) return [];
    const stockAdapted = adaptBookRows((stockRows || []).filter((it) => it.active !== false && !it.disabled), { stock: true });
    const seen = new Set(stockAdapted.map((e) => e.sku));
    const orderAdapted = adaptBookRows(orderRows, { stock: false }).filter((e) => !seen.has(e.sku));
    return catalogOf(stockAdapted.concat(orderAdapted));
  }, [catReady, stockRows, orderRows]);

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

  useEscClose(true, () => { if (payload) setPayload(null); else onClose(); });

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
  }, []);
  const railFit = useMemo(() => railSplit(railBox, false), [railBox]);

  // --- the build -------------------------------------------------------------
  const mortarItem = useMemo(
    () => mortarItemFrom(mortarName || mortarDefault || "", mortars || {}),
    [mortarName, mortarDefault, mortars]);
  const cfg = useMemo(() => ({
    w: +w || 0, d: +d || 0, curbed, drain, wallSys, bench,
    walls: walls.map((x, i) => ({ name: x.name, on: x.on, len: i === 0 ? +w || 0 : +d || 0, h: +x.h || 84 })),
    ...(mortarItem ? { mortarItem } : {}),
  }), [w, d, curbed, drain, wallSys, bench, walls, mortarItem]);

  const cands = useMemo(() => (catReady && cat.length ? trayCandidates(cfg, cat, { source }) : []), [catReady, cat, cfg, source]);
  const pickCand = (pick && cands.find((c) => c.tray && c.tray.sku === pick)) || cands[0] || null;
  const build = useMemo(() => {
    if (!pickCand) return null;
    const b = buildKit(cfg, cat, { source, pick: pickCand });
    manual.forEach((m) => {
      const e = cat.find((i) => i.sku === m.sku);
      if (e) b.lines.push({ g: "Extras", item: e, qty: m.qty, so: !e.stock });
    });
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, cat, source, pickCand, manual]);
  const mode = kitPick && !manual.length && !bench ? "kit" : "custom";
  const markCfg = useMemo(() => ({ ...cfg, manual, source }), [cfg, manual, source]);
  const rows = useMemo(
    () => (build ? lineItems({ ...build, mode, cfg: markCfg }, { builderPct: bPct }) : []),
    [build, mode, markCfg, bPct]);

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

  // --- drawings --------------------------------------------------------------
  const diag = useMemo(() => (pickCand ? schluterDiag(cfg, pickCand) : null), [cfg, pickCand]);
  const dWalls = useMemo(() => schluterWalls(cfg), [cfg]);
  const wallOn = useMemo(() => schluterWallOn(cfg), [cfg]);
  const curb = useMemo(() => schluterCurb(cfg), [cfg]);

  const cutList = useMemo(() => {
    if (!build || !pickCand) return [];
    const out = [];
    if (pickCand.tray && pickCand.cut) {
      out.push(`✂ Cut ${pickCand.tray.sku} to ${inches(cfg.w)} × ${inches(cfg.d)} (from ${szLbl(pickCand.tray)})${pickCand.deep ? " — deep cut, drain moves off-centre" : ""}`);
    }
    const ch = build.lines.find((l) => l.item.part === "channel");
    if (ch && /cut to/.test(ch.note || "")) out.push(`✂ Trim the Vario channel + grate ${ch.note.match(/cut to \d+"/)[0].replace("cut to ", "to ")} — end caps supplied, min 10"`);
    const cl = build.lines.find((l) => l.g === "Curb" && l.item.len);
    if (cl && /cut/.test(cl.note || "")) out.push(`✂ ${cl.qty > 1 ? cl.qty + "× " : ""}${cl.item.name} — ${(cl.note || "").split(" — ")[0]}`);
    (diag?.warnings || []).forEach((x) => out.push("• " + x));
    if (cfg.wallSys === "membrane") out.push("• Backer behind the membrane is by others — cement board or drywall");
    if (!cfg.curbed) out.push("• Curbless needs the floor recessed or the ramp — KERDI-SHOWER-FRS recess system lands Fall 2026");
    return out;
  }, [build, pickCand, cfg, diag]);

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

  const trays = useMemo(() => cat.filter((i) => i.g === "tray")
    .sort((a, b) => ((a.drain === "linear" ? 1 : 0) - (b.drain === "linear" ? 1 : 0)) || (a.w * a.d) - (b.w * b.d) || a.sku.localeCompare(b.sku)), [cat]);

  const pickKit = (t) => {
    setW(String(t.w)); setD(String(t.d)); setDrain(t.drain === "linear" ? "linear" : t.drain);
    setBench(null); setManual([]); setPick(null); setKitPick(true); setTab("custom");
  };

  const kitsTab = !catReady || !cat.length ? loadingPane : (
    <>
      <div className="fam-h"><div className="t">Trays</div>
        <div className="hint">the whole KST / LTS lineup — click one and the build column fills the shelf kit in. The factory boxed kits (special order) live in Browse → Factory kits</div></div>
      {trays.map((t) => {
        const dis = source === "stock" && !t.stock;
        return (
          <button key={t.sku} className={"kitrow" + (dis ? " dis" : "")} disabled={dis} onClick={() => pickKit(t)} data-schluter-tray={t.sku}>
            <span className="sz">{szLbl(t)}<small>{t.drain}</small></span>
            <span className={"tag" + (t.stock ? "" : " so")}>{t.stock ? "stock" : "special order"}</span>
            <span className="sku">{t.sku} — {t.name}</span>
            <span className="pr" style={{ color: tierColor }}>{fm(tierOf(t))}</span>
          </button>
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
      <button key={c.tray.sku + i} className={"optcard" + (pickCand === c ? " on" : "")} onClick={() => setPick(c.tray.sku)} data-schluter-opt={c.tray.sku}>
        <div className={"rank" + (c.deep ? " warn" : "")}>{c.kind === "exact" ? "Exact tray" : c.deep ? "Deep cut" : "Cut down"}</div>
        <div className="big">{szLbl(c.tray)}</div>
        <div className="sub">{c.kind === "exact" ? "Drops in as-is, drain on layout."
          : `Trim ${c.cut}″ total to hit ${inches(cfg.w)}×${inches(cfg.d)}${c.deep ? " — past the 6″ soft rule, drain moves off-centre" : ""}.`}</div>
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

  const customTab = !catReady || !cat.length ? loadingPane : (
    <>
      <div className="roomform">
        <div className="rfgrid">
          <div className="rfgrp room">
            <div className="h">Room</div>
            <div className="rfflow">
              <div className="rf"><label>Size</label>
                <div className="dims">
                  <input className="rinp" type="number" value={w} onChange={custom((e) => setW(e.target.value))} data-schluter-w />
                  <span>×</span>
                  <input className="rinp" type="number" value={d} onChange={custom((e) => setD(e.target.value))} data-schluter-d />
                  <span>in</span>
                </div>
              </div>
              <div className="rf"><label>Entry</label>
                <div className="rseg">
                  <button className={curbed ? "on" : ""} onClick={custom(() => setCurbed(true))}>Curbed</button>
                  <button className={!curbed ? "on" : ""} onClick={custom(() => setCurbed(false))}>Curbless</button>
                </div>
              </div>
              <div className="rf"><label>Drain</label>
                <div className="rseg">
                  <button className={drain === "point" ? "on" : ""} onClick={custom(() => setDrain("point"))}>Point · centre</button>
                  <button className={drain === "offset" ? "on" : ""} onClick={custom(() => setDrain("offset"))}>Point · offset</button>
                  <button className={drain === "linear" ? "on" : ""} onClick={custom(() => setDrain("linear"))}>Linear at wall</button>
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
            <div className="h">Walls</div>
            {walls.map((x, i) => (
              <div className={"wallrow"} key={x.name}>
                <button className={"wname" + (x.on ? " on" : "")} onClick={custom(() => setWalls((ws) => ws.map((y, j) => (j === i ? { ...y, on: !y.on } : y))))}>{x.name}</button>
                <input className="win" value={i === 0 ? w : d} disabled readOnly />
                <span>×</span>
                <input className="win" type="number" value={x.h} onChange={custom((e) => { const v = e.target.value; setWalls((ws) => ws.map((y, j) => (j === i ? { ...y, h: v } : y))); })} />
                <span className="wu">{x.on ? (((i === 0 ? +w : +d) || 0) * (+x.h || 0) / 144).toFixed(1) + " sf" : "off"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {mortarCard}
      <div className="fam-h"><div className="t">Options</div><div className="hint">ranked — click one to build from it</div></div>
      <div className="optrow">{optCards}</div>
      <div className="fam-h"><div className="t">Add-ons</div><div className="hint">niches, premade benches — land as build lines</div></div>
      <div className="chipset">
        {cat.filter((i) => i.g === "extra").map((x) => {
          const on = qtyIn(x.sku) > 0;
          const dis = source === "stock" && !x.stock;
          return (
            <button key={x.sku} className={"chip" + (on ? " on" : "")} disabled={dis}
              onClick={() => setQty(x.sku, on ? 0 : 1)} data-schluter-extra={x.sku}>{extraLbl(x.name)}</button>
          );
        })}
      </div>
      <div className="fam-h" style={{ marginTop: 10 }}><div className="t">Site-built bench</div>
        <div className="hint">the wedi bench doctrine — premade (above) sits on the tray; framed interrupts the envelope; 2″ board builds up on it</div></div>
      <div className="chipset">
        <button className={"chip" + (bench === "framed" ? " on" : "")} onClick={() => { setBench((b) => (b === "framed" ? null : "framed")); }}>Framed + ½″ board wrap</button>
        <button className={"chip" + (bench === "buildup" ? " on" : "")} onClick={() => { setBench((b) => (b === "buildup" ? null : "buildup")); }}>2″ board build-up on tray</button>
      </div>
    </>
  );

  const secObj = SECTIONS.find((s) => s.key === sec) || null;
  const subObj = secObj && secObj.subs ? secObj.subs.find((s) => s.key === sub) || null : null;
  const browseList = useMemo(() => {
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    return cat
      .filter((i) => source === "all" || i.stock)
      .filter((i) => !secObj || (subObj ? subObj.hit(i) : sectionHit(secObj, i)))
      .filter((i) => {
        if (!toks.length) return true;
        const hay = (i.name + " " + i.sku + " " + (i.erp || "") + " " + (i.size || "") + " " + i.g).toLowerCase();
        return toks.every((t) => hay.indexOf(t) >= 0);
      })
      .sort((a, b) => ((b.stock ? 1 : 0) - (a.stock ? 1 : 0)) || (a.g > b.g ? 1 : a.g < b.g ? -1 : 0) || (+a.price || 0) - (+b.price || 0));
  }, [cat, q, secObj, subObj, source]);

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
        </div>
      </div>
      {figOpen && (
        <div className="figcard">
          Wall area <input className="inp" type="number" value={figSfVal} onChange={(e) => setFigSf(e.target.value)} /> sf
          {" → "}<b>{figRolls.map((p) => p.qty + "× " + ((p.item.size || "").split("=")[1] || p.item.sf + " sf").trim()).join(" + ") || "—"}</b> KERDI
          {allset ? <> · <b>{figBags}</b> bag{figBags > 1 ? "s" : ""} ALL-SET (walls + {floorSfNow.toFixed(0)} sf floor)</> : null}
          <div className="figfoot">ALL-SET at ≈{allset ? allset.sfPerBag : 55} sf/bag (1/4″×1/4″ est.) · KERDI +10% for laps · band, corners and seals ride the build's Seams group</div>
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
      {!browseList.length && <div className="loading">Nothing matches.</div>}
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
        <div className="bc-foot"><div className="btnrow"><button className="wbtn primary" disabled>Add to product lines</button></div></div>
      </>
    );
    return (
      <>
        <div className="bc-scroll">
          <div className="bc-h">
            <div className="t">Build</div>
            <div className="sub">{inches(cfg.w)}×{inches(cfg.d)} · {cfg.curbed ? "curbed" : "curbless"} · {cfg.drain} drain · {cfg.wallSys === "board" ? "KERDI-BOARD walls" : "KERDI membrane walls"}{pickCand && pickCand.cut ? ` · tray cut ${pickCand.cut}″` : ""}</div>
          </div>
          {GROUPS.map((g) => {
            const gl = build.lines.filter((l) => l.g === g);
            if (!gl.length) return null;
            return (
              <div className="bgroup" key={g}>
                <div className="bg-h">{g}</div>
                {gl.map((l, li) => {
                  const e = l.item;
                  const price = tierOf(e);
                  const meta = [e.sku, e.size, l.note].filter(Boolean);
                  return (
                    <div className={"bline" + (l.noteOnly ? " note" : "")} key={g + (e.sku || e.name) + li}>
                      <div className="bn">
                        <div className="n">{l.noteOnly ? "" : l.qty + "× "}{e.name}
                          {!l.noteOnly && !e.stock && <span className="sotag">special order</span>}</div>
                        <div className="m" title={meta.join(" · ") || undefined}>{meta.map((s2, k) => (k ? " · " + s2 : <b key="k">{s2}</b>))}</div>
                      </div>
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
            <button className="wbtn primary" onClick={() => setPayload(rows)} data-schluter-add><Plus size={13} /> Add to product lines</button>
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
        <TopDown o={diag} w={railFit.w} h={railFit.plan} wallOn={wallOn} dWalls={dWalls} benches={[]}
          cuts={[]} curbs={curb.segs} curbDiags={curb.diags} curbW={curb.w} />
        <Iso o={diag} w={railFit.w} h={railFit.iso} dWalls={dWalls} benches={[]}
          cuts={[]} curbs={curb.segs} curbDiags={curb.diags} curbH={curb.h} curbW={curb.w} />
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
          <div className="text-sm font-extrabold">Add to product lines — the payload</div>
          <div className="text-[11px] font-semibold text-slate-500">{payload.length} rows land on the job sheet{areaName ? " in " + areaName : ""}</div>
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
          <button className="wbtn primary" style={{ flex: "none", padding: "8px 16px" }} data-schluter-confirm
            onClick={() => { setPayload(null); onAdd(payload); }}>
            <Plus size={13} /> Add {payload.length} row{payload.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );

  const nStock = cat.filter((e) => e.stock).length;
  const TAB_DEFS = [
    ["kits", "Kits", trays.length + " trays"],
    ["custom", "Custom shower", "solver"],
    ["browse", "Browse", nStock + " stock · " + (cat.length - nStock) + " SO"],
  ];

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
            <div className="srcseg" title="Stock only removes non-stocked parts from the candidate pool; Full catalog ranks freely and tags special order">
              <button className={source === "stock" ? "on" : ""} onClick={() => { setSource("stock"); setPick(null); }} data-schluter-src-stock>Stock only</button>
              <button className={source === "all" ? "on" : ""} onClick={() => { setSource("all"); setPick(null); }} data-schluter-src-all>Full catalog</button>
            </div>
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
            <div className="main">{tab === "kits" ? kitsTab : tab === "custom" ? customTab : browseTab}</div>
            <div className="buildcol">{buildCol}</div>
            {diagRail}
          </div>
        </div>
      </div>
      {payloadModal}
    </div>
  );
}

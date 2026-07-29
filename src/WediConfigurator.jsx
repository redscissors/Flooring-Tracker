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
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Printer, ClipboardList } from "lucide-react";
import { useEscClose } from "./widgets.jsx";
import { TIER_COLOR } from "./uiconst.js";
import {
  catalog, item, group, pans, kitFor, solve, figureConsumables, panelPlan,
  tierPrice, lineItems, inch, round2, TIERS, SKU, FINISHES, GROUP_LABEL,
  BUILDER_MULT, SO_MIN_NET,
} from "./wedi.js";

const fm = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fm0 = (n) => "$" + Math.round(+n).toLocaleString("en-US");
const clampPct = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; };

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
.wedi-pop .tierbar{margin-left:auto;display:flex;align-items:center;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden}
.wedi-pop .tierbar button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:11.5px;font-weight:700;padding:7px 11px;cursor:pointer;line-height:1.1}
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
.wedi-pop .main{flex:1;min-width:0;overflow-y:auto;background:var(--ft-card);padding:16px 18px 30px}

.wedi-pop .fam{margin-bottom:22px}
.wedi-pop .fam-h{display:flex;align-items:baseline;gap:9px;margin-bottom:9px}
.wedi-pop .fam-h .t{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-brand-deep)}
.wedi-pop .fam-h .hint{font-size:11px;color:var(--ft-faint)}
.wedi-pop .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:8px}
.wedi-pop .pancard{border:1px solid var(--ft-border-strong);border-radius:9px;background:var(--ft-card);padding:10px 11px 9px;cursor:pointer;text-align:left;position:relative;color:inherit}
.wedi-pop .pancard:hover{border-color:var(--ft-brand)}
.wedi-pop .pancard.on{outline:2px solid var(--ft-brand);outline-offset:-1px;background:var(--ft-tint)}
.wedi-pop .pancard .sz{font-size:16.5px;font-weight:800;letter-spacing:-.01em}
.wedi-pop .pancard .sz small{font-size:10.5px;font-weight:600;color:var(--ft-faint);margin-left:4px}
.wedi-pop .pancard .nm{font-size:10.5px;color:var(--ft-muted);font-weight:600;margin-top:2px;line-height:1.3;min-height:26px}
.wedi-pop .pancard .pr{font-size:13px;font-weight:800;margin-top:5px;font-variant-numeric:tabular-nums}
.wedi-pop .pancard .fk{font-size:9.5px;color:var(--ft-faint);font-weight:600;margin-top:2px}
.wedi-pop .pancard .dot{position:absolute;top:9px;right:9px;width:7px;height:7px;border-radius:50%;background:var(--ft-brand)}
.wedi-pop .pancard .drn{display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--ft-muted);background:var(--ft-sand);border-radius:4px;padding:1px 5px;margin-top:5px}
.wedi-pop .kitnote{font-size:11.5px;color:var(--ft-muted);background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:8px;padding:9px 12px;margin-bottom:16px;line-height:1.5}
.wedi-pop .kitnote b{color:var(--ft-text)}

.wedi-pop .roomform{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px;background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:9px;padding:12px 14px;margin-bottom:14px}
.wedi-pop .rf{display:flex;flex-direction:column;gap:4px}
.wedi-pop .rf label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--ft-muted)}
.wedi-pop .rf .dims{display:flex;align-items:center;gap:6px}
.wedi-pop .rf .dims span{font-size:12px;color:var(--ft-faint);font-weight:700}
.wedi-pop .inp{border:1px solid var(--ft-border-strong);border-radius:7px;background:var(--ft-card);color:var(--ft-text);font-size:13.5px;font-weight:700;padding:7px 9px;width:74px}
.wedi-pop .inp:focus{outline:2px solid var(--ft-brand);outline-offset:1px;border-color:transparent}
.wedi-pop .seg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:7px;overflow:hidden;background:var(--ft-card)}
.wedi-pop .seg button{border:none;background:var(--ft-card);color:var(--ft-muted);font-size:12px;font-weight:700;padding:8px 12px;cursor:pointer}
.wedi-pop .seg button + button{border-left:1px solid var(--ft-border-strong)}
.wedi-pop .seg button.on{background:var(--ft-text);color:var(--ft-cream)}
.wedi-pop .optrow{display:flex;gap:9px;overflow-x:auto;padding-bottom:4px;margin-bottom:14px}
.wedi-pop .optcard{flex:0 0 240px;border:1px solid var(--ft-border-strong);border-radius:9px;background:var(--ft-card);padding:10px 12px;cursor:pointer;text-align:left;color:inherit}
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
.wedi-pop .gchip{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:20px;padding:4px 11px;font-size:11px;font-weight:700;color:var(--ft-muted);cursor:pointer}
.wedi-pop .gchip.on{background:var(--ft-text);border-color:var(--ft-text);color:var(--ft-cream)}
.wedi-pop .gchip small{font-weight:600;opacity:.65;margin-left:3px}
.wedi-pop .figcard{background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:9px;padding:11px 13px;margin-bottom:12px}
.wedi-pop .figcard .fh{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ft-brand-deep);margin-bottom:6px}
.wedi-pop .figcard .fr{display:flex;align-items:center;flex-wrap:wrap;gap:10px;font-size:12.5px;color:var(--ft-muted);font-weight:600}
.wedi-pop .figcard .fr b{color:var(--ft-text)}
.wedi-pop .figcard .inp{width:80px;padding:5px 8px;font-size:12.5px}
.wedi-pop .figfoot{font-size:10px;color:var(--ft-faint);font-weight:600;margin-top:5px}
.wedi-pop .brow{display:flex;align-items:center;gap:10px;padding:6px 8px;border-top:1px solid var(--ft-row-line)}
.wedi-pop .brow:last-child{border-bottom:1px solid var(--ft-row-line)}
.wedi-pop .brow.stk,.wedi-pop .srow.stk{background:var(--w-stock)}
.wedi-pop .sdot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--ft-brand)}
.wedi-pop .sdot.so{background:transparent;border:1.4px solid var(--ft-faint)}
.wedi-pop .brow .bn{flex:1;min-width:0}
.wedi-pop .brow .bn .n{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wedi-pop .brow .bn .s{font-size:10.5px;color:var(--ft-faint);font-weight:600}
.wedi-pop .brow .sku{flex:none;font-size:10.5px;color:var(--ft-muted);font-weight:600;font-variant-numeric:tabular-nums;width:88px;text-align:right}
.wedi-pop .brow .pr{flex:none;width:84px;text-align:right;font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums}
.wedi-pop .brow .pr small{display:block;font-size:9px;color:var(--ft-faint);font-weight:600}
.wedi-pop .stepper{flex:none;display:inline-flex;align-items:center;border:1px solid var(--ft-border-strong);border-radius:6px;overflow:hidden}
.wedi-pop .stepper button{border:none;background:var(--ft-card);width:24px;height:24px;font-size:13px;font-weight:800;color:var(--ft-muted);cursor:pointer;line-height:1}
.wedi-pop .stepper .q{width:28px;text-align:center;font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
.wedi-pop .stepper .q.zero{color:var(--ft-faint);font-weight:600}
.wedi-pop .more{font-size:11px;color:var(--ft-faint);padding:8px 4px}

.wedi-pop .diagcol{flex:0 0 356px;border-left:1px solid var(--ft-border-strong);background:var(--ft-tint);overflow-y:auto;padding:12px 14px 20px;order:3}
.wedi-pop .diagcol .dc-h{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-muted);margin:4px 0}
.wedi-pop .diagcol .dc-h:first-child{margin-top:0}
.wedi-pop .diagcol svg{display:block;width:100%;height:auto;background:var(--w-paper);border:1px solid var(--ft-border);border-radius:8px}
.wedi-pop .diagcol .dc-empty{font-size:11.5px;color:var(--ft-faint);line-height:1.6;padding:18px 4px}
.wedi-pop .diagcol .dc-legend{font-size:9.5px;color:var(--ft-faint);font-weight:600;line-height:1.5;margin-top:8px}
.wedi-pop .diagcol .dc-hint{background:var(--w-hint-bg);border:1px solid var(--w-hint-line);border-radius:6px;color:var(--w-hint-ink);font-size:10.5px;font-weight:700;padding:6px 9px;margin-bottom:6px}
.wedi-pop .xdel{cursor:pointer;color:var(--w-rust);font-weight:800;padding:0 2px}

.wedi-pop .buildcol{flex:0 0 392px;border-left:1px solid var(--ft-border-strong);background:var(--ft-cream);display:flex;flex-direction:column;min-height:0;order:2}
.wedi-pop .bc-scroll{flex:1;overflow-y:auto;padding:14px 16px 8px}
.wedi-pop .bc-h{display:flex;align-items:baseline;gap:8px;margin-bottom:2px}
.wedi-pop .bc-h .t{font-size:14px;font-weight:800}
.wedi-pop .bc-h .sub{font-size:10.5px;color:var(--ft-faint);font-weight:600;margin-left:auto;text-align:right}
.wedi-pop .bc-empty{font-size:12px;color:var(--ft-faint);line-height:1.6;padding:22px 6px}
.wedi-pop .bgroup{margin-top:11px}
.wedi-pop .bg-h{display:flex;align-items:center;gap:7px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-muted);padding-bottom:4px;border-bottom:1px solid var(--ft-border-strong)}
.wedi-pop .bg-h .wallctl{margin-left:auto;display:flex;align-items:center;gap:4px;text-transform:none;letter-spacing:0}
.wedi-pop .wtgl{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:4px;font-size:9px;font-weight:800;color:var(--ft-faint);width:20px;height:17px;cursor:pointer;line-height:1}
.wedi-pop .wtgl.on{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff}
.wedi-pop .wallrow{display:flex;align-items:center;gap:5px;padding:4px 0;border-bottom:1px dashed var(--ft-row-line);font-size:10px;color:var(--ft-faint);font-weight:600}
.wedi-pop .wname{border:1px solid var(--ft-border-strong);background:var(--ft-card);border-radius:5px;font-size:9.5px;font-weight:800;color:var(--ft-faint);padding:2px 0;cursor:pointer;width:44px;text-align:center;flex:none}
.wedi-pop .wname.on{background:var(--ft-brand);border-color:var(--ft-brand);color:#fff}
.wedi-pop .win{width:40px;flex:none;border:1px solid var(--ft-border-strong);border-radius:4px;font-size:10.5px;font-weight:700;text-align:center;padding:2px;background:var(--ft-card);color:var(--ft-text)}
.wedi-pop .win:disabled{opacity:.35}
.wedi-pop .wallrow .wu{margin-left:auto;font-variant-numeric:tabular-nums;white-space:nowrap}
.wedi-pop .pfseg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:5px;overflow:hidden}
.wedi-pop .pfseg button{border:none;background:var(--ft-card);color:var(--ft-faint);font-size:9px;font-weight:800;padding:2px 7px;cursor:pointer}
.wedi-pop .pfseg button + button{border-left:1px solid var(--ft-border-strong)}
.wedi-pop .pfseg button.on{background:var(--ft-text);color:var(--ft-cream)}
.wedi-pop .fsw{display:inline-block;width:11px;height:11px;border-radius:50%;border:1px solid var(--ft-border-strong);vertical-align:-1.5px;margin-right:5px;flex:none}
.wedi-pop .bline{display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px solid var(--ft-row-line)}
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
.wedi-pop .addchips{display:flex;flex-wrap:wrap;gap:5px;padding:7px 0 2px}
.wedi-pop .addchip{border:1px dashed var(--ft-border-strong);background:var(--ft-card);border-radius:20px;padding:3px 10px;font-size:10.5px;font-weight:700;color:var(--ft-muted);cursor:pointer}
.wedi-pop .addchip.on{border-style:solid;background:var(--ft-brand-soft);border-color:var(--ft-brand);color:var(--ft-brand-deep)}
.wedi-pop .whint{display:flex;gap:8px;align-items:center;background:var(--w-hint-bg);border:1px solid var(--w-hint-line);border-radius:7px;padding:7px 10px;font-size:11px;color:var(--w-hint-ink);font-weight:600;margin-top:10px;line-height:1.4}
.wedi-pop .whint button{border:1px solid #C9A050;background:#fff;border-radius:5px;font-size:10.5px;font-weight:800;color:var(--w-hint-ink);padding:3px 8px;cursor:pointer;flex:none;margin-left:auto}
.wedi-pop .fcomp{margin-top:10px;background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:7px;padding:8px 11px;font-size:11px;color:var(--ft-muted);line-height:1.5}
.wedi-pop .fcomp b{color:var(--ft-text)}
.wedi-pop .fcomp .beat{color:var(--ft-brand-deep);font-weight:800}
.wedi-pop .fcomp .over{color:var(--w-rust);font-weight:800}
.wedi-pop .bc-foot{flex:none;border-top:1px solid var(--ft-border-strong);background:var(--ft-sand);padding:10px 16px 12px}
.wedi-pop .totrow{display:flex;align-items:baseline;gap:12px}
.wedi-pop .totrow .k{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-muted)}
.wedi-pop .totrow .v{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
.wedi-pop .totrow .sell{margin-left:auto;text-align:right}
.wedi-pop .totrow .sell .v{font-size:22px}
.wedi-pop .marginrow{font-size:10.5px;color:var(--ft-muted);font-weight:600;margin-top:2px;display:flex}
.wedi-pop .marginrow span{margin-left:auto}
.wedi-pop .btnrow{display:flex;gap:7px;margin-top:9px}
.wedi-pop .wbtn{flex:1;border:1px solid var(--ft-border-strong);background:var(--ft-card);color:var(--ft-text);border-radius:7px;font-size:12px;font-weight:800;padding:9px 6px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}
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
  .wedi-printsheet .ps-head .sub{font-size:11px;color:#555;font-weight:600}
  .wedi-printsheet .ps-head .dt{margin-left:auto;font-size:11px;color:#555}
  .wedi-printsheet .ps-room{font-size:13px;font-weight:700;margin-bottom:12px}
  .wedi-printsheet .ps-diags{display:flex;gap:18px;align-items:flex-start;margin-bottom:6px}
  .wedi-printsheet .ps-diags .d{flex:1}
  .wedi-printsheet .ps-diags .dh{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:4px}
  .wedi-printsheet .ps-diags svg{width:100%;height:auto;border:1px solid #ddd;border-radius:6px;background:#fff}
  .wedi-printsheet .ps-sec{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:#555;margin:14px 0 4px}
  .wedi-printsheet .ps-warn{font-size:11px;color:#333;padding:2px 0}
  .wedi-printsheet .ps-table{width:100%;border-collapse:collapse;font-size:11px}
  .wedi-printsheet .ps-table th{text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#555;border-bottom:1.5px solid #111;padding:3px 6px}
  .wedi-printsheet .ps-table td{border-bottom:1px solid #ddd;padding:4px 6px;vertical-align:top}
  .wedi-printsheet .ps-table .num{text-align:right;font-variant-numeric:tabular-nums}
  .wedi-printsheet .ps-tot{display:flex;justify-content:flex-end;gap:26px;font-size:12px;font-weight:800;margin-top:8px}
  .wedi-printsheet .ps-note{font-size:9.5px;color:#777;margin-top:14px;line-height:1.5}
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
const finName = (e) => (isCover(e) && e.finish ? FINISHES[e.finish] || e.finish : "");
function FinDot({ e }) {
  if (!isCover(e) || !e.finish) return null;
  const c = FIN_SWATCH[e.finish];
  return <span className="fsw" title={finName(e)}
    style={{ background: c || "repeating-linear-gradient(45deg,#FFF 0 2px,#CBC4B0 2px 4px)" }} />;
}

const BUCKETS = [["floor", "Floor"], ["walls", "Walls"], ["drain", "Drain & finish"], ["install", "Install"], ["addon", "Add-ons"]];
const BUCKET_OF = {
  pan: "floor", module: "floor", modExt: "floor", extension: "floor", cornerExt: "floor", ramp: "floor",
  curb: "floor", kit: "floor", panel: "walls", cover: "drain", coverFrame: "drain", drainKit: "drain",
  recess: "install", fastener: "install", sealant: "install", tool: "install", collar: "install", subliner: "install",
};
const bucketOf = (e) => BUCKET_OF[e.group] || "addon";

const FAM_DEFS = [
  ["fundo", "Fundo — curbed", 'center & offset drains · 1 37/64" thick, pre-sloped'],
  ["curbless", "Fundo Ligno — curbless", '¾" perimeter — recess the subfloor, bracket kit, or ramp'],
  ["linear", "Linear bases — 4-sided slope", "channel drain along the long wall"],
  ["module", "Riolito Neo modules", "one-way slope to a wall drain — pair with the module extension"],
];
const ADDON_CHIPS = [["niche", "Niche"], ["seat", "Seat"], ["bench", "Bench"], ["shelf", "Glass shelf"], ["gun", "Sealant gun"]];
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
// the drawings — top-down layout + isometric view
// ============================================================================

const PIECE_FILL = { pan: "#DCE5CD", module: "#DCE5CD", ext: "#EFF3E6", cornerExt: "#E4EBD6", modExt: "#EFF3E6" };
const PIECE_SIDE = { pan: "#C2CFA8", module: "#C2CFA8", ext: "#D8DFC4", cornerExt: "#CDD8B4", modExt: "#D8DFC4" };
const INK = "#1C1A17", MUTED = "#57534C", FAINT = "#8A8378", MOSS = "#57703A", MOSS_DEEP = "#40542A";
const RUST = "#B4552D", PAPER = "#FBFAF5";
const FONT = "Manrope,sans-serif";

function topGeom(o, W_, H_, mini) {
  const pad = mini ? 6 : 42, padT = mini ? 6 : 30;
  const rw = o.room.w, rd = o.room.d;
  const sc = Math.min((W_ - pad * 2) / rw, (H_ - padT - (mini ? 6 : 26)) / rd);
  return { ox: (W_ - rw * sc) / 2, oy: padT, sc, rw, rd };
}

// To-scale plan: wall bands with the panel butt joints ticked on them, the
// pieces with their cut edges dashed, the drain (with the plumber's two
// measurements when it was pinned), 45° corner chamfers, and dimensions.
function TopDown({ o, w, h, mini, wallOn, dWalls, corners, placing, onCorner, onEdge }) {
  const g = topGeom(o, w, h, mini);
  const { ox, oy, sc, rw, rd } = g;
  const X = (x) => round2(ox + x * sc), Y = (y) => round2(oy + y * sc);
  const wallW = mini ? 2.5 : 5;
  const on = wallOn || {};
  const els = [];
  const push = (el) => els.push(el);

  push(<rect key="floor" x={X(0)} y={Y(0)} width={round2(rw * sc)} height={round2(rd * sc)} fill={PAPER} stroke={FAINT} strokeWidth="1" />);
  if (on.back) push(<rect key="wb" x={X(0) - wallW} y={Y(0) - wallW} width={round2(rw * sc + wallW * 2)} height={wallW} fill={MUTED} />);
  if (on.left) push(<rect key="wl" x={X(0) - wallW} y={Y(0) - wallW} width={wallW} height={round2(rd * sc + wallW * 2)} fill={MUTED} />);
  if (on.right) push(<rect key="wr" x={X(rw)} y={Y(0) - wallW} width={wallW} height={round2(rd * sc + wallW * 2)} fill={MUTED} />);

  if (!mini) {
    (dWalls || []).forEach((wl, wi) => {
      if (!on[wl.side]) return;
      const span = wl.side === "back" ? rw : rd;
      const joints = {};
      wl.courses.forEach((c) => {
        let u = 0;
        c.lens.slice(0, -1).forEach((len) => { u = round2(u + len); if (u < span - 0.5) joints[u] = 1; });
      });
      Object.keys(joints).forEach((uk) => {
        const u = +uk;
        if (wl.side === "back") {
          push(<line key={`j${wi}-${uk}`} x1={X(u)} y1={Y(0) - wallW - 1} x2={X(u)} y2={Y(0) + 1} stroke="#F6F3EC" strokeWidth="1.3" strokeDasharray="2 2" />);
        } else {
          const bx = wl.side === "left" ? X(0) - wallW - 1 : X(rw) - 1;
          push(<line key={`j${wi}-${uk}`} x1={bx} y1={Y(u)} x2={bx + wallW + 2} y2={Y(u)} stroke="#F6F3EC" strokeWidth="1.3" strokeDasharray="2 2" />);
        }
      });
    });
    // added walls draw in moss; an entry wall leaves the doorway open
    (dWalls || []).filter((wl) => wl.extra).forEach((wl, i) => {
      const len = Math.min(wl.len, wl.side === "back" || wl.side === "entry" ? rw : rd);
      if (wl.side === "entry") push(<rect key={`x${i}`} x={X(0)} y={Y(rd)} width={round2(len * sc)} height={wallW} fill={MOSS} />);
      else if (wl.side === "back") push(<rect key={`x${i}`} x={X(0)} y={Y(0) - wallW} width={round2(len * sc)} height={wallW} fill={MOSS} />);
      else push(<rect key={`x${i}`} x={wl.side === "left" ? X(0) - wallW : X(rw)} y={Y(0)} width={wallW} height={round2(len * sc)} fill={MOSS} />);
    });
    const CH = 12;
    [["bl", 0, 0, 1, 1], ["br", rw, 0, -1, 1], ["fl", 0, rd, 1, -1], ["fr", rw, rd, -1, -1]].forEach((c) => {
      if (!corners || !corners[c[0]]) return;
      push(<line key={`c${c[0]}`} x1={X(c[1] + c[3] * CH)} y1={Y(c[2])} x2={X(c[1])} y2={Y(c[2] + c[4] * CH)} stroke={INK} strokeWidth="1.6" strokeDasharray="4 3" />);
      push(<text key={`ct${c[0]}`} x={X(c[1] + c[3] * (CH + 2))} y={Y(c[2] + c[4] * (CH + 2)) + 3} textAnchor="middle" fontSize="7.5" fontWeight="700" fill={MUTED} fontFamily={FONT}>45°</text>);
    });
  }

  o.pieces.forEach((p, i) => {
    push(<rect key={`p${i}`} x={X(p.x)} y={Y(p.y)} width={round2(p.w * sc)} height={round2(p.d * sc)} fill={PIECE_FILL[p.kind] || "#EFF3E6"} stroke={INK} strokeWidth="1.1" />);
    if (p.cut) {
      const cxe = o.mirrored ? X(p.x) : X(p.x + p.w);
      if (p.w < p.cut.w - 0.01) push(<line key={`cw${i}`} x1={cxe} y1={Y(p.y)} x2={cxe} y2={Y(p.y + p.d)} stroke={RUST} strokeWidth="2" strokeDasharray="5 3" />);
      if (p.d < p.cut.d - 0.01) push(<line key={`cd${i}`} x1={X(p.x)} y1={Y(p.y + p.d)} x2={X(p.x + p.w)} y2={Y(p.y + p.d)} stroke={RUST} strokeWidth="2" strokeDasharray="5 3" />);
    }
    if (!mini && p.d * sc >= 26 && p.w * sc >= 46) {
      const cx = X(p.x + p.w / 2), cy = Y(p.y + p.d / 2);
      const lbl = p.kind === "pan" || p.kind === "module" ? (p.item.erp || p.item.us) : p.item.us || p.item.erp;
      push(<text key={`l${i}`} x={cx} y={cy - 20} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={MOSS_DEEP} fontFamily={FONT}>{lbl}</text>);
      push(<text key={`s${i}`} x={cx} y={cy - 9} textAnchor="middle" fontSize="8.5" fill={MUTED} fontFamily={FONT}>{inch(p.w) + "×" + inch(p.d) + (p.cut ? " cut" : "")}</text>);
    }
  });
  if (!mini && o.pieces.length > 1) {
    o.pieces.slice(1).forEach((p, i) => {
      push(<rect key={`sm${i}`} x={X(p.x)} y={Y(p.y)} width={round2(p.w * sc)} height={round2(p.d * sc)} fill="none" stroke={MOSS} strokeWidth="1" strokeDasharray="2 2" />);
    });
  }

  const dr = o.drain;
  if (dr) {
    if (dr.type === "linear" && dr.len) {
      const half = dr.len / 2;
      const hx = dr.axis === "w" ? half : 1.4, hy = dr.axis === "w" ? 1.4 : half;
      push(<rect key="dr" x={X(dr.x - hx)} y={Y(dr.y - hy)} width={round2(hx * 2 * sc)} height={round2(hy * 2 * sc)} rx="2.5" fill={INK} />);
      if (!mini && dr.axis === "w") push(<text key="drt" x={X(dr.x)} y={Y(dr.y + hy) + 11} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={INK} fontFamily={FONT}>{inch(dr.len) + '" channel'}</text>);
    } else {
      push(<circle key="dr" cx={X(dr.x)} cy={Y(dr.y)} r={mini ? 3 : 7} fill={PAPER} stroke={INK} strokeWidth="1.4" />);
      push(<circle key="dr2" cx={X(dr.x)} cy={Y(dr.y)} r={mini ? 1 : 2.2} fill={INK} />);
    }
    if (!mini && dr.type !== "linear") {
      push(<text key="drl" x={X(dr.x)} y={Y(dr.y) + 18} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={INK} fontFamily={FONT}>
        {dr.type + " drain @ " + inch(dr.x) + '", ' + inch(dr.y) + '"'}</text>);
    }
    if (!mini && o.kind === "drainat") {
      push(<line key="mx" x1={X(0)} y1={Y(dr.y)} x2={X(dr.x) - 9} y2={Y(dr.y)} stroke={RUST} strokeWidth="1" strokeDasharray="3 3" />);
      push(<text key="mxt" x={X(dr.x / 2)} y={Y(dr.y) - 4} textAnchor="middle" fontSize="8.5" fontWeight="800" fill={RUST} fontFamily={FONT}>{inch(dr.x) + '"'}</text>);
      push(<line key="my" x1={X(dr.x)} y1={Y(0)} x2={X(dr.x)} y2={Y(dr.y) - 9} stroke={RUST} strokeWidth="1" strokeDasharray="3 3" />);
      push(<text key="myt" x={X(dr.x) + 4} y={Y(dr.y / 2)} fontSize="8.5" fontWeight="800" fill={RUST} fontFamily={FONT}>{inch(dr.y) + '"'}</text>);
    }
  }

  if (!mini) {
    const dy = Y(rd) + 16, dx = X(0) - 16;
    push(<line key="dw" x1={X(0)} y1={dy} x2={X(rw)} y2={dy} stroke={FAINT} strokeWidth="1" />);
    push(<text key="dwt" x={X(rw / 2)} y={dy - 3} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={MUTED} fontFamily={FONT}>{inch(rw) + '"'}</text>);
    push(<line key="dd" x1={dx} y1={Y(0)} x2={dx} y2={Y(rd)} stroke={FAINT} strokeWidth="1" />);
    push(<text key="ddt" x={dx - 4} y={Y(rd / 2)} textAnchor="middle" fontSize="9.5" fontWeight="700" fill={MUTED} fontFamily={FONT}
      transform={`rotate(-90 ${dx - 4} ${Y(rd / 2)})`}>{inch(rd) + '"'}</text>);
    push(<text key="ent" x={X(rw / 2)} y={Y(rd) - 6} textAnchor="middle" fontSize="8.5" fill={FAINT} fontFamily={FONT}>↓ entry</text>);
  }

  const clickable = !mini && (onCorner || onEdge);
  const click = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - r.left) * (w / r.width) - ox) / sc;
    const y = ((ev.clientY - r.top) * (h / r.height) - oy) / sc;
    const near = 10;
    const corner = Math.hypot(x, y) < near ? "bl" : Math.hypot(x - rw, y) < near ? "br"
      : Math.hypot(x, y - rd) < near ? "fl" : Math.hypot(x - rw, y - rd) < near ? "fr" : null;
    if (corner) { onCorner?.(corner); return; }
    if (!placing) return;
    const dists = [["back", Math.abs(y)], ["entry", Math.abs(y - rd)], ["left", Math.abs(x)], ["right", Math.abs(x - rw)]];
    dists.sort((a, b) => a[1] - b[1]);
    onEdge?.(dists[0][0], { rw, rd });
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} onClick={clickable ? click : undefined}
      style={clickable ? { cursor: placing ? "crosshair" : "pointer" } : undefined}>{els}</svg>
  );
}

// The isometric: each wall at its own height, the Fit plan's level courses and
// butt joints dotted onto the wall planes, the pieces as 4"-thick slabs.
function Iso({ o, w, h, dWalls, panelFit }) {
  const rw = o.room.w, rd = o.room.d;
  const dw = dWalls || [];
  const bySide = {};
  dw.forEach((x) => { bySide[x.side] = x; });
  const hmax = Math.min(dw.reduce((m, x) => Math.max(m, x.h), 0) || 80, 96);
  const P = (x, y, z) => [(x - y) * 0.866, (x + y) * 0.5 - z];
  const pts = [P(0, 0, 0), P(rw, 0, 0), P(0, rd, 0), P(rw, rd, 0), P(0, 0, hmax), P(rw, 0, hmax)];
  if (bySide.right) pts.push(P(rw, rd, Math.min(bySide.right.h, 96)));
  if (bySide.left) pts.push(P(0, rd, Math.min(bySide.left.h, 96)));
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  pts.forEach((p) => { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
  const pad = 16;
  const sc = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
  const M = (x, y, z) => { const p = P(x, y, z); return [round2(pad + (p[0] - minX) * sc), round2(pad + (p[1] - minY) * sc)]; };
  const str = (arr) => arr.map((p) => p[0] + "," + p[1]).join(" ");
  const els = [];
  const wallFill = "rgba(87,112,58,.12)", wallLine = "rgba(28,26,23,.4)", seamCol = "rgba(28,26,23,.5)";

  els.push(<polygon key="ground" points={str([M(-3, -3, 0), M(rw + 3, -3, 0), M(rw + 3, rd + 3, 0), M(-3, rd + 3, 0)])} fill="rgba(28,26,23,.06)" />);

  const plane = (wl, at, glass, tag) => {
    if (!wl) return;
    const hh = Math.min(wl.h, 96);
    const span = wl.side === "back" ? rw : rd;
    const pt = wl.side === "back" ? (u, z) => M(u, 0, z) : (u, z) => M(at, u, z);
    els.push(<polygon key={`pl${tag}`} points={str([pt(0, 0), pt(span, 0), pt(span, hh), pt(0, hh)])}
      fill={glass ? "rgba(87,112,58,.07)" : wallFill} stroke={wallLine} strokeWidth="1" />);
    wl.courses.forEach((c, ci) => {
      const top = Math.min(c.y0 + c.ch, hh);
      if (c.y0 > 0 && c.y0 < hh) {
        const a = pt(0, c.y0), b = pt(Math.min(span, wl.len), c.y0);
        els.push(<line key={`cl${tag}-${ci}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={seamCol} strokeWidth="1" strokeDasharray="2 3" />);
      }
      let u = 0;
      c.lens.slice(0, -1).forEach((len, li) => {
        u = round2(u + len);
        if (u >= span - 0.5) return;
        const a = pt(u, c.y0), b = pt(u, top);
        els.push(<line key={`bj${tag}-${ci}-${li}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={seamCol} strokeWidth="1" strokeDasharray="2 3" />);
      });
    });
  };
  plane(bySide.back, 0, false, "b");
  plane(bySide.left, 0, false, "l");

  const t = 4;
  o.pieces.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach((p, i) => {
    const f = PIECE_FILL[p.kind] || "#EFF3E6", side = PIECE_SIDE[p.kind] || "#D8DFC4";
    els.push(<polygon key={`e${i}`} points={str([M(p.x + p.w, p.y, t), M(p.x + p.w, p.y + p.d, t), M(p.x + p.w, p.y + p.d, 0), M(p.x + p.w, p.y, 0)])} fill={side} stroke={INK} strokeWidth=".8" />);
    els.push(<polygon key={`f${i}`} points={str([M(p.x, p.y + p.d, t), M(p.x + p.w, p.y + p.d, t), M(p.x + p.w, p.y + p.d, 0), M(p.x, p.y + p.d, 0)])} fill={side} stroke={INK} strokeWidth=".8" />);
    els.push(<polygon key={`t${i}`} points={str([M(p.x, p.y, t), M(p.x + p.w, p.y, t), M(p.x + p.w, p.y + p.d, t), M(p.x, p.y + p.d, t)])} fill={f} stroke={INK} strokeWidth=".9" />);
    if (p.cut) {
      const cxe = o.mirrored ? p.x : p.x + p.w;
      if (p.w < p.cut.w - 0.01) { const a = M(cxe, p.y, t), b = M(cxe, p.y + p.d, t); els.push(<line key={`cw${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={RUST} strokeWidth="1.8" strokeDasharray="5 3" />); }
      if (p.d < p.cut.d - 0.01) { const a = M(p.x, p.y + p.d, t), b = M(p.x + p.w, p.y + p.d, t); els.push(<line key={`cd${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={RUST} strokeWidth="1.8" strokeDasharray="5 3" />); }
    }
  });

  const dr = o.drain;
  if (dr) {
    if (dr.type === "linear" && dr.len) {
      const half = dr.len / 2;
      const hx = dr.axis === "w" ? half : 1.6, hy = dr.axis === "w" ? 1.6 : half;
      els.push(<polygon key="dr" points={str([M(dr.x - hx, dr.y - hy, t + 0.1), M(dr.x + hx, dr.y - hy, t + 0.1), M(dr.x + hx, dr.y + hy, t + 0.1), M(dr.x - hx, dr.y + hy, t + 0.1)])} fill={INK} />);
    } else {
      const c = M(dr.x, dr.y, t + 0.1);
      els.push(<ellipse key="dr" cx={c[0]} cy={c[1]} rx={round2(4.5 * sc)} ry={round2(2.6 * sc)} fill={PAPER} stroke={INK} strokeWidth="1.2" />);
      els.push(<ellipse key="dr2" cx={c[0]} cy={c[1]} rx={round2(1.4 * sc)} ry={round2(0.8 * sc)} fill={INK} />);
    }
  }
  plane(bySide.right, rw, true, "r");

  dw.filter((x) => x.extra).forEach((wl, i) => {
    const h2 = Math.min(wl.h, 96);
    if (wl.side === "entry") {
      const len = Math.min(wl.len, rw);
      els.push(<polygon key={`xw${i}`} points={str([M(0, rd, 0), M(len, rd, 0), M(len, rd, h2), M(0, rd, h2)])} fill="rgba(87,112,58,.16)" stroke={wallLine} strokeWidth="1" />);
    } else {
      const span = Math.min(wl.len, wl.side === "back" ? rw : rd);
      const pt = wl.side === "back" ? (u, z) => M(u, 0, z) : (u, z) => M(wl.side === "left" ? 0 : rw, u, z);
      els.push(<polygon key={`xw${i}`} points={str([pt(0, 0), pt(span, 0), pt(span, h2), pt(0, h2)])} fill="rgba(87,112,58,.16)" stroke={wallLine} strokeWidth="1" />);
    }
  });
  if (dw.length) {
    const lp = M(0, 0, hmax);
    els.push(<text key="hl" x={lp[0] + 4} y={lp[1] + 10} fontSize="9" fontWeight="700" fill={MUTED} fontFamily={FONT}>
      {'walls to ' + inch(hmax) + '"' + (panelFit ? " · panel joints dotted" : "")}</text>);
  }
  return <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>{els}</svg>;
}

// ============================================================================
// the popup
// ============================================================================

const DEF_WALLS = [
  { id: "back", label: "Back", on: true, len: "", h: "" },
  { id: "left", label: "Left", on: true, len: "", h: "" },
  { id: "right", label: "Right", on: true, len: "", h: "" },
];
const DEF_OPTS = { panelKey: undefined, curbKey: undefined, coverKey: undefined, sealantForm: "tube", recess: undefined };
const DEF_INP = { w: 48, d: 66, curb: "curbed", drain: "any", drainX: "", drainY: "", anchor: "left" };

// The seed is either a search parse (seedFromQuery: { tab, input, search }) or a
// saved row's marker / the restore layer ({ mode, cfg } — cfg from kitFor). A
// cfg re-lands through kitFor with the same option names it was written with.
function seedState(seed) {
  const s = {
    tab: "kits", inp: { ...DEF_INP }, q: "", panKey: null, opts: { ...DEF_OPTS },
    addons: [], walls: DEF_WALLS.map((w) => ({ ...w })), extraWalls: [], wallH: 96, wallSeq: 0,
    solveInput: null,
  };
  if (!seed) return s;
  const cfg = seed.cfg;
  if (cfg && cfg.panKey) {
    s.tab = seed.mode === "custom" ? "custom" : seed.mode === "browse" ? "browse" : "kits";
    s.panKey = cfg.panKey;
    s.opts = {
      panelKey: cfg.panelKey || undefined,
      curbKey: cfg.curbKey === undefined ? undefined : cfg.curbKey,
      coverKey: cfg.coverKey || undefined,
      sealantForm: cfg.sealantForm === "sausage" ? "sausage" : "tube",
      recess: cfg.recess || undefined,
    };
    s.addons = (cfg.addons || []).slice();
    const rows = [];
    (cfg.walls || []).forEach((w) => {
      const base = s.walls.find((x) => x.id === w.side);
      if (base && !w.extra && !rows.includes(base)) { base.on = true; base.len = String(w.len); base.h = String(w.h); rows.push(base); }
      else s.extraWalls.push({ id: ++s.wallSeq, edge: w.side || "entry", len: String(w.len), h: String(w.h) });
    });
    s.walls.forEach((w) => { if (!rows.includes(w)) w.on = false; });
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

export default function WediConfigurator({ seed, tier, onTierChange, wediBuilderPct, onAdd, onClose, areaName, onConfigChange }) {
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
  const [opts, setOpts] = useState(s0.opts);
  const [inp, setInp] = useState(s0.inp);
  const [walls, setWalls] = useState(s0.walls);
  const [extraWalls, setExtraWalls] = useState(s0.extraWalls);
  const wallSeq = useRef(s0.wallSeq);
  const [corners, setCorners] = useState({ bl: false, br: false, fl: false, fr: false });
  const [placing, setPlacing] = useState(false);
  const [wallFlip, setWallFlip] = useState(false);
  const [wallH, setWallH] = useState(s0.wallH);
  const [panelFit, setPanelFit] = useState(true);
  const [q, setQ] = useState(s0.q);
  const [grp, setGrp] = useState("");
  const [figSf, setFigSf] = useState("");
  const [swap, setSwap] = useState(null);     // { key, rect }
  const [payload, setPayload] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [toast, setToast] = useState("");

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
    else if (swap) setSwap(null);
    else if (placing) setPlacing(false);
    else onClose();
  });
  useEffect(() => { if (!printing) return; window.print(); setPrinting(false); }, [printing]);
  // Dismiss the swap popover on any outside press (it is portalled, so the
  // popup's own backdrop click never sees it).
  useEffect(() => {
    if (!swap) return;
    const away = (e) => { if (!e.target.closest?.(".wedi-swap")) setSwap(null); };
    document.addEventListener("mousedown", away, true);
    return () => document.removeEventListener("mousedown", away, true);
  }, [swap]);

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
  const wallsArr = (pan, room) => {
    const auto = autoWallLens(pan, room);
    const out = [];
    walls.forEach((w) => {
      if (!w.on) return;
      const len = +w.len || auto[w.id] || 0;
      const h = +w.h || +wallH || 96;
      if (len > 0 && h > 0) out.push({ len, h, side: w.id });
    });
    extraWalls.forEach((w) => {
      const len = +w.len || 0, h = +w.h || +wallH || 96;
      if (len > 0 && h > 0) out.push({ len, h, side: w.edge, extra: true });
    });
    return out;
  };

  // The Fit plan (level courses, mixed sheet sizes, a vertical single sheet
  // where it kills the seams) replaces the engine's by-area panel line.
  const applyPanelFit = (lines, wl, panelSf) => {
    const plan = panelPlan(wl);
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

  const build = useMemo(() => {
    if (panKey) {
      const b = kitFor(panKey, {
        option: option || undefined, room: (option ? option.room : null) || undefined,
        walls: buildWalls, wallHeight: +wallH || 80,
        panelKey: opts.panelKey, curbKey: opts.curbKey, coverKey: opts.coverKey,
        sealantForm: opts.sealantForm, recess: opts.recess,
        addons: addons.slice(), tier: tierId,
        mode: option ? "custom" : "kit",
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
  }, [panKey, option, buildWalls, wallH, opts, addons, qtyOv, manual, panelFit, tierId]);

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

  const resetBuild = () => { setQtyOv({}); setAddons([]); setManual([]); setOpts({ ...DEF_OPTS }); };
  const pickPan = (key) => { setPanKey(key); setOption(null); resetBuild(); };

  const runSolve = (next) => {
    const i = next || inp;
    const res = solve({
      w: +i.w || 0, d: +i.d || 0, curb: i.curb, drain: i.drain, tolerance: 0.51,
      drainX: +i.drainX || 0, drainY: +i.drainY || 0, anchor: i.anchor || "left",
    });
    setResults(res);
    if (res.length) { setOption(res[0]); setPanKey(res[0].pan.key); } else { setOption(null); setPanKey(null); }
    resetBuild();
  };
  const setInput = (patch) => { const next = { ...inp, ...patch }; setInp(next); runSolve(next); };
  const selectOption = (k) => { const o = results[k]; if (!o) return; setOption(o); setPanKey(o.pan.key); resetBuild(); };

  // One-shot at mount: the room always arrives solved, so the Custom tab is
  // never a bare form claiming "no option fits" for a size it hasn't tried.
  // Only a seed that NAMED a room picks an option — otherwise the cards sit
  // unselected beside whatever the build column already holds.
  const solved = useRef(false);
  useEffect(() => {
    if (solved.current) return;
    solved.current = true;
    const i = { ...inp, ...(s0.solveInput || {}) };
    const res = solve({ w: +i.w || 0, d: +i.d || 0, curb: i.curb, drain: i.drain, tolerance: 0.51, drainX: +i.drainX || 0, drainY: +i.drainY || 0, anchor: i.anchor || "left" });
    setResults(res);
    if (!s0.solveInput || !res.length) return;
    // A saved cfg keeps its own pan; a fresh room seed takes the top option.
    setOption(s0.panKey ? (res.find((o) => o.pan.key === s0.panKey) || res[0]) : res[0]);
    if (!s0.panKey) setPanKey(res[0].pan.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- the drawings ---------------------------------------------------------
  const diag = useMemo(() => {
    if (option) return option;
    if (!panKey) return null;
    const p = item(panKey);
    if (p.group === "module") {
      return {
        pieces: [{ kind: "module", item: p, x: 0, y: 0, w: p.len, d: 5.75, cut: null }],
        drain: p.drain ? { ...p.drain } : null,
        room: { w: p.len, d: 72.5 }, warnings: [], title: p.name + " " + p.sizeText,
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
      drain, room: { w: bw, d: bd }, warnings: [], title: p.name + " " + p.sizeText,
    };
  }, [panKey, option, wallFlip]);

  const dWalls = useMemo(() => {
    if (!panKey) return [];
    const det = panelFit ? panelPlan(buildWalls).detail : null;
    return buildWalls.map((w, i) => ({ side: w.side, len: w.len, h: w.h, extra: !!w.extra, courses: det ? det[i].courses : [] }));
  }, [panKey, buildWalls, panelFit]);

  // --- swaps ----------------------------------------------------------------
  const swapChoices = (line) => {
    const g = line.item.group;
    if (g === "panel") return { title: "Wall panel", list: group("panel").filter((p) => p.sf), set: (k) => setOpts((o) => ({ ...o, panelKey: k || undefined })) };
    if (g === "cover" && line.item.sub === "point") return { title: "Drain cover — 4×4 finish", list: group("cover").filter((c) => c.sub === "point"), set: (k) => setOpts((o) => ({ ...o, coverKey: k || undefined })) };
    if (g === "cover" && line.item.sub === "linear") {
      const nom = line.item.len;
      return { title: "Linear cover — " + nom + '" channel', list: group("cover").filter((c) => c.sub === "linear" && c.len === nom), set: (k) => setOpts((o) => ({ ...o, coverKey: k || undefined })) };
    }
    if (g === "curb") return { title: "Curb", list: group("curb"), none: "No curb", set: (k) => setOpts((o) => ({ ...o, curbKey: k || null })) };
    if (g === "sealant" && line.item.sub === "joint") {
      return { title: "Joint sealant form", list: [item(SKU.sealantTube), item(SKU.sealantSausage)], set: (k) => setOpts((o) => ({ ...o, sealantForm: k === SKU.sealantSausage ? "sausage" : "tube" })) };
    }
    if (g === "recess" || g === "ramp") {
      return { title: "Curbless entry", list: [item(SKU.recessKit), item(SKU.ramp)], none: "Recess the subfloor (no part)", set: (k) => setOpts((o) => ({ ...o, recess: k === SKU.ramp ? "ramp" : k ? "kit" : "none" })) };
    }
    if (["niche", "seat", "bench", "shelf"].includes(g)) {
      return {
        title: GROUP_LABEL[g], list: group(g), set: (k) => {
          if (!k) return;
          setAddons((a) => a.map((x) => (x === line.item.key ? k : x)));
          setManual((mm) => mm.map((x) => (x.key === line.item.key ? { ...x, key: k } : x)));
        },
      };
    }
    return null;
  };
  const addonDefault = (g) => {
    if (g === "gun") return SKU.gun;
    const list = group(g).slice().sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || a.retail - b.retail);
    return list.length ? list[0].key : null;
  };

  // --- kit cards ------------------------------------------------------------
  // What each house kit costs out of OUR stock with the current wall setup
  // (owner feedback 20) — not wedi's boxed-kit price.
  const kitCosts = useMemo(() => {
    const out = {};
    const fams = FAM_DEFS.map((f) => (f[0] === "module" ? group("module").filter((m) => m.sub === "neo") : pans({ family: f[0] })));
    fams.forEach((list) => list.forEach((p) => {
      const wl = wallsArr(p, null);
      const b = kitFor(p.key, { walls: wl, sealantForm: opts.sealantForm });
      if (!b) return;
      const lines = panelFit ? applyPanelFit(b.lines, wl, b.panelSf) : b.lines;
      out[p.key] = round2(lines.reduce((t, l) => t + l.item.cost * l.qty, 0));
    }));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walls, extraWalls, wallH, wallFlip, panelFit, opts.sealantForm]);

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
          <button key={t} onClick={() => setTier({ priceTier: "custom" })} style={fill} title="Custom % off retail">
            Custom
            <small>−<input value={customPct ?? ""} onClick={(e) => e.stopPropagation()}
              onChange={(e) => setTier({ priceTier: "custom", customPct: e.target.value })} />%</small>
          </button>
        );
        return (
          <button key={t} onClick={() => setTier({ priceTier: t })} style={fill}>
            {t[0].toUpperCase() + t.slice(1)}{sub ? <small>{sub}</small> : null}
          </button>
        );
      })}
    </div>
  );

  const kitsTab = (
    <>
      <div className="kitnote">
        <b>One click builds the house kit from shop stock</b> — pan + Click&amp;Seal drain (in the box)
        + ½" panels laid in level courses for the walls (1 long + 2 short by default — edit each wall, add one
        by clicking the drawing, or flip the layout in the build column) + curb lean (curbed) / Subliner Dry +
        S-Dry Seal + corner seals (curbless) + drain cover + fasteners + sealant (10.5 oz tubes by default) +
        both collars + trowel — mirroring wedi's own boxed-kit recipe.
      </div>
      {FAM_DEFS.map((fd) => {
        const list = fd[0] === "module" ? group("module").filter((m) => m.sub === "neo") : pans({ family: fd[0] });
        if (!list.length) return null;
        return (
          <div className="fam" key={fd[0]}>
            <div className="fam-h"><div className="t">{fd[1]}</div><div className="hint">{fd[2]}</div></div>
            <div className="cards">
              {list.map((p) => (
                <button key={p.key} className={"pancard" + (panKey === p.key && !option ? " on" : "")} onClick={() => pickPan(p.key)} data-wedi-pan={p.key}>
                  {p.stock && <div className="dot" title="stocked" />}
                  <div className="sz">
                    {p.group === "module" ? <>{inch(p.len)}″ <small>module</small></> : <>{inch(p.w)}×{inch(p.d)}<small>in</small></>}
                  </div>
                  <div className="nm">{p.name.replace(/wedi\s*(®)?\s*/i, "")}</div>
                  <div className="drn">{p.group === "module" ? inch(p.channel) + "″ channel" : p.drain.type + " drain"}</div>
                  <div className="pr" style={{ color: tierColor }}>{fm(tierOf(p))}</div>
                  <div className="fk">kit cost {fm0(kitCosts[p.key] || 0)} — our stock</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );

  const customTab = (() => {
    const sel = option && results.includes(option) ? option : null;
    return (
      <>
        <div className="roomform">
          <div className="rf"><label>Pan size — width × depth</label>
            <div className="dims">
              <NumIn className="inp" value={inp.w} onCommit={(v) => setInput({ w: +v || 0 })} />
              <span>×</span>
              <NumIn className="inp" value={inp.d} onCommit={(v) => setInput({ d: +v || 0 })} />
              <span>in</span>
            </div>
          </div>
          <div className="rf"><label>Curb</label>
            <div className="seg">
              {["curbed", "curbless"].map((v) => (
                <button key={v} className={inp.curb === v ? "on" : ""} onClick={() => setInput({ curb: v })}>{v[0].toUpperCase() + v.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className="rf"><label>Drain preference</label>
            <div className="seg">
              {["any", "center", "offset", "linear"].map((v) => (
                <button key={v} className={inp.drain === v ? "on" : ""} onClick={() => setInput({ drain: v })}>{v[0].toUpperCase() + v.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className="rf"><label>Drain — from left · from back</label>
            <div className="dims">
              <NumIn className="inp" style={{ width: 58 }} placeholder="auto" value={inp.drainX} onCommit={(v) => setInput({ drainX: v.trim() })} />
              <span>×</span>
              <NumIn className="inp" style={{ width: 58 }} placeholder="auto" value={inp.drainY} onCommit={(v) => setInput({ drainY: v.trim() })} />
              <span>in</span>
            </div>
          </div>
          <div className="rf"><label>Pan against</label>
            <div className="seg">
              <button className={inp.anchor !== "right" ? "on" : ""} onClick={() => setInput({ anchor: "left" })}>Left</button>
              <button className={inp.anchor === "right" ? "on" : ""} onClick={() => setInput({ anchor: "right" })}>Right</button>
            </div>
          </div>
          <div className="rf"><label>Walls</label>
            <div className="seg">
              {walls.map((w) => (
                <button key={w.id} className={w.on ? "on" : ""}
                  onClick={() => setWalls((ws) => ws.map((x) => (x.id === w.id ? { ...x, on: !x.on } : x)))}>{w.label}</button>
              ))}
            </div>
          </div>
          <div className="rf"><label>Wall height</label>
            <div className="dims"><NumIn className="inp" style={{ width: 58 }} value={wallH} onCommit={(v) => setWallH(+v || 96)} /><span>in</span></div>
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
    const counts = {};
    cat.forEach((e) => { counts[e.group] = (counts[e.group] || 0) + 1; });
    const groups = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = cat.filter((e) => {
      if (grp && e.group !== grp) return false;
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
        <div className="figcard">
          <div className="fh">Figure sealant &amp; fasteners — wedi's own planning rates</div>
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
          <div className="figfoot">1 screw + washer per ft² of panel · 1.2 oz sealant per ft² — Illustrated Price List pp. 19–21 · spacing 12″ walls / 6″ ceilings</div>
        </div>
        <div className="browsebar">
          <input className="inp" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the wedi catalog — name, SKU, group…" />
        </div>
        <div className="gchips">
          <button className={"gchip" + (!grp ? " on" : "")} onClick={() => setGrp("")}>All <small>{cat.length}</small></button>
          {groups.map((g) => (
            <button key={g} className={"gchip" + (grp === g ? " on" : "")} onClick={() => setGrp(g)}>{GROUP_LABEL[g] || g} <small>{counts[g]}</small></button>
          ))}
        </div>
        {list.slice(0, MAX).map((e) => {
          const n = qtyIn(e.key);
          return (
            <div className={"brow" + (e.stock ? " stk" : "")} key={e.key}>
              <span className={"sdot" + (e.stock ? "" : " so")} title={e.stock ? "stocked" : "special order"} />
              <div className="bn">
                <div className="n"><FinDot e={e} />{e.name}</div>
                <div className="s">{[finName(e), GROUP_LABEL[e.group] || e.group, e.sizeText, e.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="sku">{e.stock ? e.erp : e.us}</div>
              <div className="pr" style={{ color: tierColor }}>{fm(tierOf(e))}<small>{tierId !== "retail" ? "retail " + fm(e.retail) : " "}</small></div>
              <div className="stepper">
                <button onClick={() => step(e.key, -1)}>−</button>
                <span className={"q" + (n ? "" : " zero")}>{n}</span>
                <button onClick={() => step(e.key, 1)}>+</button>
              </div>
            </div>
          );
        })}
        {list.length > MAX && <div className="more">{list.length - MAX} more — narrow the search or pick a group chip</div>}
      </>
    );
  })();

  // --- build column ---------------------------------------------------------
  const buildCol = (() => {
    if (!build) return (
      <>
        <div className="bc-scroll">
          <div className="bc-h"><div className="t">The build</div></div>
          <div className="bc-empty">Nothing yet.<br /><br />Click a pan card to assemble its house kit, solve a custom room, or step items in from Browse.</div>
        </div>
        <div className="bc-foot">
          <div className="btnrow">
            <button className="wbtn primary" disabled>Add to product lines</button>
            <button className="wbtn" disabled>Print</button>
            <button className="wbtn" disabled>Copy</button>
          </div>
        </div>
      </>
    );
    const auto = autoWallLens(pan, option ? option.room : null);
    const cornerOn = CORNER_LBL.filter((c) => corners[c[0]]);
    return (
      <>
        <div className="bc-scroll">
          <div className="bc-h">
            <div className="t">The build</div>
            <div className="sub">{pan ? (option ? option.title : pan.name.replace(/wedi\s*®?\s*/i, "") + " " + pan.sizeText) : "manual — from Browse"}</div>
          </div>

          {BUCKETS.map((bk) => {
            const lines = build.lines.filter((l) => l.group === bk[0]);
            const isAddon = bk[0] === "addon";
            if (!lines.length && !isAddon && bk[0] !== "walls") return null;
            if (!lines.length && bk[0] === "walls" && !pan) return null;
            return (
              <div className="bgroup" key={bk[0]}>
                <div className="bg-h">{bk[1]}
                  {bk[0] === "walls" && pan && (
                    <span className="wallctl">
                      {!option && <button className="wtgl" title="swap which side is the back (long ↔ short)" onClick={() => setWallFlip((v) => !v)}>⇄</button>}
                      <span className="pfseg">
                        <button className={panelFit ? "on" : ""} title="mixed sheet sizes, level courses, minimal vertical seams" onClick={() => setPanelFit(true)}>Fit</button>
                        <button className={!panelFit ? "on" : ""} title="one sheet size, by area" onClick={() => setPanelFit(false)}>One size</button>
                      </span>
                    </span>
                  )}
                </div>
                {bk[0] === "walls" && pan && (<>
                  {walls.map((w) => (
                    <div className="wallrow" key={w.id}>
                      <button className={"wname" + (w.on ? " on" : "")} onClick={() => setWalls((ws) => ws.map((x) => (x.id === w.id ? { ...x, on: !x.on } : x)))}>{w.label}</button>
                      <NumIn className="win" value={w.len} placeholder={String(auto[w.id] || "")} disabled={!w.on} title="length, in"
                        onCommit={(v) => setWalls((ws) => ws.map((x) => (x.id === w.id ? { ...x, len: v } : x)))} />
                      <span>×</span>
                      <NumIn className="win" value={w.h} placeholder={String(wallH)} disabled={!w.on} title="height, in — 40 for a half wall"
                        onCommit={(v) => setWalls((ws) => ws.map((x) => (x.id === w.id ? { ...x, h: v } : x)))} />
                      <span className="wu">{w.on ? round2(((+w.len || auto[w.id] || 0) * (+w.h || +wallH || 96)) / 144) + " sf" : "off"}</span>
                    </div>
                  ))}
                  {extraWalls.map((w) => (
                    <div className="wallrow" key={w.id}>
                      <button className="wname on" title="remove this wall" onClick={() => setExtraWalls((xs) => xs.filter((x) => x.id !== w.id))}>{EDGE_LBL[w.edge] || "Wall"}</button>
                      <NumIn className="win" value={w.len} title="length, in"
                        onCommit={(v) => setExtraWalls((xs) => xs.map((x) => (x.id === w.id ? { ...x, len: v } : x)))} />
                      <span>×</span>
                      <NumIn className="win" value={w.h} placeholder={String(wallH)} title="height, in"
                        onCommit={(v) => setExtraWalls((xs) => xs.map((x) => (x.id === w.id ? { ...x, h: v } : x)))} />
                      <span className="wu">{round2(((+w.len || 0) * (+w.h || +wallH || 96)) / 144)} sf ·{" "}
                        <b className="xdel" onClick={() => setExtraWalls((xs) => xs.filter((x) => x.id !== w.id))}>×</b></span>
                    </div>
                  ))}
                  <div className="addchips" style={{ paddingTop: 5 }}>
                    <button className={"addchip" + (placing ? " on" : "")} onClick={() => {
                      const next = !placing;
                      setPlacing(next);
                      if (next) say("Click an edge on the top-down drawing to add a wall — a corner toggles a 45° cut");
                    }}>{placing ? "Click an edge on the drawing…" : "+ Add wall"}</button>
                    {cornerOn.length > 0 && (
                      <span className="wu" style={{ fontSize: "9.5px", alignSelf: "center" }}>corner cuts: {cornerOn.map((c) => c[1]).join(", ")}</span>
                    )}
                  </div>
                </>)}
                {lines.map((l) => {
                  const e = l.item;
                  const price = tierOf(e);
                  const can = e.group === "panel" && panelFit ? null : swapChoices(l);
                  return (
                    <div className="bline" key={e.key + l.group}>
                      <div className="bn">
                        <div className="n"><FinDot e={e} />{e.name}</div>
                        <div className="m"><b>{e.stock ? e.erp : "SO " + e.us}</b>
                          {l.note ? " · " + l.note : finName(e) ? " · " + finName(e) : e.sizeText ? " · " + e.sizeText : ""}</div>
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
                    {ADDON_CHIPS.map((ac) => {
                      const on = ac[0] === "gun" ? build.lines.some((l) => l.item.key === SKU.gun) : build.lines.some((l) => l.item.group === ac[0]);
                      return (
                        <button key={ac[0]} className={"addchip" + (on ? " on" : "")} onClick={() => {
                          if (ac[0] === "gun") { setAddons((a) => (a.includes(SKU.gun) ? a.filter((k) => k !== SKU.gun) : [...a, SKU.gun])); return; }
                          const cur = build.lines.find((l) => l.item.group === ac[0]);
                          if (cur) {
                            setAddons((a) => a.filter((k) => { const it = item(k); return !it || it.group !== ac[0]; }));
                            setManual((mm) => mm.filter((m) => { const it = item(m.key); return !it || it.group !== ac[0]; }));
                            setQtyOv((o) => { const n = { ...o }; delete n[cur.item.key]; return n; });
                          } else {
                            const dk = addonDefault(ac[0]);
                            if (dk) setAddons((a) => [...a, dk]);
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

          {build.factory && build.factory.kit && (() => {
            const stockTotal = round2(build.lines.filter((l) => ["floor", "walls", "drain", "install"].includes(l.group))
              .reduce((t, l) => t + l.item.retail * l.qty, 0));
            const fk = build.factory.kit, diff = round2(fk.retail - stockTotal);
            return (
              <div className="fcomp">wedi's boxed kit for this size — <b>{fk.us}</b> {fm(fk.retail)}
                {build.factory.nojs ? " · NOJS " + fm(build.factory.nojs.retail) : ""}
                <br />stock build {fm(stockTotal)} —{" "}
                {diff >= 0 ? <span className="beat">beats the box by {fm(diff)}</span> : <span className="over">over the box by {fm(-diff)}</span>}
              </div>
            );
          })()}
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
          <div className="marginrow">cost {fm(totals.cost)}<span>margin {fm(totals.margin)} · {totals.sell ? Math.round(totals.margin / totals.sell * 100) : 0}%</span></div>
          <div className="btnrow">
            <button className="wbtn primary" onClick={() => setPayload(rows)} data-wedi-add><Plus size={13} /> Add to product lines</button>
            <button className="wbtn" disabled={!diag} onClick={() => setPrinting(true)}><Printer size={13} /> Print layout</button>
            <button className="wbtn" onClick={copyList}><ClipboardList size={13} /> Copy list</button>
          </div>
        </div>
      </>
    );
  })();

  const diagRail = (
    <div className="diagcol">
      {!diag ? (<>
        <div className="dc-h">The shower</div>
        <div className="dc-empty">Pick a pan or solve a room — the top-down layout and isometric view draw here for whatever is selected.</div>
      </>) : (<>
        <div className="dc-h">Top-down layout</div>
        {placing && <div className="dc-hint">Click an edge to add a wall — a corner toggles a 45° cut</div>}
        <TopDown o={diag} w={328} h={268} wallOn={wallOnMap} dWalls={dWalls} corners={corners} placing={placing}
          onCorner={(c) => { setCorners((o) => ({ ...o, [c]: !o[c] })); setPlacing(false); }}
          onEdge={(edge, geo) => {
            wallSeq.current += 1;
            setExtraWalls((xs) => [...xs, {
              id: wallSeq.current, edge,
              len: String(round2(edge === "entry" ? Math.min(24, geo.rw) : edge === "back" ? geo.rw : geo.rd)),
              h: "",
            }]);
            setPlacing(false);
            say("Wall added on the " + edge + " side — set its length and height in the Walls group");
          }} />
        <div className="dc-h" style={{ marginTop: 12 }}>Isometric</div>
        <Iso o={diag} w={328} h={306} dWalls={dWalls} panelFit={panelFit} />
        <div className="dc-legend">
          seams dashed moss · cuts dashed rust ·{" "}
          {panelFit ? "panel joints dotted on the walls" : "One-size panel mode — joints not drawn"}
          {" "}· corners click to toggle a 45° cut
        </div>
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
            <span className="n"><FinDot e={e} />{e.name}
              <small>{[finName(e), e.sizeText, e.stock ? e.erp : "SO — " + e.us].filter(Boolean).join(" · ")}</small></span>
            <span className="p">{fm(tierOf(e))}</span>
          </button>
        ))}
      </div>, document.body);
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
        <div className="t">wedi shower layout</div>
        <div className="sub">{areaName ? areaName + " — " : ""}FloorTrack</div>
        <div className="dt">{new Date().toLocaleDateString()}</div>
      </div>
      <div className="ps-room">
        {diag.title || (option ? option.title : "")} — room {inch(diag.room.w)}″ × {inch(diag.room.d)}″
        {build.pan && build.pan.drain ? " · " + build.pan.drain.type + " drain" : ""} · walls at {inch(wallH)}″
      </div>
      <div className="ps-diags">
        <div className="d"><div className="dh">Top-down layout</div>
          <TopDown o={diag} w={460} h={360} wallOn={wallOnMap} dWalls={dWalls} corners={corners} /></div>
        <div className="d"><div className="dh">Isometric</div>
          <Iso o={diag} w={460} h={360} dWalls={dWalls} panelFit={panelFit} /></div>
      </div>
      {(diag.pieces.some((p) => p.cut) || (diag.warnings || []).length || CORNER_LBL.some((c) => corners[c[0]])) && (<>
        <div className="ps-sec">Cuts &amp; install notes</div>
        {diag.pieces.filter((p) => p.cut).map((p, i) => (
          <div className="ps-warn" key={"c" + i}>✂ Cut {p.item.us || p.item.erp} to {inch(p.w)}″ × {inch(p.d)}″ (from {inch(p.cut.w)}″ × {inch(p.cut.d)}″)</div>
        ))}
        {(diag.warnings || []).map((wt, i) => <div className="ps-warn" key={"w" + i}>• {wt}</div>)}
        {CORNER_LBL.filter((c) => corners[c[0]]).map((c) => (
          <div className="ps-warn" key={c[0]}>• corner cut at {c[1]} — frame a 45° return</div>
        ))}
        {diag.drain && diag.drain.note && <div className="ps-warn">• {diag.drain.note}</div>}
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
                <td>{l.item.name}</td><td>{l.item.sizeText || ""}</td>
                <td className="num">{l.qty}</td><td className="num">{fm(p)}</td><td className="num">{fm(round2(p * l.qty))}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
      <div className="ps-tot"><span>{build.lines.length} lines</span><span>{tierId} total {fm(totals.sell)}</span></div>
      <div className="ps-note">
        Set every joint in wedi Joint Sealant. Fasteners every 12″ on wall framing, 6″ on ceilings.
        Pre-sloped extensions: trim the thick edge — the slope lands on the pan. Prices are the Jan 1 2026 book.
      </div>
    </div>, document.body);

  const TAB_DEFS = [
    ["kits", "Kits", pans().length + " pans"],
    ["custom", "Custom room", "solver"],
    ["browse", "Browse", nStock + " stock · " + (cat.length - nStock) + " SO"],
  ];

  return (
    <div className="print:hidden fixed inset-0 z-[70] flex items-start justify-center overflow-auto p-4"
      style={{ background: "rgba(20,15,10,.55)" }} onClick={onClose}>
      <style>{CSS}</style>
      <div className="wedi-pop relative w-full max-w-[1680px] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
        style={{ background: "var(--ft-cream)", borderColor: "var(--ft-border-strong)", height: "min(940px, 94vh)", minHeight: 560 }}
        onClick={(e) => e.stopPropagation()} data-wedi-pop>
        <div className="pop-head">
          <div>
            <div className="eyebrow">Vendor configurator</div>
            <div className="name">wedi shower systems <small>sell = book retail · cost = distributor net</small></div>
          </div>
          {tierBar}
          <button className="xbtn" onClick={onClose} title="Close"><X size={15} /></button>
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
      {payloadModal}
      {printSheet}
      {toast && createPortal(<div className="wedi-toast" onClick={(e) => e.stopPropagation()}>{toast}</div>, document.body)}
    </div>
  );
}

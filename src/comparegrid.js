// comparegrid — the four-way Compare grid (ticket 158 Phase 3): one room as
// wedi and Schluter, each on Board and on Membrane. The host popup's own cell
// is its live build; the other three are house kits derived fresh (ADR 0034
// decision 3, extended).
//
// Imports comparekit only, never an engine: wedi.js and schluter.js still meet
// in exactly one module (ADR 0034 decision 1). LAZY-CHUNK-ONLY, like it.
import {
  wediBuildFor, schluterBuildFor, wediCompareRows, schluterCompareRows, compareTotals,
  mirrorPlan, mirrorRow, hostAddedLines, wediOptionOf,
} from "./comparekit.js";

// Reading order — quote options letter the checked cells in this order.
export const CELLS = [
  { key: "wedi:board", brand: "wedi", sys: "board" },
  { key: "schluter:board", brand: "schluter", sys: "board" },
  { key: "wedi:membrane", brand: "wedi", sys: "membrane" },
  { key: "schluter:membrane", brand: "schluter", sys: "membrane" },
];
export const BRAND = { wedi: "wedi", schluter: "Schluter" };

/** The cell a host popup's live build fills; absent/unknown wallSys reads as that brand's default (ADR 0051). */
export const hostCellKey = (brand, cfg) => (brand === "wedi"
  ? "wedi:" + (cfg && cfg.wallSys === "membrane" ? "membrane" : "board")
  : "schluter:" + (cfg && cfg.wallSys === "board" ? "board" : "membrane"));

/** Today's other column: the other brand on the host's wall system. */
export const opposite = (key) => {
  const [brand, sys] = key.split(":");
  return (brand === "wedi" ? "schluter" : "wedi") + ":" + sys;
};

export function cellLabel(key, build) {
  if (key === "wedi:board") return "Building Panel";
  if (key === "schluter:board") return "KERDI-BOARD";
  if (key === "schluter:membrane") return "KERDI membrane";
  return build && build.pan && build.pan.sub !== "sdry" ? "S-DRY membrane on a wedi pan" : "S-DRY membrane";
}

// The host's hand-added lines as the SAME brand's `manual` — the other wall
// system carries them as they are, no mirror.
function sameBrandManual(build, brand) {
  return hostAddedLines(build, brand).map((h) => (brand === "wedi"
    ? { key: h.part.item.key, qty: h.qty, group: h.part.g }
    : { sku: h.part.item.sku, qty: h.qty, g: h.part.g }));
}

// Chip order is severity order; the cell shows the first two.
const FLAG_ORDER = ["mortar", "drain", "sdry", "short", "deep", "price", "unmatched"];
const FLAG_LABEL = {
  mortar: "No tray fits — mortar bed",
  drain: "No drain match",
  sdry: "No S-DRY base fits",
  short: "Channel runs short",
  deep: "Deep cut",
  price: "No price",
  unmatched: "Added line unmatched",
};
const WEDI_DRAIN_MISS = /^no \S+-drain base fits|^no base reaches|^S-DRY has no linear base/;

/**
 * What didn't map cleanly in one cell's build: [{ id, label, rowKey }], most
 * severe first. rowKey is the detail row a chip scrolls to — the cell's Base
 * row when the flag has no line of its own. `option` is the wedi solver option
 * the build came from (wediOptionOf); Schluter reads its build's own `cand`.
 */
export function cellFlags(brand, build, rows, plan, option) {
  rows = rows || [];
  const keyWhere = (pred) => (rows.find(pred) || {}).key || null;
  const baseKey = keyWhere((r) => r.group === "base") || (rows[0] && rows[0].key) || null;
  const hit = {};
  const note = (re) => keyWhere((r) => re.test(r.sub || ""));
  if (brand === "schluter") {
    const cand = build && build.cand;
    if (cand && cand.kind === "mortar") hit.mortar = baseKey;
    const dr = note(/can't be made here/);
    if (dr) hit.drain = dr;
    const sh = note(/runs short/);
    if (sh) hit.short = sh;
    if (cand && cand.deep) hit.deep = baseKey;
  } else {
    const warn = (option && option.warnings) || [];
    if (warn.some((w) => WEDI_DRAIN_MISS.test(w))) hit.drain = keyWhere((r) => r.group === "drain") || baseKey;
    const cfg = (build && build.cfg) || {};
    if (cfg.wallSys === "membrane" && (cfg.sdryBase === "wedi" || (cfg.solve && cfg.solve.id === "sdry-nearest"))) hit.sdry = baseKey;
    if (option && (option.deep || warn.some((w) => /^deep cut/.test(w)))) hit.deep = baseKey;
  }
  const free = keyWhere((r) => !r.noteOnly && !(r.retail > 0));
  if (free) hit.price = free;
  const lost = plan && plan.entries.find((e) => !e.match);
  if (lost) hit.unmatched = lost.hostKey;
  return FLAG_ORDER.filter((id) => id in hit).map((id) => ({ id, label: FLAG_LABEL[id], rowKey: hit[id] || baseKey }));
}

/**
 * One grid cell. ctx (shared by all four):
 *   { hostBrand, hostKey, hostBuild, hostCfg, room, roomOk,
 *     ready: { wedi, schluter }, cat, source, tier, mortarItem, wPct, sPct }
 * per-cell: { mirror } — this cell's mirror state (other-brand cells only) —
 * and { sdryPick } — "nearest" puts a no-fit wedi Membrane cell on the
 * nearest S-DRY base instead of a wedi pan.
 * Returns { key, brand, sys, live, build, cfg, rows, plan, totals, flags, label, name };
 * rows is empty when the cell can't be built.
 */
export function cellBuild(key, ctx, { mirror, sdryPick } = {}) {
  const { brand, sys } = CELLS.find((c) => c.key === key);
  const live = key === ctx.hostKey;
  const pct = brand === "wedi" ? ctx.wPct : ctx.sPct;
  const rowsOf = (b) => (brand === "wedi" ? wediCompareRows(b, { builderPct: pct }) : schluterCompareRows(b, { builderPct: pct }));
  let build = null, cfg = null, rows = [], plan = null;
  if (live) {
    build = ctx.hostBuild || null;
    cfg = brand === "schluter" ? ctx.hostCfg || null : null;
    rows = rowsOf(build);
  } else if (ctx.roomOk && ctx.ready[brand]) {
    plan = brand === ctx.hostBrand ? null : mirrorPlan(ctx.hostBuild, ctx.hostBrand, mirror, { cat: ctx.cat, source: ctx.source });
    const manual = plan ? plan.manual : sameBrandManual(ctx.hostBuild, brand);
    if (brand === "wedi") {
      build = wediBuildFor(ctx.room, {
        source: ctx.source, tier: ctx.tier, manual, wallSys: sys,
        ...(sys === "membrane" && sdryPick === "nearest" ? { sdryBase: "nearest" } : {}),
      });
    } else {
      ({ build, cfg } = schluterBuildFor(ctx.room, ctx.cat, { source: ctx.source, mortarItem: ctx.mortarItem, manual, wallSys: sys }));
    }
    const kit = rowsOf(build);
    // the other brand bills the mirrored lines summed; Compare shows one per host line
    rows = !plan || !kit.length ? kit
      : [...kit.filter((r) => !r.added), ...plan.entries.filter((e) => e.match).map((e) => mirrorRow(e, brand, { builderPct: pct }))];
  }
  const option = brand === "wedi" && rows.length ? wediOptionOf(build) : null;
  const label = cellLabel(key, build);
  return {
    key, brand, sys, live, build, cfg, rows, plan,
    totals: compareTotals(rows),
    flags: rows.length ? cellFlags(brand, build, rows, plan, option) : [],
    label, name: BRAND[brand] + " · " + label,
  };
}

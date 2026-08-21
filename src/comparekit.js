// comparekit — one room priced in both shower systems.
//
// The FIRST module allowed to import both engines: wedi.js (built-in tables,
// pan solver) and schluter.js (registry-fed catalog, tray candidates). It owns
// only the mapping and the aligned rows — every price comes back out of the
// engine that made the line, so neither engine's pinned totals can move.
//
// The neutral room both sides speak:
//   { w, d, curbed, drain: "point"|"offset"|"linear",
//     walls: [{ side: "back"|"left"|"right", on, len, h }] }

import { solve, kitFor, item, tierPrice as wediTierPrice, round2 } from "./wedi.js";
import { trayCandidates, buildKit, tierPrice as schluterTierPrice } from "./schluter.js";

export const COMPARE_CATS = ["Base", "Drain", "Walls", "Seams", "Curb", "Setting", "Extras"];

// wedi lines carry no category token of their own — the catalog group is it.
const WEDI_CAT = {
  pan: "Base", module: "Base", modExt: "Base", extension: "Base",
  cornerExt: "Base", kit: "Base", curb: "Curb", ramp: "Curb", panel: "Walls",
  cover: "Drain", coverFrame: "Drain", drainKit: "Drain", collar: "Drain",
  sealant: "Seams", fastener: "Seams", subliner: "Seams", sdry: "Seams",
  tool: "Setting",
};

const SIDES = [["Back", "back"], ["Left", "left"], ["Right", "right"]];
const WEDI_DRAIN = { point: "center", offset: "offset", linear: "linear" };

const sub = (lead, note) => [lead, note].filter(Boolean).join(" · ");
const isEst = (note) => /allowance/i.test(note || "");

export function roomFromSchluter(cfg) {
  cfg = cfg || {};
  return {
    w: +cfg.w || 0, d: +cfg.d || 0,
    curbed: !!cfg.curbed,
    drain: cfg.drain || "point",
    walls: (cfg.walls || []).map((w) => ({
      side: String(w.name || "").toLowerCase(), on: !!w.on, len: +w.len || 0, h: +w.h || 84,
    })),
  };
}

export function roomFromWedi(cfg) {
  cfg = cfg || {};
  const input = (cfg.solve && cfg.solve.input) || null;
  // A Kits-tab pick never ran the solver — kitFor stamps `solve: null` — so the
  // PAN is the only record of what was built. Defaulting there quoted a linear
  // or curbless build against a curbed point-drain house kit on the other side.
  const pan = input ? null : (cfg.panKey ? item(cfg.panKey) : null);
  const dr = input ? input.drain : (pan && pan.drain && pan.drain.type);
  const drain = dr === "offset" ? "offset" : dr === "linear" ? "linear" : "point";
  return {
    w: (cfg.room && +cfg.room.w) || 0, d: (cfg.room && +cfg.room.d) || 0,
    curbed: input ? input.curb !== "curbless" : !(pan && pan.sub === "curbless"),
    drain: drain,
    // a wedi cfg lists only the walls that are standing
    walls: (cfg.walls || []).map((w) => ({ side: w.side, on: true, len: +w.len || 0, h: +w.h || 84 })),
  };
}

/**
 * Solve the room in wedi and build the house kit for the top-ranked option —
 * the composition WediConfigurator.jsx's `solveRoom`/`build` make, minus the
 * popup's own customizations (no add-ons, benches, overrides or curb inset).
 * Null when nothing solves.
 */
export function wediBuildFor(room, { source, tier } = {}) {
  room = room || {};
  const walls = (room.walls || []).filter((w) => w.on)
    .map((w) => ({ side: w.side, len: +w.len || 0, h: +w.h || 84 }));
  const option = solve({
    w: +room.w || 0, d: +room.d || 0,
    curb: room.curbed ? "curbed" : "curbless",
    drain: WEDI_DRAIN[room.drain] || "center",
    tolerance: 0.51, drainX: 0, drainY: 0, anchor: "left", source: source,
  })[0];
  if (!option) return null;
  return kitFor(option.pan.key, {
    option: option, room: option.room,
    walls: walls, wallHeight: (walls[0] && walls[0].h) || 84,
    mode: "kit", tier: tier,
  });
}

/**
 * The SchluterConfigurator `cfg` useMemo over the neutral room, plus the build
 * for its top-ranked tray. The cfg comes back beside the build because it is
 * what "Schluter — reconfigure" reopens on.
 */
export function schluterBuildFor(room, cat, { source, mortarItem } = {}) {
  room = room || {};
  const w = +room.w || 0, d = +room.d || 0;
  const cfg = {
    w: w, d: d, curbed: !!room.curbed, drain: room.drain || "point",
    wallSys: "membrane", bench: null,
    walls: SIDES.map(([name, side], i) => {
      const hit = (room.walls || []).find((x) => x.side === side);
      return { name: name, on: !!(hit && hit.on), len: i === 0 ? w : d, h: (hit && +hit.h) || 84 };
    }),
    ...(mortarItem ? { mortarItem } : {}),
  };
  const pick = trayCandidates(cfg, cat, { source })[0];
  return { build: buildKit(cfg, cat, { source, pick }), cfg };
}

export function wediCompareRows(build, { builderPct } = {}) {
  const hasBuild = !!(build && build.lines);
  const rows = ((build && build.lines) || []).map((l) => {
    const e = l.item;
    return {
      cat: WEDI_CAT[e.group] || "Extras",
      name: e.name,
      sub: sub(e.us, l.note),
      qty: l.qty,
      stock: !!e.stock,
      noteOnly: false,
      est: isEst(l.note),
      retail: round2(wediTierPrice(e, "retail") * l.qty),
      // builderPct here is wedi's OWN percent-off knob (18 ≡ the ×0.82 house
      // rule, wedi.js builderMult) — never feed it schluter's builderPct.
      builder: round2(wediTierPrice(e, "builder", builderPct) * l.qty),
      // wedi's tier lens has no cost tier — cost IS the distributor net field,
      // read the way the wedi popup's own cost line reads it
      cost: round2((+e.cost || 0) * l.qty),
    };
  });
  // wedi's house kit has no thin-set line, and a blank Setting cell beside
  // Schluter's ALL-SET reads as a missing part rather than a different system.
  // Only append the note beside a real build — wediCompareRows(null) is [].
  if (hasBuild) {
    rows.push({
      cat: "Setting", name: "Thin-set for pan bed", sub: "by others / shop stock",
      qty: 1, stock: true, noteOnly: true, est: false, retail: 0, builder: 0, cost: 0,
    });
  }
  return rows;
}

export function schluterCompareRows(build, { builderPct } = {}) {
  return ((build && build.lines) || []).map((l) => {
    const e = l.item;
    return {
      cat: COMPARE_CATS.includes(l.g) ? l.g : "Extras",
      name: e.name,
      sub: sub(e.sku, l.note),
      qty: l.qty,
      stock: !!e.stock,
      noteOnly: !!l.noteOnly,
      est: isEst(l.note),
      retail: round2(schluterTierPrice(e, "retail", {}) * l.qty),
      builder: round2(schluterTierPrice(e, "builder", { builderPct }) * l.qty),
      cost: round2(schluterTierPrice(e, "cost", {}) * l.qty),
    };
  });
}

export function compareTotals(rows) {
  const bill = (rows || []).filter((r) => !r.noteOnly);
  return {
    retail: round2(bill.reduce((s, r) => s + r.retail, 0)),
    builder: round2(bill.reduce((s, r) => s + r.builder, 0)),
    cost: round2(bill.reduce((s, r) => s + r.cost, 0)),
    lines: bill.length,
    stocked: bill.filter((r) => r.stock).length,
    soCount: bill.filter((r) => !r.stock).length,
  };
}

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

import {
  solve, kitFor, item, tierPrice as wediTierPrice, round2, WEDI_ADD_PARTS, wediSlotOf,
  catalog as wediCatalog, coverageOf as wediCoverageOf,
} from "./wedi.js";
import {
  trayCandidates, buildKit, addedLines, tierPrice as schluterTierPrice, ADD_PARTS, slotOf, coverageOf as schluterCoverageOf,
} from "./schluter.js";
import { GROUPS, groupOf, SLOT_LABEL } from "./slots.js";
import { rankParts, nearest, matchQty } from "./comparemirror.js";

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
export function wediBuildFor(room, { source, tier, manual } = {}) {
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
    ...(manual && manual.length ? { manual } : {}),
  });
}

/**
 * The SchluterConfigurator `cfg` useMemo over the neutral room, plus the build
 * for its top-ranked tray. The cfg comes back beside the build because it is
 * what "Schluter — reconfigure" reopens on.
 */
export function schluterBuildFor(room, cat, { source, mortarItem, manual } = {}) {
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
    ...(manual && manual.length ? { manual } : {}),
  };
  const pick = trayCandidates(cfg, cat, { source })[0];
  const build = buildKit(cfg, cat, { source, pick });
  // buildKit bills the recipe only; added rows ride on top, as buildFromMarker does
  if (build && build.lines && cfg.manual) build.lines.push(...addedLines(cfg.manual, cat));
  return { build, cfg };
}

// One engine's three money columns for `qty` of a part. builderPct is that
// brand's OWN knob — wedi's percent-off (18 ≡ the ×0.82 house rule,
// wedi.js builderMult) or Schluter's −8% — never the other's. wedi's tier
// lens has no cost tier: cost IS the distributor net field, read the way the
// wedi popup's own cost line reads it.
function money(brand, e, qty, builderPct) {
  if (brand === "wedi") return {
    retail: round2(wediTierPrice(e, "retail") * qty),
    builder: round2(wediTierPrice(e, "builder", builderPct) * qty),
    cost: round2((+e.cost || 0) * qty),
  };
  return {
    retail: round2(schluterTierPrice(e, "retail", {}) * qty),
    builder: round2(schluterTierPrice(e, "builder", { builderPct }) * qty),
    cost: round2(schluterTierPrice(e, "cost", {}) * qty),
  };
}

// Every row names its shared group and slot (slots.js), and whether it was
// added by hand — a Browse-only wedi build is all hand-added, so nothing there
// is tagged. `key` is the 1c added-row identity: engine group + part.
export function wediCompareRows(build, { builderPct } = {}) {
  return ((build && build.lines) || []).map((l) => {
    const e = l.item;
    return {
      group: groupOf(l.slot), slot: l.slot || "extra",
      key: l.group + "|" + e.key,
      added: !!(l.added && build.pan),
      name: e.name,
      sub: sub(e.us, l.note),
      qty: l.qty,
      stock: !!e.stock,
      noteOnly: false,
      est: isEst(l.note),
      ...money("wedi", e, l.qty, builderPct),
    };
  });
}

export function schluterCompareRows(build, { builderPct } = {}) {
  return ((build && build.lines) || []).map((l) => {
    const e = l.item;
    return {
      group: groupOf(l.slot), slot: l.slot || "extra",
      key: l.g + "|" + (e.sku || e.name),
      added: !!l.manual,
      name: e.name,
      sub: sub(e.sku, l.note),
      qty: l.qty,
      stock: !!e.stock,
      noteOnly: !!l.noteOnly,
      est: isEst(l.note),
      ...money("schluter", e, l.qty, builderPct),
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

// ---------------------------------------------------------------------------
// The mirror (ticket 158 Phase 1d): each line the host popup's build added by
// hand gets the other brand's nearest part in the same slot, shown as an
// added line in the other column and billed by the other engine. A hand pick
// or a drop is session state keyed by the host line's `key`.

const other = (brand) => (brand === "wedi" ? "schluter" : "wedi");

function asPart(brand, e, slot, g) {
  return {
    brand, item: e, slot, g,
    id: brand === "wedi" ? e.key : e.sku,
    cov: brand === "wedi" ? wediCoverageOf(e) : schluterCoverageOf(e),
    retail: brand === "wedi" ? wediTierPrice(e, "retail") : schluterTierPrice(e, "retail", {}),
  };
}

/** The host build's added lines as mirror hosts: { key, qty, name, part }. */
export function hostAddedLines(build, brand) {
  if (!build || !build.lines) return [];
  const rows = brand === "wedi" ? wediCompareRows(build) : schluterCompareRows(build);
  return build.lines.map((l, i) => [l, rows[i]]).filter(([, r]) => r.added && !r.noteOnly)
    .map(([l, r]) => ({ key: r.key, qty: l.qty, name: l.item.name, part: asPart(brand, l.item, r.slot, brand === "wedi" ? l.group : l.g) }));
}

/**
 * A brand's "+" parts for a shared group, each with its candidates as mirror
 * parts: [{ key, label, g, parts }]. The same table the popups' "+" reads, so
 * Compare never offers a part the brand's own bill wouldn't. `cat` is the
 * Schluter catalog; wedi reads its installed one.
 */
export function mirrorParts(brand, grp, { cat, source } = {}) {
  const wedi = brand === "wedi";
  const items = wedi ? wediCatalog() : cat || [];
  return ((wedi ? WEDI_ADD_PARTS : ADD_PARTS)[grp] || []).filter((p) => p.hit).map((p) => {
    const g = wedi ? p.group : p.g;
    // Stock only narrows a part to its stocked items unless it has none — the popups' pool rule
    const hits = items.filter(p.hit);
    const st = hits.filter((e) => e.stock);
    const list = source === "stock" && st.length ? st : hits;
    return {
      key: p.key, label: p.label, g,
      parts: list.map((e) => asPart(brand, e, wedi ? wediSlotOf({ item: e, group: g }) : slotOf(g, e), g)),
    };
  }).filter((p) => p.parts.length);
}

/** One part's candidates, nearest the host first — what the picker lists and the auto-match takes the top of. */
export const mirrorCandidates = (host, part) => rankParts(host.part, part.parts);

/**
 * The other column's mirror for a host build.
 *   state: { [hostKey]: { pick: { g, id, qty } } | { dropped: true } }
 * Returns { brand, entries, manual }: one entry per host added line —
 * kind "matched" | "picked" (with `match` and `qty`) | "none" | "dropped" —
 * and `manual`, the other engine's added rows (one per engine group + part,
 * qty summed) to rebuild its house kit with.
 */
export function mirrorPlan(hostBuild, hostBrand, state, { cat, source } = {}) {
  const brand = other(hostBrand);
  const entries = hostAddedLines(hostBuild, hostBrand).map((h) => {
    const grp = groupOf(h.part.slot);
    const s = (state || {})[h.key];
    const base = { hostKey: h.key, host: h, grp, slot: h.part.slot };
    if (s && s.dropped) return { ...base, kind: "dropped" };
    if (s && s.pick) {
      // a hand pick stands under Stock only too — it was chosen, not figured
      const all = mirrorParts(brand, grp, { cat, source: "all" }).flatMap((p) => p.parts);
      const hit = all.find((c) => c.g === s.pick.g && c.id === s.pick.id);
      return hit ? { ...base, kind: "picked", match: hit, qty: s.pick.qty } : { ...base, kind: "none" };
    }
    const cands = mirrorParts(brand, grp, { cat, source }).flatMap((p) => p.parts).filter((c) => c.slot === h.part.slot);
    const m = nearest(h.part, cands);
    return m ? { ...base, kind: "matched", match: m, qty: matchQty(h.part, h.qty, m) } : { ...base, kind: "none" };
  });
  const manual = [];
  for (const e of entries) {
    if (!e.match) continue;
    const hit = manual.find((r) => (brand === "wedi" ? r.key === e.match.id && r.group === e.match.g : r.sku === e.match.id && r.g === e.match.g));
    if (hit) hit.qty += e.qty;
    else manual.push(brand === "wedi" ? { key: e.match.id, qty: e.qty, group: e.match.g } : { sku: e.match.id, qty: e.qty, g: e.match.g });
  }
  return { brand, entries, manual };
}

/** The Compare row for a mirrored line, priced by the other engine. */
export function mirrorRow(entry, brand, { builderPct } = {}) {
  const e = entry.match.item;
  return {
    group: entry.grp, slot: entry.match.slot, key: entry.hostKey,
    added: true, mirror: entry.kind, hostKey: entry.hostKey,
    name: e.name,
    sub: "for " + (entry.host.qty > 1 ? entry.host.qty + "× " : "") + entry.host.name,
    qty: entry.qty, stock: !!e.stock, noteOnly: false, est: false,
    ...money(brand, e, entry.qty, builderPct),
  };
}

/** A mirror state with entries for host lines that are gone dropped. */
export const pruneMirror = (state, hostKeys) => Object.fromEntries(Object.entries(state || {}).filter(([k]) => hostKeys.includes(k)));

/**
 * The grid: one band per shared group, one row per slot either column fills
 * (a mirror "+" counts), in slots.js order; empty slots and groups drop out.
 *   cols: { wedi: rows, schluter: rows }, plus: { wedi: entries, schluter: entries }
 */
export function compareLayout(cols, plus = {}) {
  const pick = (list, slot) => (list || []).filter((r) => r.slot === slot);
  const kitFirst = (rs) => [...rs.filter((r) => !r.added), ...rs.filter((r) => r.added)];
  return GROUPS.map((g) => ({
    key: g.key, label: g.label,
    slots: g.slots.map((slot) => ({
      slot, label: SLOT_LABEL[slot],
      wedi: kitFirst(pick(cols.wedi, slot)), schluter: kitFirst(pick(cols.schluter, slot)),
      wediPlus: pick(plus.wedi, slot), schluterPlus: pick(plus.schluter, slot),
    })).filter((r) => r.wedi.length || r.schluter.length || r.wediPlus.length || r.schluterPlus.length),
  })).filter((g) => g.slots.length);
}

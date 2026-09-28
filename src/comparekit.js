// comparekit — one room priced in both shower systems.
//
// The FIRST module allowed to import both engines: wedi.js (built-in tables,
// pan solver) and schluter.js (registry-fed catalog, tray candidates). It owns
// only the mapping and the aligned rows — every price comes back out of the
// engine that made the line, so neither engine's pinned totals can move.
//
// The neutral room both sides speak:
//   { w, d, curbed, drain: "point"|"offset"|"linear",
//     walls: [{ side: "back"|"left"|"right", on, len, h }], benches: [...] }
// (defined in compareset.js, so the popups can stamp a kept build with it)

import {
  solve, kitFor, item, tierPrice as wediTierPrice, round2, WEDI_ADD_PARTS, wediSlotOf,
  catalog as wediCatalog, coverageOf as wediCoverageOf, sdryNoFit,
  buildFromMarker as wediFromMarker, panelFitLines,
} from "./wedi.js";
import {
  trayCandidates, buildKit, addedLines, tierPrice as schluterTierPrice, ADD_PARTS, slotOf, coverageOf as schluterCoverageOf,
  boardPlan, expandBoardFaces, applyBoardPlan, buildFromMarker as schluterFromMarker,
} from "./schluter.js";
import { GROUPS, groupOf, SLOT_LABEL } from "./slots.js";
import { rankParts, nearest, matchQty } from "./comparemirror.js";
import { neutralRoomSchluter, neutralRoomWedi, mergeManual } from "./compareset.js";

const SIDES = [["Back", "back"], ["Left", "left"], ["Right", "right"]];
const WEDI_DRAIN = { point: "center", offset: "offset", linear: "linear" };

const sub = (lead, note) => [lead, note].filter(Boolean).join(" · ");
const isEst = (note) => /allowance/i.test(note || "");

export const roomFromSchluter = (cfg) => neutralRoomSchluter(cfg);
export const roomFromWedi = (cfg) => neutralRoomWedi(cfg, item);

// A room's benches for a brand. `part` is a brand-specific premade SKU, so it
// crosses only within the brand it came from; the other engine's normBench
// picks its own premade for the same geometry.
export const benchesFor = (brand, room, fromBrand) =>
  ((room && room.benches) || []).map(({ part, ...b }) => (brand === fromBrand && part ? { ...b, part } : b));

function wediInput(room, source) {
  room = room || {};
  return {
    w: +room.w || 0, d: +room.d || 0,
    curb: room.curbed ? "curbed" : "curbless",
    drain: WEDI_DRAIN[room.drain] || "center",
    tolerance: 0.51, drainX: 0, drainY: 0, anchor: "left", source: source,
  };
}

/**
 * Solve the room in wedi and build the house kit for the top-ranked option —
 * the composition WediConfigurator.jsx's `solveRoom`/`build` make, minus the
 * popup's own customizations (no add-ons, benches, overrides or curb inset).
 * Under Membrane (ADR 0051) the S-DRY fit goes first; when it can't fit, a
 * wedi pan takes the floor with S-DRY walls — no prompt here, the build's
 * `cfg.sdryBase` says so. `sdryBase: "nearest"` is the popup prompt's other
 * answer: the nearest S-DRY base anyway. Null when nothing solves.
 */
export function wediBuildFor(room, { source, tier, manual, wallSys, sdryBase, benches, choices } = {}) {
  room = room || {};
  const walls = (room.walls || []).filter((w) => w.on)
    .map((w) => ({ side: w.side, len: +w.len || 0, h: +w.h || 84 }));
  const input = wediInput(room, source);
  const membrane = wallSys === "membrane";
  const sdry = membrane && sdryBase !== "wedi"
    ? solve({ ...input, system: "sdry", ...(sdryBase === "nearest" ? { nearest: true } : {}) })[0] : null;
  const option = sdry || solve(input)[0];
  if (!option) return null;
  return kitFor(option.pan.key, {
    option: option, room: option.room,
    walls: walls, wallHeight: (walls[0] && walls[0].h) || 84,
    mode: "kit", tier: tier,
    benches: (benches || room.benches || []).map((b) => ({ ...b })),
    ...(choices || {}),
    ...(membrane ? { wallSys: "membrane", ...(sdry ? {} : { sdryBase: "wedi" }) } : {}),
    ...(manual && manual.length ? { manual } : {}),
  });
}

/** Why no S-DRY base fits the room ("" when one does) — the grid's no-fit prompt reads it. */
export const wediSdryNoFit = (room, { source } = {}) => sdryNoFit(wediInput(room, source));

/**
 * The solver option a wedi build was made from — its warnings and deep-cut
 * flag are what the Compare grid's chips read. Re-solves the saved input and
 * takes the option by id + pan; null for a Kits-tab pick (no solve) or when
 * the option no longer comes back.
 */
export function wediOptionOf(build) {
  const s = build && build.cfg && build.cfg.solve;
  if (!s || !s.input || !build.pan) return null;
  return solve(s.input).find((o) => o.id === s.id && o.pan && o.pan.key === build.pan.key) || null;
}

/**
 * The SchluterConfigurator `cfg` useMemo over the neutral room, plus the build
 * for its top-ranked tray. The cfg comes back beside the build because it is
 * what "Schluter — reconfigure" reopens on.
 */
export function schluterBuildFor(room, cat, { source, mortarItem, manual, wallSys, benches } = {}) {
  room = room || {};
  const w = +room.w || 0, d = +room.d || 0;
  const cfg = {
    w: w, d: d, curbed: !!room.curbed, drain: room.drain || "point",
    wallSys: wallSys === "board" ? "board" : "membrane",
    benches: (benches || room.benches || []).map((b) => ({ ...b })),
    walls: SIDES.map(([name, side], i) => {
      const hit = (room.walls || []).find((x) => x.side === side);
      return { name: name, on: !!(hit && hit.on), len: i === 0 ? w : d, h: (hit && +hit.h) || 84 };
    }),
    ...(mortarItem ? { mortarItem } : {}),
    ...(manual && manual.length ? { manual } : {}),
  };
  const pick = trayCandidates(cfg, cat, { source })[0];
  const build = buildKit(cfg, cat, { source, pick });
  // KERDI-BOARD walls bill the popup's default Fit plan, per sheet
  if (build && build.lines && cfg.wallSys === "board")
    build.lines = applyBoardPlan(build.lines, cfg, boardPlan(expandBoardFaces(cfg), cat, { source }), cat);
  // buildKit bills the recipe only; added rows ride on top, as buildFromMarker does
  if (build && build.lines && cfg.manual) build.lines.push(...addedLines(cfg.manual, cat));
  return { build, cfg };
}

// --- the Compare set (ticket 158 Phase 4, ADR 0052) ---------------------------

// Kept builds price exactly what their popup showed: the marker's build plus
// the default Fit plan (wedi panels, KERDI-BOARD sheets). Stepped quantities
// never ride a marker, so they don't ride a kept build either.
export function wediKeptBuild(snap) {
  const b = snap && snap.cfg ? wediFromMarker(snap) : null;
  if (!b) return null;
  return { ...b, cfg: { ...b.cfg, source: snap.cfg.source }, lines: panelFitLines(b.lines, b.cfg.walls, b.panelSf) };
}

export function schluterKeptBuild(snap, cat) {
  const cfg = snap && snap.cfg;
  const b = cfg ? schluterFromMarker(snap, cat) : null;
  if (!b) return null;
  const source = cfg.source === "stock" ? "stock" : "all";
  const lines = cfg.wallSys === "board"
    ? applyBoardPlan(b.lines, cfg, boardPlan(expandBoardFaces(cfg), cat, { source }), cat) : b.lines;
  return { build: { ...b, lines }, cfg: { ...cfg, pick: b.pick && b.pick.tray ? b.pick.tray.sku : null } };
}

// The anchor's hand-added lines as a brand's `manual`: the same brand takes
// them as they are, the other brand its auto nearest match.
export function anchorManualFor(brand, hostBuild, hostBrand, { cat, source } = {}) {
  if (brand !== hostBrand) return mirrorPlan(hostBuild, hostBrand, {}, { cat, source }).manual;
  return hostAddedLines(hostBuild, brand).map((h) => (brand === "wedi"
    ? { key: h.part.item.key, qty: h.qty, group: h.part.g }
    : { sku: h.part.item.sku, qty: h.qty, g: h.part.g }));
}

const WEDI_CHOICES = ["panelKey", "curbPick", "fastenerKey", "coverPick", "coverFrame", "sealantForm", "recess"];

/**
 * Which kept choices didn't resolve in a build: slot words ("drain", "curb",
 * …). The engines already fall back to the house pick (ADR 0049); this only
 * names it so the column can say so.
 */
export function keptDropped(brand, cfg, build) {
  cfg = cfg || {};
  const lines = (build && build.lines) || [];
  const out = [];
  if (brand === "schluter") {
    const skus = new Set(lines.map((l) => l.item && l.item.sku));
    for (const [slot, sku] of Object.entries(cfg.swaps || {})) if (sku && !skus.has(sku)) out.push(slot);
    if (cfg.drainPick && lines.some((l) => /can't be made here/.test(l.note || ""))) out.push("drain");
    return out;
  }
  const has = (pred) => lines.some((l) => l.item && pred(l.item, l));
  const cp = cfg.coverPick;
  if (cp && cp.key && !has((it) => it.key === cp.key)) out.push("cover");
  else if (cp && cp.finish && !has((it) => it.group === "cover" && it.finish === cp.finish)) out.push("cover");
  const kp = cfg.curbPick;
  if (kp && !kp.none && kp.sub && !has((it) => it.group === "curb" && it.sub === kp.sub)) out.push("curb");
  if (cfg.panelKey && !has((it) => it.key === cfg.panelKey)) out.push("panel");
  return out;
}

/**
 * Sync a kept build to the anchor (owner option b): the anchor's neutral room
 * and hand-added lines come over; the kept build's own choices and added
 * lines stay. Brand-only geometry the neutral room can't place (Schluter's
 * added walls, corners, drain offset, ramp; wedi's corners and its solve)
 * resets, and the tray / pan re-ranks for the new room.
 * Returns { snap: { mode, cfg }, dropped } or null when nothing builds.
 */
export function syncKept(brand, entry, { room, hostBuild, hostBrand, cat, tier } = {}) {
  const cfg = (entry && entry.snap && entry.snap.cfg) || {};
  const source = cfg.source === "stock" ? "stock" : "all";
  const incoming = anchorManualFor(brand, hostBuild, hostBrand, { cat, source });
  if (brand === "wedi") {
    const manual = mergeManual(cfg.manual || [], incoming, (r) => r.key);
    const choices = Object.fromEntries(WEDI_CHOICES.filter((k) => cfg[k] != null).map((k) => [k, cfg[k]]));
    const b = wediBuildFor(room, {
      source, tier, manual, wallSys: cfg.wallSys === "membrane" ? "membrane" : "board",
      benches: benchesFor("wedi", room, hostBrand), choices,
    });
    if (!b) return null;
    const lines = panelFitLines(b.lines, b.cfg.walls, b.panelSf);
    return { snap: { mode: "custom", cfg: { ...b.cfg, source } }, dropped: keptDropped("wedi", cfg, { lines }) };
  }
  const w = +room.w || 0, d = +room.d || 0;
  const next = {
    ...cfg,
    w, d, curbed: !!room.curbed, drain: room.drain || "point",
    walls: SIDES.map(([name, side], i) => {
      const hit = (room.walls || []).find((x) => x.side === side);
      return { name, on: !!(hit && hit.on), len: i === 0 ? w : d, h: (hit && +hit.h) || 84 };
    }),
    benches: benchesFor("schluter", room, hostBrand),
    xwalls: [], corners: [], drainX: 0, drainY: 0, drainRef: "left", ramp: false, maxIn: false, tileT: 0,
    pick: null,
    manual: mergeManual(cfg.manual || [], incoming, (r) => r.sku),
  };
  delete next.bench;
  const kept = schluterKeptBuild({ mode: "custom", cfg: next }, cat);
  if (!kept) return null;
  return { snap: { mode: "custom", cfg: kept.cfg }, dropped: keptDropped("schluter", cfg, kept.build) };
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
  const rows = ((build && build.lines) || []).map((l) => {
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
  // S-DRY walls need a backer as KERDI does; the wedi bill carries it as a
  // hint, so Compare writes the same $0 note row the Schluter column carries
  if (build && build.hints && build.hints.includes("backer")) rows.push({
    group: "walls", slot: "wallBoard", key: "note|backer", added: false,
    name: "Cement board / drywall substrate", sub: "by others · membrane needs a backer",
    qty: 1, stock: false, noteOnly: true, est: false, retail: 0, builder: 0, cost: 0,
  });
  return rows;
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
 *   cols: { [col]: rows }, plus: { [col]: entries } — each slot row carries
 *   r[col] and r[col + "Plus"] for every column named in `cols`.
 */
export function compareLayout(cols, plus = {}) {
  const keys = Object.keys(cols);
  const pick = (list, slot) => (list || []).filter((r) => r.slot === slot);
  const kitFirst = (rs) => [...rs.filter((r) => !r.added), ...rs.filter((r) => r.added)];
  return GROUPS.map((g) => ({
    key: g.key, label: g.label,
    slots: g.slots.map((slot) => {
      const r = { slot, label: SLOT_LABEL[slot] };
      for (const k of keys) { r[k] = kitFirst(pick(cols[k], slot)); r[k + "Plus"] = pick(plus[k], slot); }
      return r;
    }).filter((r) => keys.some((k) => r[k].length || r[k + "Plus"].length)),
  })).filter((g) => g.slots.length);
}

// compareset — the Compare set (ticket 158 Phase 4, ADR 0052): per shower
// (area), at most one kept build per Compare column. Pure and engine-free, so
// the popups import it without pulling either engine onto their path; the
// engine-backed builders live in comparekit.js.
//
// The neutral room both engines speak lives here too (comparekit re-exports
// it): the popups stamp a kept build with the room it was built for, and that
// must be the exact shape Compare compares against.
//   { w, d, curbed, drain: "point"|"offset"|"linear",
//     walls: [{ side: "back"|"left"|"right", on, len, h }], benches: [...] }

export const CELL_KEYS = ["wedi:board", "wedi:membrane", "schluter:board", "schluter:membrane"];

const obj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const plainBench = (b) => { const { id, ...rest } = b || {}; return rest; };

export function neutralRoomSchluter(cfg) {
  cfg = cfg || {};
  const benches = Array.isArray(cfg.benches) ? cfg.benches
    : cfg.bench === "framed" ? [{ kind: "wall", side: "back", build: "framed" }]
      : cfg.bench === "buildup" ? [{ kind: "wall", side: "back", build: "site" }] : [];
  return {
    w: +cfg.w || 0, d: +cfg.d || 0,
    curbed: !!cfg.curbed,
    drain: cfg.drain || "point",
    walls: (cfg.walls || []).map((w) => ({
      side: String(w.name || "").toLowerCase(), on: !!w.on, len: +w.len || 0, h: +w.h || 84,
    })),
    benches: benches.map(plainBench),
  };
}

// A Kits-tab pick never ran the solver — kitFor stamps `solve: null` — so the
// pan is the only record of its curb and drain; `panOf(key)` is the engine's
// item lookup, handed in so this module stays engine-free.
export function neutralRoomWedi(cfg, panOf) {
  cfg = cfg || {};
  const input = (cfg.solve && cfg.solve.input) || null;
  const pan = input ? null : (cfg.panKey && panOf ? panOf(cfg.panKey) : null);
  const dr = input ? input.drain : (pan && pan.drain && pan.drain.type);
  return {
    w: (cfg.room && +cfg.room.w) || 0, d: (cfg.room && +cfg.room.d) || 0,
    curbed: input ? input.curb !== "curbless" : !(pan && pan.sub === "curbless"),
    drain: dr === "offset" ? "offset" : dr === "linear" ? "linear" : "point",
    // a wedi cfg lists only the walls that are standing
    walls: (cfg.walls || []).map((w) => ({ side: w.side, on: true, len: +w.len || 0, h: +w.h || 84 })),
    benches: (cfg.benches || []).map(plainBench),
  };
}

const normTarget = (t) => {
  if (!obj(t)) return undefined;
  const areaId = typeof t.areaId === "string" ? t.areaId.trim() : "";
  const rowId = typeof t.rowId === "string" ? t.rowId.trim() : "";
  if (!areaId || !rowId) return undefined;
  return { areaId, rowId, kitId: typeof t.kitId === "string" ? t.kitId : "" };
};

const normEntry = (e) => {
  if (!obj(e) || !obj(e.snap) || !obj(e.snap.cfg)) return null;
  const out = {
    snap: { mode: typeof e.snap.mode === "string" ? e.snap.mode : "custom", cfg: e.snap.cfg },
    room: obj(e.room) ? e.room : null,
    savedAt: +e.savedAt || 0,
    savedBy: typeof e.savedBy === "string" ? e.savedBy : "",
  };
  const target = normTarget(e.target);
  if (target) out.target = target;
  const dropped = Array.isArray(e.dropped) ? e.dropped.filter((s) => typeof s === "string" && s) : [];
  if (dropped.length) out.dropped = dropped;
  return out;
};

export function normCompareSets(v, areaIds) {
  if (!obj(v)) return {};
  const keep = Array.isArray(areaIds) ? new Set(areaIds) : null;
  const out = {};
  for (const [aid, set] of Object.entries(v)) {
    if ((keep && !keep.has(aid)) || !obj(set)) continue;
    const cells = {};
    for (const k of CELL_KEYS) {
      const e = normEntry(set[k]);
      if (e) cells[k] = e;
    }
    if (Object.keys(cells).length) out[aid] = cells;
  }
  return out;
}

export function entryOf({ snap, room, target, savedBy, now, dropped }) {
  return normEntry({ snap, room, target, dropped, savedBy: savedBy || "", savedAt: now || Date.now() });
}

const n = (v) => Math.round((+v || 0) * 100) / 100;
const wallSig = (w) => [w.side, !!w.on, n(w.len), n(w.h)].join(":");
// A bench compares by WHERE it sits only: each engine normalizes its own
// dims and build (wedi fills len/depth/h, a crossed premade becomes a site
// build), so the same bench seen from the other brand must not read as a
// room change.
const benchSig = (b) => (b.kind === "corner" ? "corner:" + (b.corner || "bl") : "wall:" + (b.side || "left"));
const roomSig = (r) => [
  n(r.w), n(r.d), !!r.curbed, r.drain || "point",
  (r.walls || []).map(wallSig).sort().join("|"),
  (r.benches || []).map(benchSig).sort().join("|"),
].join("#");

export const roomChanged = (a, b) => !a || !b || roomSig(a) !== roomSig(b);
export const sizeChanged = (a, b) => !a || !b || n(a.w) !== n(b.w) || n(a.d) !== n(b.d);
export const roomLabel = (r) => n(r && r.w) + "×" + n(r && r.d);

export function saveEntry(sets, areaId, cellKey, entry) {
  return { ...(sets || {}), [areaId]: { ...((sets || {})[areaId] || {}), [cellKey]: entry } };
}

export function clearSet(sets, areaId, keepKey) {
  const cur = (sets || {})[areaId] || {};
  const rest = { ...(sets || {}) };
  delete rest[areaId];
  return keepKey && cur[keepKey] ? { ...rest, [areaId]: { [keepKey]: cur[keepKey] } } : rest;
}

export const resumeChoices = (areaSet, brand) => CELL_KEYS
  .filter((k) => k.startsWith(brand + ":") && areaSet && areaSet[k])
  .map((k) => ({ key: k, entry: areaSet[k] }))
  .sort((a, b) => b.entry.savedAt - a.entry.savedAt);

export const isMarkerSeed = (seed) => !!(seed && obj(seed.cfg) && (seed.cfg.panKey || (+seed.cfg.w > 0 && +seed.cfg.d > 0)));

export function mergeManual(own, incoming, keyOf) {
  const seen = new Set((own || []).map(keyOf));
  return [...(own || []), ...(incoming || []).filter((r) => !seen.has(keyOf(r)))];
}

export function savedAgo(at, now = Date.now()) {
  const m = Math.max(0, Math.round((now - (+at || 0)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + (h === 1 ? " hr ago" : " hrs ago");
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : d + " days ago";
}

// A key-order-free signature — the stored record comes back from jsonb with
// its keys reordered, and "nothing changed" must still read as nothing.
const stable = (v) => (Array.isArray(v) ? "[" + v.map(stable).join(",") + "]"
  : v && typeof v === "object" ? "{" + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}"
    : JSON.stringify(v === undefined ? null : v));
export const entrySig = (e) => stable([e && e.snap, e && e.room, (e && e.target) || null]);

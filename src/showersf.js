// Tile sq ft for each piece of a placed shower, read off its saved cfg
// (spec 2026-09-23). LAZY-CHUNK-ONLY — imports both configurator engines;
// only usejobshowers.js may load it, via import().
// Known limitation: wedi sizes come from whichever catalog is installed — the
// transcribed fallback until a wedi popup installs the live book this session.
import { item, normBench, curbRuns, curbWidth, curbInsets, expandWallFaces, panRoomDims } from "./wedi.js";
import { classify, cfgBenches, wallArea } from "./schluter.js";
import { schluterCurb } from "./schluterdraw.js";
import { curbHeight, benchFootprint } from "./showerdraw.js";
import { PIECES } from "./sfparts.js";
import { placedKits } from "./model.js";

const sf1 = (sqin) => Math.round((sqin / 144) * 10) / 10;

// sq: square inches per piece; 0/undefined = the shower has none (omitted),
// null = it has one we can't measure (shown as "enter manually").
const assemble = (sq) => PIECES
  .filter((d) => sq[d.piece] === null || sq[d.piece] > 0)
  .map((d) => ({ ...d, sf: sq[d.piece] === null ? null : sf1(sq[d.piece]) }));

// Bench faces count as wall tile (owner, 2026-09-23); a suspended bench shows
// its slab edge, not its height off the floor.
function benchSq(benches) {
  let face = 0, top = 0;
  benches.forEach((b) => {
    const rise = b.suspended ? b.thick : b.h;
    if (b.kind === "corner") { face += Math.hypot(b.size, b.size) * rise; top += (b.size * b.size) / 2; }
    else { face += b.len * rise; top += b.len * b.depth; }
  });
  return { face, top };
}

function clipArea(pts, r) {
  const edges = [
    [(p) => p[0] >= r.x0, (a, b) => [r.x0, a[1] + (b[1] - a[1]) * (r.x0 - a[0]) / (b[0] - a[0])]],
    [(p) => p[0] <= r.x1, (a, b) => [r.x1, a[1] + (b[1] - a[1]) * (r.x1 - a[0]) / (b[0] - a[0])]],
    [(p) => p[1] >= r.y0, (a, b) => [a[0] + (b[0] - a[0]) * (r.y0 - a[1]) / (b[1] - a[1]), r.y0]],
    [(p) => p[1] <= r.y1, (a, b) => [a[0] + (b[0] - a[0]) * (r.y1 - a[1]) / (b[1] - a[1]), r.y1]],
  ];
  for (const [inside, cut] of edges) {
    const out = [];
    pts.forEach((b, i) => {
      const a = pts[(i + pts.length - 1) % pts.length];
      if (inside(b)) { if (!inside(a)) out.push(cut(a, b)); out.push(b); }
      else if (inside(a)) out.push(cut(a, b));
    });
    pts = out;
    if (!pts.length) return 0;
  }
  return Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
}

function footprintPts(b, room) {
  const f = benchFootprint(b, room);
  if (f.kind === "rect") return [[f.x, f.y], [f.x + f.w, f.y], [f.x + f.w, f.y + f.d], [f.x, f.y + f.d]];
  const x = f.corner === "bl" || f.corner === "fl" ? 0 : room.w, sx = x ? -1 : 1;
  const y = f.corner === "bl" || f.corner === "br" ? 0 : room.d, sy = y ? -1 : 1;
  return [[x, y], [x + sx * f.a, y], [x, y + sy * f.a]];
}

// Only a suspended bench leaves floor tile under it (owner, 2026-09-23). A
// framed bench gives up its whole strip, as the configurator's cut or smaller
// pan does (benchPanRoom / benchTrayRoom); the rest sit on the pan, so only
// their footprint comes off. `r` is the tiled floor in room coords.
function floorSq(room, r, benches) {
  r = { ...r };
  benches.forEach((b) => {
    if (b.kind !== "wall" || b.build !== "framed") return;
    if (b.side === "back") r.y0 += b.depth; else if (b.side === "left") r.x0 += b.depth; else r.x1 -= b.depth;
  });
  if (!(r.x1 > r.x0 && r.y1 > r.y0)) return 0;
  const covered = benches.filter((b) => !b.suspended && b.build !== "framed")
    .reduce((s, b) => s + clipArea(footprintPts(b, room), r), 0);
  return Math.max(0, (r.x1 - r.x0) * (r.y1 - r.y0) - covered);
}

// The pricelist sizes a niche by its exterior; the tiled back is the
// interior (4" flange rule when the name doesn't spell it out).
function wediNicheSq(key) {
  const it = item(key);
  if (!it || it.group !== "niche") return 0;
  const m = String(it.sizeText || "").match(/interior ([\d.]+)" x ([\d.]+)"/);
  if (m) return +m[1] * +m[2];
  return it.w > 4 && it.d > 4 ? (it.w - 4) * (it.d - 4) : null;
}

export function wediPieces(cfg) {
  const pan = cfg && cfg.panKey ? item(cfg.panKey) : null;
  if (!pan) return null;
  const room = cfg.room ? { w: +cfg.room.w || 0, d: +cfg.room.d || 0 } : panRoomDims(pan);
  const walls = cfg.walls || [];
  const benches = (cfg.benches || []).map((b) => normBench(b, room));
  const bs = benchSq(benches);
  const inset = cfg.maxIn && cfg.curbKey ? curbInsets(room, walls, cfg.curbKey, cfg.tileT) : null;
  const floor = floorSq(room, inset
    ? { x0: inset.left, y0: inset.back, x1: room.w - inset.right, y1: room.d - inset.entry }
    : { x0: 0, y0: 0, x1: room.w, y1: room.d }, benches);
  const c = cfg.curbKey ? item(cfg.curbKey) : null;
  const curb = !cfg.curbKey ? 0
    : c ? curbRuns(room, walls, cfg.corners, benches).openLen * (curbWidth(c) + 2 * curbHeight(c)) : null;
  let niche = 0;
  for (const a of cfg.addons || []) {
    const s = wediNicheSq(typeof a === "string" ? a : a && a.key);
    niche = niche === null || s === null ? null : niche + s;
  }
  return {
    w: room.w, d: room.d, curbed: !!cfg.curbKey,
    pieces: assemble({
      walls: expandWallFaces(walls).reduce((s, w) => s + (+w.len || 0) * (+w.h || 0), 0) + bs.face,
      floor, curb, niche, benchTop: bs.top,
    }),
  };
}

export function schluterPieces(cfg) {
  if (!cfg || !(cfg.w > 0 && cfg.d > 0)) return null;
  const parts = (cfg.benches || []).filter((b) => b && b.part).map((b) => classify({ sku: b.part }));
  const benches = cfgBenches(cfg, parts);
  const bs = benchSq(benches);
  const c = schluterCurb(cfg, benches);
  const run = c.segs.reduce((s, x) => s + x.len, 0) + c.diags.reduce((s, x) => s + x.cut, 0);
  let niche = 0;
  // KERDI-BOARD-SN codes carry the interior in mm: KB12SN<w><h>…
  for (const m of cfg.manual || []) {
    const hit = /SN(\d{3})(\d{3})/.exec(m && m.sku || "");
    if (hit && classify({ sku: m.sku }).extra === "niche") niche += Math.round(+hit[1] / 25.4) * Math.round(+hit[2] / 25.4) * (+m.qty || 1);
  }
  return {
    w: +cfg.w, d: +cfg.d, curbed: cfg.curbed !== false,
    pieces: assemble({
      walls: wallArea(cfg) * 144 + bs.face,
      floor: floorSq({ w: +cfg.w, d: +cfg.d }, { x0: 0, y0: 0, x1: +cfg.w, y1: +cfg.d }, benches),
      curb: c.h > 0 ? run * (c.w + 2 * c.h) : 0,
      niche, benchTop: bs.top,
    }),
  };
}

const PIECES_FOR = { wedi: wediPieces, schluter: schluterPieces };

export function jobShowers(categories) {
  const out = [];
  for (const vendor of ["wedi", "schluter"]) {
    for (const k of placedKits(categories, vendor)) {
      let r = null;
      try { r = PIECES_FOR[vendor](k.marker.cfg); } catch { r = null; }   // a junk saved cfg must not break the grid
      const key = k.kitId || "row:" + k.rowId;
      // Still listed, so rows linked to it don't read "shower was removed".
      if (!r) { out.push({ key, vendor, areaName: k.areaName, size: "", curbed: false, pieces: [], unmeasured: true }); continue; }
      out.push({ key, vendor, areaName: k.areaName, size: `${r.w}×${r.d}`, curbed: r.curbed, pieces: r.pieces });
    }
  }
  return out;
}

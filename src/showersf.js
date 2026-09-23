// Tile sq ft for each piece of a placed shower, read off its saved cfg
// (spec 2026-09-23). LAZY-CHUNK-ONLY — imports both configurator engines;
// only usejobshowers.js may load it, via import().
import { item, normBench, curbRuns, curbWidth, curbInsets, expandWallFaces, panRoomDims } from "./wedi.js";
import { classify, cfgBenches, wallArea } from "./schluter.js";
import { schluterCurb } from "./schluterdraw.js";
import { curbHeight } from "./showerdraw.js";
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
  const floor = (room.w - (inset ? inset.left + inset.right : 0)) * (room.d - (inset ? inset.back + inset.entry : 0));
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
      floor: cfg.w * cfg.d,
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
      if (!r) continue;
      out.push({ key: k.kitId || "row:" + k.rowId, vendor, areaName: k.areaName, size: `${r.w}×${r.d}`, curbed: r.curbed, pieces: r.pieces });
    }
  }
  return out;
}

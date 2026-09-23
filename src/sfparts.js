// A row's sq ft built from placed-shower pieces + named extra spaces
// (spec 2026-09-23). Boot-safe: never import the configurator engines here.
import { num } from "./catalog.js";

export const PIECES = [
  { piece: "walls", label: "Walls (incl. bench faces)" },
  { piece: "floor", label: "Floor" },
  { piece: "curb", label: "Curb top + faces" },
  { piece: "niche", label: "Niche back" },
  { piece: "benchTop", label: "Bench top" },
];
const PIECE_IDS = PIECES.map((x) => x.piece);
const SHORT = { walls: "walls", floor: "floor", curb: "curb", niche: "niche", benchTop: "bench top" };

const r1 = (n) => Math.round(n * 10) / 10;
export const fmtSf = (n) => String(r1(+n || 0));

export function normSfParts(list) {
  if (!Array.isArray(list)) return undefined;
  const out = list.map((e) => {
    if (!e || typeof e !== "object" || e.sf === "" || !Number.isFinite(+e.sf)) return null;
    const sf = +e.sf;
    if (e.kind === "shower") {
      if (typeof e.kitId !== "string" || !e.kitId || !PIECE_IDS.includes(e.piece)) return null;
      return { kind: "shower", kitId: e.kitId, piece: e.piece, where: typeof e.where === "string" ? e.where : "", sf };
    }
    return { kind: "extra", label: typeof e.label === "string" ? e.label.trim() : "", sf };
  }).filter(Boolean);
  return out.length ? out : undefined;
}

export const sfPartsTotal = (parts) => r1((parts || []).reduce((s, e) => s + (+e.sf || 0), 0));

const isPiece = (e, kitId, piece) => e.kind === "shower" && e.kitId === kitId && e.piece === piece;

export function togglePiece(parts, shower, pc) {
  const list = parts || [];
  if (list.some((e) => isPiece(e, shower.key, pc.piece))) return list.filter((e) => !isPiece(e, shower.key, pc.piece));
  return [...list, { kind: "shower", kitId: shower.key, piece: pc.piece, where: shower.areaName, sf: pc.sf }];
}

export const addExtra = (parts, label, sf) => [...(parts || []), { kind: "extra", label: String(label || "").trim(), sf: +sf || 0 }];
export const removeAt = (parts, i) => (parts || []).filter((_, j) => j !== i);

export const sfPatch = (next) => (next.length
  ? { sfParts: next, qty: String(sfPartsTotal(next)) }
  : { sfParts: undefined, qty: "" });

// A piece whose shower is gone, or can no longer be measured, keeps its last
// saved sf: the row's number must never quietly drop.
export function sfPartsState(p, showers) {
  const parts = p && p.sfParts;
  if (!parts || !parts.length) return null;
  const byKey = new Map((showers || []).map((s) => [s.key, s]));
  const gone = [];
  const fresh = parts.map((e) => {
    if (e.kind !== "shower") return e;
    const s = byKey.get(e.kitId);
    if (!s) { gone.push(e); return e; }
    const pc = s.pieces.find((x) => x.piece === e.piece);
    return pc && pc.sf != null ? { ...e, sf: pc.sf } : e;
  });
  const live = sfPartsTotal(fresh), have = r1(num(p.qty));
  return { fresh, gone, live, have, changed: live !== sfPartsTotal(parts), drift: live !== have ? { auto: live, have } : null };
}

export function sfPartsText(parts) {
  let where = null;
  return (parts || []).map((e) => {
    if (e.kind !== "shower") { where = null; return `${e.label || "Extra"} ${fmtSf(e.sf)}`; }
    const head = e.where !== where ? `${e.where || "Shower"}: ` : "";
    where = e.where;
    return `${head}${SHORT[e.piece]} ${fmtSf(e.sf)}`;
  }).join(" · ");
}

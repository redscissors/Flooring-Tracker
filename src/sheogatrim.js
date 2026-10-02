// Sheoga trim & accessories — distributor accessory price sheet parser + diff.
// The sheet is laid out as side-by-side blocks, so the parser scans for block
// headers by text instead of indexing columns; Plugs are never read.

import { sellOf, TEXTURES, STAIN_COLORS, LIVE_SAWN_SP } from "./sheoga.js";

export const TRIM_PROFILES = [
  { id: "nose35", name: 'Rabbeted nosing 3½"', short: 'Nosing 3½"', size: '3½"' },
  { id: "nose55", name: 'Rabbeted nosing 5½"', short: 'Nosing 5½"', size: '5½"' },
  { id: "shoe", name: 'Shoe mold ½" × ¾"', short: "Shoe mold", size: '½" × ¾"' },
  { id: "reducer", name: 'Reducer ¾" × 2½"', short: "Reducer", size: '¾" × 2½"', fixedLen: 8 },
  { id: "tmold", name: 'T-mold ¾" × 2½"', short: "T-mold", size: '¾" × 2½"', fixedLen: 8 },
];
export const TRIM_SPECIES = ["Beech", "Cherry", "Maple", "Hickory", "Red Oak", "White Oak", "Walnut", "Q/R White Oak"];

const NOT_SHEET = "Not Sheoga's accessory pricing sheet";
const BLOCKS = [
  { header: "rabbeted nosing", label: "Nosing", ids: ["nose35", "nose55"] },
  { header: "shoe mold", label: "Shoe mold", ids: ["shoe"] },
  { header: "reducer", label: "Reducer", ids: ["reducer"] },
  { header: "t-mold", label: "T-mold", ids: ["tmold"] },
];

const text = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const key = (v) => text(v).replace(/[\s/]/g, "").toLowerCase();
const price = (v) => (typeof v === "number" && v > 0 ? v : null);
const short = (id) => TRIM_PROFILES.find((p) => p.id === id).short;
const SPECIES_BY_KEY = Object.fromEntries(TRIM_SPECIES.map((s) => [key(s), s]));

const findCell = (rows, test, from = 0) => {
  for (let r = from; r < rows.length; r++)
    for (let c = 0; c < (rows[r] || []).length; c++) if (test(rows[r][c])) return [r, c];
  return null;
};

const isTitle = (v) => /sheoga accessory pricing/i.test(text(v));
const accessoryRows = (sheets) => (sheets.find((s) => findCell(s.rows, isTitle)) || {}).rows || null;
export const isSheogaAccessorySheet = (sheets) => !!accessoryRows(sheets);

function sheetDateOf(rows) {
  const at = findCell(rows, (v) => text(v).toUpperCase() === "UPDATED");
  if (!at) return "";
  for (let r = at[0] + 1; r < rows.length; r++) {
    const v = (rows[r] || [])[at[1]];
    if (v == null || v === "") continue;
    let d = null;
    if (typeof v === "number") d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    else {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text(v));
      if (m) d = new Date(Date.UTC(+m[3], +m[1] - 1, +m[2]));
    }
    return d && !isNaN(d) ? d.toISOString().slice(0, 10) : "";
  }
  return "";
}

export function parseAccessorySheet(sheets) {
  const rows = accessoryRows(sheets);
  if (!rows) return { sheet: null, problems: [NOT_SHEET] };
  const problems = [];
  const species = Object.fromEntries(TRIM_SPECIES.map((s) => [s, {}]));
  const prefin = {};

  for (const blk of BLOCKS) {
    const head = findCell(rows, (v) => text(v).toLowerCase() === blk.header);
    const sub = head && (rows[head[0] + 1] || [])[head[1]];
    if (!head || key(sub) !== "species") {
      problems.push(`${blk.label} block not found`);
      continue;
    }
    const [hr, hc] = head;
    const cols = {};
    if (blk.ids.length === 1) cols[blk.ids[0]] = hc + 1;
    else {
      for (const c of [hc + 1, hc + 2]) {
        const t = text(rows[hr + 1][c]);
        if (t.includes("3 1/2")) cols.nose35 = c;
        else if (t.includes("5 1/2")) cols.nose55 = c;
      }
      const lost = blk.ids.filter((id) => cols[id] == null);
      if (lost.length) {
        problems.push(...lost.map((id) => `${short(id)} column not found`));
        continue;
      }
    }

    const seen = new Set();
    let r = hr + 2;
    for (; r < rows.length; r++) {
      const name = text((rows[r] || [])[hc]);
      if (!name || /^prefinished charge$/i.test(name)) break;
      const sp = SPECIES_BY_KEY[key(name)];
      if (!sp) continue;
      seen.add(sp);
      for (const id of blk.ids) species[sp][id] = price(rows[r][cols[id]]);
    }
    while (r < rows.length && !text((rows[r] || [])[hc])) r++;
    if (/^prefinished charge$/i.test(text((rows[r] || [])[hc])))
      for (const id of blk.ids) prefin[id] = price(rows[r][cols[id]]);
    for (const sp of TRIM_SPECIES)
      for (const id of blk.ids)
        if (!seen.has(sp) || species[sp][id] == null) problems.push(`${sp} — ${short(id)} price missing`);
    for (const id of blk.ids)
      if (prefin[id] == null) problems.push(`Prefinished — ${short(id)} charge missing`);
  }

  let slip = { perLf: null, bundleLf: 50 };
  const at = findCell(rows, (v) => text(v).toLowerCase() === "slip tongue");
  if (at) {
    const row = rows[at[0]];
    slip = { perLf: price(row[at[1] + 1]), bundleLf: +(/(\d+)\s*LF/i.exec(text(row[at[1] + 2])) || [, 50])[1] };
  }
  if (slip.perLf == null) problems.push("Slip tongue price missing");

  if (problems.length) return { sheet: null, problems };
  return { sheet: { sheetDate: sheetDateOf(rows), species, prefin, slip }, problems: [] };
}

export function diffAccessorySheets(prev, next) {
  if (!prev) return [];
  const out = [];
  const cmp = (label, from, to) => { if (from !== to) out.push({ label, from, to }); };
  for (const sp of TRIM_SPECIES)
    for (const p of TRIM_PROFILES) cmp(`${sp} — ${p.short}`, prev.species[sp]?.[p.id], next.species[sp]?.[p.id]);
  for (const p of TRIM_PROFILES) cmp(`Prefinished — ${p.short}`, prev.prefin[p.id], next.prefin[p.id]);
  cmp("Slip tongue", prev.slip.perLf, next.slip.perLf);
  return out;
}

// --- pricing ------------------------------------------------------------------

export const TRIM_LENGTHS = [3, 4, 5, 6, 7, 8, 9, 10, 12];
export const DEFAULT_TRIM_MARKUP = 100;

const round2 = (n) => Math.round(n * 100) / 100;
const money = (n) => "$" + n.toFixed(2);
const RUN_IDS = ["nose35", "nose55", "shoe"];
const FIXED_IDS = ["reducer", "tmold"];
const norm = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();
const count = (n) => Math.max(0, Math.floor(Number(n) || 0));
const runLen = (len) => (len === "rl" ? "rl" : TRIM_LENGTHS.includes(Number(len)) ? Number(len) : 8);
const texPrice = (v) => (v == null || v === "" || !isFinite(Number(v)) ? null : Number(v));

const TRIM_SP_MAP = { [LIVE_SAWN_SP]: "White Oak" };
const trimSp = (sp) => {
  const mapped = TRIM_SP_MAP[sp] || sp;
  return TRIM_SPECIES.includes(mapped) ? { sp: mapped } : {};
};

// "Match floor" — the finish a trim kit needs to look like the floor being
// quoted, mapped from a floor / stocked / herringbone configuration.
export function trimFromFloor(snap) {
  if (!snap || !snap.cfg) return null;
  const f = snap.cfg;
  const out = trimSp(f.sp);
  const sheen = String(f.sheen ?? "30");
  if (snap.mode === "stocked") {
    const [color, texName] = String(f.color || "").split(" · ");
    const tex = texName ? TEXTURES.find((t) => norm(t.name) === norm(texName)) : null;
    return { ...out, prefin: true, stain: color || "", stainCustom: false, sheen, tex: tex ? tex.id : "smooth" };
  }
  if (snap.mode !== "floor" && snap.mode !== "hb") return null;
  const prefin = !!f.finish && f.finish !== "unf";
  const stain = !prefin ? "" : f.finish === "nat" ? "Natural" : String(f.stain || "").trim();
  return { ...out, prefin, stain, stainCustom: !!stain && !STAIN_COLORS.includes(stain), sheen, tex: f.tex || "smooth" };
}

export function effectiveTrimCfg(cfg, floorSnap) {
  const patch = cfg.match ? trimFromFloor(floorSnap) : null;
  return { ...cfg, ...(patch || {}), match: false };
}

export function calcTrim(cfg, trimBook) {
  const sheet = trimBook?.sheet;
  if (!sheet || !cfg) return null;
  const prices = sheet.species[cfg.sp];
  if (!prices) return null;
  const texture = TEXTURES.find((t) => t.id === cfg.tex) || TEXTURES[0];
  const textured = texture.id !== "smooth";
  const texName = texture.name.replace(" (standard)", "");
  const finishText = [
    cfg.prefin ? `Prefinished${cfg.stain ? " " + cfg.stain : ""} · ${cfg.sheen} sheen` : "Unfinished",
    ...(textured ? [texName] : []),
  ].join(" · ");

  const lines = [];
  let texBlocked = false;
  const pushLine = (id, qty, len) => {
    const profile = TRIM_PROFILES.find((p) => p.id === id);
    const add = textured ? texPrice(trimBook.tex?.[id]) : 0;
    const blocked = textured && add == null;
    if (blocked) texBlocked = true;
    const charge = cfg.prefin ? sheet.prefin[id] : 0;
    const lfCost = round2(prices[id] + charge + (add || 0));
    const unitCost = len === "rl" ? lfCost : round2(lfCost * len);
    const rows = [[cfg.sp, money(prices[id]) + " /lf"]];
    if (cfg.prefin) rows.push(["Prefinished charge", "+" + money(charge) + " /lf"]);
    if (textured) rows.push([`Textured — ${texName}`, blocked ? "not set" : "+" + money(add) + " /lf"]);
    const lenText = len === "rl" ? "random lengths" : `${len}' pcs`;
    lines.push({
      key: `${id}-${lines.length}`, profile: id, unit: len === "rl" ? "lf" : "pc", qty, len, unitCost, lfCost,
      sizeText: profile.size,
      desc: [profile.name, lenText, cfg.sp, finishText].join(" · "),
      qtyText: len === "rl" ? `${qty} lf` : `${qty} pc${qty === 1 ? "" : "s"}`,
      rows,
    });
  };

  for (const id of TRIM_PROFILES.map((p) => p.id)) {
    if (RUN_IDS.includes(id))
      for (const r of (cfg.runs || {})[id] || []) {
        const qty = count(r.n);
        if (qty) pushLine(id, qty, runLen(r.len));
      }
    else if (FIXED_IDS.includes(id) && count(cfg[id])) pushLine(id, count(cfg[id]), 8);
  }

  const bundles = count(cfg.slip);
  if (bundles) {
    const { perLf, bundleLf } = sheet.slip;
    const unitCost = round2(perLf * bundleLf);
    lines.push({
      key: "slip", profile: "slip", unit: "bdl", qty: bundles, len: null, unitCost, lfCost: perLf,
      sizeText: "", desc: `Slip tongue · ${bundleLf} lf bundle`,
      qtyText: `${bundles} bundle${bundles === 1 ? "" : "s"}`,
      rows: [[`${bundleLf} lf bundle`, money(perLf) + " /lf"]],
    });
  }

  return {
    sp: cfg.sp, finishText, texName, texBlocked,
    costTotal: round2(lines.reduce((t, l) => t + l.unitCost * l.qty, 0)),
    lines,
  };
}

const SELL_UNIT = { pc: "PC", lf: "LF", bdl: "BDL" };

export function trimLineItems(cfg, trimBook, markupPct = DEFAULT_TRIM_MARKUP) {
  const b = calcTrim(cfg, trimBook);
  if (!b || b.texBlocked) return [];
  return b.lines.map((l, i) => ({
    type: "hardwood", sku: "", sizeText: l.sizeText, brandColor: "Sheoga " + l.desc,
    qtyType: "count", qty: String(l.qty), sellUnit: SELL_UNIT[l.unit],
    priceSqft: String(sellOf(l.unitCost, markupPct)), costSqft: String(round2(l.unitCost)), markupPct: String(markupPct),
    sheoga: i === 0
      ? { mode: "trim", cfg: JSON.parse(JSON.stringify({ ...cfg, match: false })) }
      : { mode: "trim", part: true },
  }));
}

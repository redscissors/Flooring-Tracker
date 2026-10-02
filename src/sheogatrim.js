// Sheoga trim & accessories — distributor accessory price sheet parser + diff.
// The sheet is laid out as side-by-side blocks, so the parser scans for block
// headers by text instead of indexing columns; Plugs are never read.

import { sellOf, TEXTURES, STAIN_COLORS, LIVE_SAWN_SP } from "./sheoga.js";

export const TRIM_PROFILES = [
  { id: "nose35", name: 'Stair nose 3½"', label: "Stair nose", short: 'Stair nose 3½"', width: '3½"' },
  { id: "nose55", name: 'Stair nose 5½"', label: "Stair nose", short: 'Stair nose 5½"', width: '5½"' },
  { id: "shoe", name: 'Shoe mold ½"×¾"', label: "Shoe mold", short: "Shoe mold", width: '½"×¾"' },
  { id: "reducer", name: 'Reducer 2½"', label: "Reducer", short: "Reducer", width: '2½"', fixedLen: 8 },
  { id: "tmold", name: 'T-mold 2½"', label: "T-mold", short: "T-mold", width: '2½"', fixedLen: 8 },
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
// The title sits on row ~11; a dropped workbook is never walked past its top.
const TITLE_ROWS = 15;
const accessoryRows = (sheets) => (sheets.find((s) => findCell((s.rows || []).slice(0, TITLE_ROWS), isTitle)) || {}).rows || null;
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
  const tex = Object.fromEntries(TRIM_PROFILES.map((p) => [p.id, null]));

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
    const nextLabel = () => {
      while (r < rows.length && !text((rows[r] || [])[hc])) r++;
      return text((rows[r] || [])[hc]);
    };
    if (/^prefinished charge$/i.test(nextLabel())) {
      for (const id of blk.ids) prefin[id] = price(rows[r][cols[id]]);
      r++;
      if (/^texture charge$/i.test(nextLabel()))
        for (const id of blk.ids) tex[id] = price(rows[r][cols[id]]);
    }
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
  return { sheet: { sheetDate: sheetDateOf(rows), species, prefin, tex, slip }, problems: [] };
}

export function diffAccessorySheets(prev, next) {
  if (!prev) return [];
  const out = [];
  const cmp = (label, from, to) => { if (from !== to) out.push({ label, from, to }); };
  for (const sp of TRIM_SPECIES)
    for (const p of TRIM_PROFILES) cmp(`${sp} — ${p.short}`, prev.species[sp]?.[p.id], next.species[sp]?.[p.id]);
  for (const p of TRIM_PROFILES) cmp(`Prefinished — ${p.short}`, prev.prefin[p.id], next.prefin[p.id]);
  for (const p of TRIM_PROFILES) cmp(`Textured — ${p.short}`, prev.tex?.[p.id] ?? null, next.tex?.[p.id] ?? null);
  cmp("Slip tongue", prev.slip.perLf, next.slip.perLf);
  cmp("Slip tongue bundle", prev.slip.bundleLf, next.slip.bundleLf);
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
    return { ...out, prefin: true, stain: color || "", stainCustom: false, sheen, sheenCustom: !!f.sheenCustom, tex: tex ? tex.id : "smooth" };
  }
  if (snap.mode !== "floor" && snap.mode !== "hb") return null;
  const prefin = !!f.finish && f.finish !== "unf";
  const stain = !prefin ? "" : f.finish === "nat" ? "Natural" : String(f.stain || "").trim();
  return { ...out, prefin, stain, stainCustom: !!stain && !STAIN_COLORS.includes(stain), sheen, sheenCustom: !!f.sheenCustom, tex: f.tex || "smooth" };
}

export function effectiveTrimCfg(cfg, floorSnap) {
  const patch = cfg.match ? trimFromFloor(floorSnap) : null;
  return { ...cfg, ...(patch || {}), match: false };
}

const textureOf = (cfg) => TEXTURES.find((t) => t.id === cfg.tex) || TEXTURES[0];

// Per-lf cost of every profile for one trim cfg, plus slip tongue — what the
// rail shows before any quantity is typed, and what calcTrim prices lines from.
export function trimRates(cfg, trimBook) {
  const sheet = trimBook?.sheet;
  const prices = sheet && cfg ? sheet.species[cfg.sp] : null;
  if (!prices) return null;
  const textured = textureOf(cfg).id !== "smooth";
  const out = {};
  for (const { id } of TRIM_PROFILES) {
    const add = textured ? sheet.tex?.[id] ?? null : null;
    const charge = cfg.prefin ? sheet.prefin[id] : 0;
    out[id] = { base: prices[id], charge, add, lfCost: round2(prices[id] + charge + (add || 0)), textured: add != null, smoothOnly: textured && add == null };
  }
  const { perLf, bundleLf } = sheet.slip;
  out.slip = { lfCost: perLf, bundleLf, unitCost: round2(perLf * bundleLf) };
  return out;
}

export const trimUnitCost = (lfCost, len) => {
  const l = runLen(len);
  return l === "rl" ? lfCost : round2(lfCost * l);
};

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function calcTrim(cfg, trimBook) {
  const rates = trimRates(cfg, trimBook);
  if (!rates) return null;
  const texture = textureOf(cfg);
  const textured = texture.id !== "smooth";
  const texName = texture.name.replace(" (standard)", "");
  const baseFinish = cfg.prefin ? `Prefinished${cfg.stain ? " " + cfg.stain : ""} · ${cfg.sheen} sheen` : "Unfinished";
  const finishText = textured ? `${baseFinish} · ${texName}` : baseFinish;

  const lines = [];
  const pushLine = (id, qty, len) => {
    const profile = TRIM_PROFILES.find((p) => p.id === id);
    const r = rates[id];
    const unitCost = trimUnitCost(r.lfCost, len);
    const rows = [[cfg.sp, money(r.base) + " /lf"]];
    if (cfg.prefin) rows.push(["Prefinished charge", "+" + money(r.charge) + " /lf"]);
    if (r.textured) rows.push([`Textured — ${texName}`, "+" + money(r.add) + " /lf"]);
    else if (textured) rows.push(["Smooth — can't be textured", ""]);
    const lenText = len === "rl" ? "random lengths" : `${len}' pcs`;
    const finish = r.textured ? finishText : baseFinish;
    lines.push({
      key: `${id}-${lines.length}`, profile: id, unit: len === "rl" ? "lf" : "pc", qty, len, unitCost, lfCost: r.lfCost,
      sizeText: `${profile.width}×${len === "rl" ? "RL" : `${len}'`}`,
      textured: r.textured,
      desc: [profile.name, lenText, cfg.sp, finish].join(" · "),
      rest: [profile.label, cfg.sp, finish].join(" · "),
      qtyText: len === "rl" ? `${qty} lf` : plural(qty, "pc"),
      math: len === "rl" ? `${qty} lf · Sheoga picks lengths` : `${plural(qty, "pc")} × ${len}' = ${qty * len} lf`,
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
    const { lfCost: perLf, bundleLf, unitCost } = rates.slip;
    lines.push({
      key: "slip", profile: "slip", unit: "bdl", qty: bundles, len: null, unitCost, lfCost: perLf, textured: false,
      sizeText: "", desc: `Slip tongue · ${bundleLf} lf bundle`, rest: `Slip tongue · ${bundleLf} lf bundle`,
      qtyText: plural(bundles, "bundle"),
      math: `${plural(bundles, "bundle")} = ${bundles * bundleLf} lf`,
      rows: [[`${bundleLf} lf bundle`, money(perLf) + " /lf"]],
    });
  }

  return {
    sp: cfg.sp, finishText, texName,
    costTotal: round2(lines.reduce((t, l) => t + l.unitCost * l.qty, 0)),
    lines,
  };
}

// Total sell of a build through a per-unit sell function (the tier lens).
export const trimSellTotal = (build, sellFn) => round2((build?.lines || []).reduce((t, l) => t + sellFn(l.unitCost) * l.qty, 0));

const SELL_UNIT = { pc: "PC", lf: "LF", bdl: "BDL" };

export function trimLineItems(cfg, trimBook, markupPct = DEFAULT_TRIM_MARKUP) {
  const b = calcTrim(cfg, trimBook);
  if (!b) return [];
  return b.lines.map((l, i) => ({
    type: "hardwood", sku: "", sizeText: l.sizeText, brandColor: "Sheoga " + l.rest,
    qtyType: "count", qty: String(l.qty), sellUnit: SELL_UNIT[l.unit],
    priceSqft: String(sellOf(l.unitCost, markupPct)), costSqft: String(round2(l.unitCost)), markupPct: String(markupPct),
    sheoga: i === 0
      ? { mode: "trim", cfg: JSON.parse(JSON.stringify({ ...cfg, match: false })) }
      : { mode: "trim", part: true },
  }));
}

// A staged or placed trim kit as the basket drawer lists it. Priced off the
// sheet uploaded now; with no sheet it still lists, at 0, so it can be removed.
export function trimEntryView(cfg, trimBook, markupPct, sellFn = (c) => sellOf(c, markupPct)) {
  const title = `Sheoga trim — ${cfg?.sp || ""}`;
  const b = calcTrim(cfg, trimBook);
  if (!b) return { title, meta: "Sheet not uploaded", price: 0, subs: [], fees: [], lines: () => [] };
  return { title, meta: plural(b.lines.length, "line"), price: trimSellTotal(b, sellFn), subs: [], fees: [], lines: () => trimLineItems(cfg, trimBook, markupPct) };
}

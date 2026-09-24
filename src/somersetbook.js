// Parser for the Somerset Hardwood Flooring price sheet Palmer Donavin ships as
// a PDF ("R35", 10/20/2025).
//
// The floor pages are a matrix, not a list: each collection prints a carton
// table (SF/ctn keyed by construction, species, or width), a Solid/Engineered
// band, a width header ("3 1/4" $/SF 4" $/SF …"), then color rows that carry
// only SKUs. A price is a MERGED cell printed once at the vertical middle of
// the rows it covers — $4.35 beside six colors, $4.78 beside one — and a grey
// cell marks a width a color isn't made in. The molding pages repeat per
// collection: a trim-type header, one per-piece price per column, then SKU rows
// by color. Neither shape has a code-first row the generic reader
// (pdfbook.js) can use, so like Mannington (ADR 0012) this is a dedicated
// parser (ADR 0009 §4) emitting the same { name, rows, mapping, warnings }
// contract into the mapped-import wizard.
//
// The Somerset and Palmer Donavin names are logos (images), never text, so the
// sheet is recognized by its carton header plus the warranty line.

import { clusterRows } from "./pdfbook.js";

const BRAND = "Somerset";

const str = (c) => (c == null ? "" : String(c)).replace(/\s+/g, " ").trim();
const num = (c) => { const n = parseFloat(str(c).replace(/[$,]/g, "")); return Number.isFinite(n) ? n : null; };
const cx = (i) => i.x + (i.w || 0) / 2;
const rowText = (r) => [...r.items].sort((a, b) => a.x - b.x).map((i) => str(i.str)).join(" ");
const nearest = (list, x, key = (c) => c.cx) => list.reduce((a, b) => (Math.abs(key(b) - x) < Math.abs(key(a) - x) ? b : a), list[0]);
const money = (n) => `$${n.toFixed(2)}`;

// Random-length codes carry no digit (EPHCABRLE).
const FLOOR_SKU = /^[A-Z][A-Z0-9]{4,13}$/;
const TRIM_SKU = /^[A-Za-z]{3,5}\d[A-Za-z0-9]*$/;
const PRICE = /^\$\d+(?:\.\d+)?$/;
const CONSTRUCTION = /^(solid|engineered)$/i;

// Centered price cells land within a pixel of their run's middle; the next
// candidate split is half a row pitch (~6.5px) away.
const RUN_TOL = 3.5;

export function isSomersetPriceList(pages) {
  for (const page of (pages || []).slice(0, 4)) {
    const items = (page || []).filter((i) => str(i?.str));
    if (!items.some((i) => /Ultimate Finish Warranty/i.test(i.str))) continue;
    if (clusterRows(items).some((r) => /SF\/ctn/.test(rowText(r)) && /Ctn\/Pallet/.test(rowText(r)))) return true;
  }
  return false;
}

// "Random 3" over "1/4,4,5" → Random 3 1/4", 4", 5"
const widthLabel = (s) => {
  const t = str(s);
  if (!/^random/i.test(t)) return t;
  const parts = t.replace(/^random\s*/i, "").split(/\s*,\s*/).filter(Boolean);
  return `Random ${parts.map((p) => `${p.replace(/"$/, "")}"`).join(", ")}`;
};

const speciesName = (s) => str(s).replace(/^Euro WO$/i, "White Oak");

// "Solid - Eased Edge / Square End;" on a two-construction table, else the one
// edge line; the trailing "/ Low Gloss" repeats the title's finish.
function edgeFor(lines, construction) {
  const own = lines.find((l) => new RegExp(`^${construction}\\s*-`, "i").test(l));
  const line = own ? own.replace(/^\w+\s*-\s*/, "") : lines.find((l) => !/^(solid|engineered)\s*-/i.test(l)) || "";
  return line.replace(/;$/, "").replace(/\s*\/\s*(?:low|mid|medium|high) gloss$/i, "").trim();
}

// Does a carton-table label ("Solid RO", "White Oak", "6\" / 7\"", "Random
// Width") apply to this floor? A label only constrains what it names.
function cartonApplies(label, f) {
  const l = label.toLowerCase();
  const built = l.match(/solid|engineered/);
  if (built && built[0] !== f.construction.toLowerCase()) return false;
  const sp = f.species.toLowerCase();
  if (/\bro\b|red oak/.test(l) && /white|hickory/.test(sp)) return false;
  if (/\bwo\b|white oak/.test(l) && /red|hickory/.test(sp)) return false;
  const random = /^random/i.test(f.width);
  if (/random/.test(l)) return random;
  const widths = label.match(/\d+(?: \d\/\d)?"/g);
  if (widths) return !random && widths.includes(f.width);
  return true;
}

// Split the rows holding a SKU in one width column into consecutive runs, one
// per printed price, such that each price sits at the middle of its run. Rows
// are y-sorted; returns a price per row, or null when no split fits.
function priceRuns(rowYs, prices) {
  if (!prices.length || !rowYs.length) return null;
  const ps = [...prices].sort((a, b) => a.y - b.y);
  const solve = (start, k) => {
    const p = ps[k];
    const last = k === ps.length - 1;
    for (let end = start; end < rowYs.length; end++) {
      if (last && end !== rowYs.length - 1) continue;
      if (!last && rowYs.length - end - 1 < ps.length - k - 1) break;
      if (Math.abs((rowYs[start] + rowYs[end]) / 2 - p.y) > RUN_TOL) continue;
      const rest = last ? [] : solve(end + 1, k + 1);
      if (rest) return [...Array(end - start + 1).fill(p.v), ...rest];
    }
    return null;
  };
  return solve(0, 0);
}

function parseFloorSection(items, banner, bottom, warnings) {
  const inSection = items.filter((i) => i.y >= banner.y - 2 && i.y < bottom - 2);
  const rows = clusterRows(inSection);
  const header = rows.find((r) => r.items.some((i) => str(i.str) === "$/SF"));
  if (!header) return [];

  const title = str([...banner.items].sort((a, b) => a.x - b.x)[0].str);
  const parts = title.split(/\s*-\s*/).map(str).filter(Boolean);
  let collection = parts.shift() || title;
  const finish = parts.filter((p) => !CONSTRUCTION.test(p));
  const wire = collection.match(/\s+(Wirebrushed)$/i);
  if (wire) { collection = collection.slice(0, wire.index); finish.unshift(wire[1]); }

  const sfHead = banner.items.find((i) => /^SF\/ctn$/.test(str(i.str)));
  const above = rows.filter((r) => r.y > banner.y + 2 && r.y < header.y - 2);
  const cartons = [];
  const leftLines = [];
  let bandRow = null;
  for (const r of above) {
    const left = r.items.filter((i) => i.x < 250).sort((a, b) => a.x - b.x).map((i) => str(i.str)).join(" ");
    if (left) leftLines.push(left);
    const label = r.items.filter((i) => i.x >= 250 && sfHead && i.x < sfHead.x - 5).map((i) => str(i.str)).join(" ");
    const sf = sfHead && r.items.find((i) => Math.abs(cx(i) - cx(sfHead)) < 20 && num(i.str) != null);
    if (label && sf) cartons.push({ label, sf: num(sf.str) });
    else if (r.items.every((i) => CONSTRUCTION.test(str(i.str)))) bandRow = r;
  }
  const warranty = leftLines.find((l) => /warranty/i.test(l)) || "";
  const edgeLines = leftLines.filter((l) => !/warranty/i.test(l));
  const thick = edgeLines.join(" ").match(/(\d+\/\d+)"\s*Thick/i);
  const bands = (bandRow?.items || []).map((i) => ({ cx: cx(i), name: str(i.str) }));

  const wrapped = rows.filter((r) => r !== header && r.y >= header.y - 15 && r.y < header.y).flatMap((r) => r.items)
    .filter((i) => i.x > 150 && !CONSTRUCTION.test(str(i.str)));
  const cols = header.items.filter((i) => i.x > 150 && str(i.str) !== "$/SF").sort((a, b) => a.x - b.x).map((i) => {
    const lead = wrapped.filter((w) => Math.abs(cx(w) - cx(i)) < 30).map((w) => str(w.str)).join(" ");
    return { cx: cx(i), x: i.x, width: widthLabel([lead, str(i.str)].filter(Boolean).join(" ")) };
  });
  const priceCols = header.items.filter((i) => str(i.str) === "$/SF").map((i) => ({ cx: cx(i), x: i.x }));
  for (const c of cols) {
    c.priceCol = priceCols.filter((p) => p.x > c.x).sort((a, b) => a.x - b.x)[0] || null;
    c.construction = bands.length ? nearest(bands, c.cx).name : "";
  }

  const region = inSection.filter((i) => i.y > header.y + 3);
  const skuItems = region.filter((i) => i.x > 150 && FLOOR_SKU.test(str(i.str)));
  const dataRows = clusterRows(skuItems, 3);
  const speciesLabels = region.filter((i) => i.x < 60 && /[A-Za-z]/.test(str(i.str)));
  const lastPrice = priceCols.length ? Math.max(...priceCols.map((p) => p.x)) : Infinity;
  const gradeBits = region.filter((i) => i.x > lastPrice + 20 && !PRICE.test(str(i.str)) && !FLOOR_SKU.test(str(i.str)))
    .sort((a, b) => a.y - b.y);
  const grades = [];
  for (const g of gradeBits) {
    const prev = grades[grades.length - 1];
    if (prev && g.y - prev.yEnd <= 12) { prev.text += ` ${str(g.str)}`; prev.yEnd = g.y; prev.y = (prev.yStart + g.y) / 2; }
    else grades.push({ text: str(g.str), y: g.y, yStart: g.y, yEnd: g.y });
  }

  const recs = dataRows.map((r) => {
    const onRow = region.filter((i) => Math.abs(i.y - r.y) <= 3);
    const sp = onRow.filter((i) => i.x < 60).map((i) => str(i.str)).join(" ")
      || str(speciesLabels.length ? nearest(speciesLabels, r.y, (i) => i.y).str : "");
    const color = onRow.filter((i) => i.x >= 60 && i.x < 150).sort((a, b) => a.x - b.x).map((i) => str(i.str)).join(" ");
    const grade = grades.length ? nearest(grades, r.y, (g) => g.y).text : "";
    return { y: r.y, species: speciesName(sp), color, grade, skus: r.items.map((i) => ({ sku: str(i.str), col: nearest(cols, cx(i)) })) };
  });

  const out = [];
  for (const col of cols) {
    const colRows = recs.map((rec) => ({ rec, hit: rec.skus.find((s) => s.col === col) })).filter((e) => e.hit);
    if (!colRows.length) continue;
    const prices = col.priceCol
      ? region.filter((i) => PRICE.test(str(i.str)) && nearest(priceCols, cx(i)) === col.priceCol).map((i) => ({ y: i.y, v: num(i.str) }))
      : [];
    const costs = priceRuns(colRows.map((e) => e.rec.y), prices);
    if (!costs) warnings.push(`${collection} ${col.width} ${col.construction}: couldn't tell which rows each printed price covers — ${colRows.map((e) => e.hit.sku).join(", ")} imported without a cost.`);
    colRows.forEach(({ rec, hit }, n) => {
      const f = {
        sku: hit.sku, collection, species: rec.species, color: rec.color, construction: col.construction,
        width: col.width, cost: costs ? costs[n] : null, thickness: thick ? `${thick[1]}"` : "",
        siblings: rec.skus.filter((s) => s !== hit && s.col.construction === col.construction).map((s) => s.sku),
      };
      const fits = cartons.filter((c) => cartonApplies(c.label, f));
      const sfs = [...new Set(fits.map((c) => c.sf))];
      f.sf = sfs.length === 1 ? sfs[0] : null;
      if (f.sf == null) warnings.push(`${hit.sku}: no single SF/ctn in the ${collection} carton table applies — imported without carton coverage.`);
      f.note = [finish.join(", "), edgeFor(edgeLines, f.construction), warranty, rec.grade].filter(Boolean).join(" · ");
      out.push(f);
    });
  }
  return out;
}

const skeleton = (sku) => sku.replace(/\d/g, "");
const floorName = (f) => {
  const species = f.species && !f.color.toLowerCase().includes(f.species.toLowerCase()) ? f.species : "";
  return [f.collection, species, f.color, f.construction].filter(Boolean).join(" ");
};

// A code printed on two rows is a sheet typo on one of them: it belongs to the
// row whose other codes share its letters (EP512HSELG beside EP314HSELG).
function dedupeFloors(floors, warnings) {
  const bySku = new Map();
  for (const f of floors) bySku.set(f.sku, [...(bySku.get(f.sku) || []), f]);
  const out = [];
  for (const [sku, list] of bySku) {
    if (list.length === 1) { out.push(list[0]); continue; }
    const owners = list.filter((f) => f.siblings.some((s) => skeleton(s) === skeleton(sku)));
    const keep = owners.length === 1 ? owners[0] : list[0];
    const dropped = list.filter((f) => f !== keep);
    warnings.push(`${sku} is printed for ${list.map((f) => `${f.collection} ${f.color}`).join(" and ")} — kept as ${keep.color}; ${dropped.map((f) => `${f.color} ${f.width} ${f.construction}`).join(", ")} left out. Confirm the code with Palmer Donavin.`);
    out.push(keep);
  }
  return out;
}

const collectionKey = (s) => str(s).toLowerCase().replace(/collections?/g, "").replace(/[^a-z]/g, "");
const sortedLetters = (k) => [...k].sort().join("");

// "Color Strip and Color Plank Collections" names two floor collections; the
// sheet also misspells some ("Homestlye", "Tru Oak") — a transposition still
// matches by its letters.
function floorCollectionsFor(title, floorKeys) {
  return str(title).split(/\s+and\s+/i).map((part) => {
    const k = collectionKey(part);
    return floorKeys.get(k) || [...floorKeys].find(([fk]) => sortedLetters(fk) === sortedLetters(k))?.[1] || null;
  }).filter(Boolean);
}

function parseMoldings(pages, floors, warnings) {
  const floorKeys = new Map(floors.map((f) => [collectionKey(f.collection), f.collection]));
  const trims = new Map();
  const pending = [];
  let collections = [], bands = [], cols = [], table = 0;
  const speciesLabels = [];

  for (let p = 0; p < (pages?.length || 0); p++) {
    const items = (pages[p] || []).filter((i) => str(i?.str));
    for (const r of clusterRows(items)) {
      const sorted = [...r.items].sort((a, b) => a.x - b.x);
      const title = sorted.find((i) => i.x < 60 && /collections?$/i.test(str(i.str)));
      if (title) { collections = floorCollectionsFor(title.str, floorKeys); bands = []; cols = []; }
      const bandItems = sorted.filter((i) => /^(solid|engineered)\s/i.test(str(i.str)));
      if (bandItems.length) {
        bands = bandItems.map((i) => {
          const [, name, thickness] = str(i.str).match(/^(\w+)\s+(.*)$/);
          return { cx: cx(i), construction: name[0].toUpperCase() + name.slice(1).toLowerCase(), thickness };
        });
      }
      if (/^Touch Up Kit/i.test(str(sorted[0].str))) {
        table++;
        cols = sorted.map((i) => ({ cx: cx(i), label: str(i.str), price: null, band: null }));
        for (const c of cols) if (/stair nose|reducer|threshold/i.test(c.label) && bands.length) c.band = nearest(bands, c.cx);
        continue;
      }
      if (sorted.some((i) => str(i.str) === "Species")) {
        for (const i of sorted.filter((i) => PRICE.test(str(i.str)))) if (cols.length) nearest(cols, cx(i)).price = num(i.str);
        continue;
      }
      const codes = sorted.filter((i) => i.x > 165 && TRIM_SKU.test(str(i.str)));
      const species = sorted.filter((i) => i.x < 95).map((i) => str(i.str)).join(" ");
      if (species && cols.length) speciesLabels.push({ table, y: r.y, page: p, text: species });
      if (!codes.length || !cols.length) continue;
      const color = sorted.filter((i) => i.x >= 95 && i.x < 165).map((i) => str(i.str)).join(" ");
      pending.push({ table, page: p, y: r.y, species, color, collections,
        codes: codes.map((i) => ({ sku: str(i.str).toUpperCase(), col: nearest(cols, cx(i)) })) });
    }
  }

  for (const row of pending) {
    const labels = speciesLabels.filter((s) => s.table === row.table && s.page === row.page);
    const species = speciesName(row.species || (labels.length ? nearest(labels, row.y, (s) => s.y).text : ""));
    for (const { sku, col } of row.codes) {
      const t = trims.get(sku) || { sku, label: col.label, bands: new Set(), prices: new Set(), uses: [] };
      t.bands.add(col.band);
      if (col.price != null) t.prices.add(col.price);
      t.uses.push({ collections: row.collections, species, color: row.color, construction: col.band?.construction || "" });
      trims.set(sku, t);
    }
  }

  const out = [];
  for (const t of trims.values()) {
    const fits = new Set();
    for (const u of t.uses) {
      for (const f of floors) {
        if (!u.collections.includes(f.collection) || f.color.toLowerCase() !== u.color.toLowerCase()) continue;
        if (u.construction && f.construction !== u.construction) continue;
        fits.add(f.sku);
      }
    }
    const prices = [...t.prices].sort((a, b) => a - b);
    const cost = prices.length ? prices[prices.length - 1] : null;
    if (prices.length > 1) warnings.push(`${t.sku} is printed at ${prices.map(money).join(" and ")} in different collections — imported at the higher ${money(cost)}.`);
    const band = t.bands.size === 1 ? [...t.bands][0] : null;
    const first = t.uses[0];
    const collection = first.collections[0] || "";
    const parent = floorName({ collection, species: first.species, color: first.color, construction: "" });
    const codes = [...fits].sort();
    const desc = [parent, t.label, band?.construction].filter(Boolean).join(" ") + (codes.length ? ` · fits ${codes.join(" ")}` : "");
    out.push({ sku: t.sku, desc, collection, thickness: band?.thickness || "", cost, fits: codes });
  }
  return out;
}

const CANON = ["Item #", "Name", "Collection", "Color", "Size", "Thickness", "SF/Carton", "Cost", "Price U/M", "Type", "Kind", "Brand", "Fits", "Note"];
export const SOMERSET_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "productLine", 3: "color", 4: "size", 5: "thickness", 6: "sfPerUnit", 7: "cost", 8: "priceUnit", 9: "type", 10: "trim", 11: "brand", 12: "fits", 13: "note" },
  headerRow: 0,
  skuPattern: "^(?=.*[A-Za-z])[A-Za-z0-9]{4,14}$",
  defaultType: "",
  groupBy: "productLine",
};

export function parseSomersetPages(pages, name = "Somerset price list") {
  const warnings = [];
  let floors = [];
  for (const page of pages || []) {
    const items = (page || []).filter((i) => str(i?.str));
    const banners = clusterRows(items).filter((r) => /SF\/ctn/.test(rowText(r)));
    banners.forEach((b, n) => { floors.push(...parseFloorSection(items, b, banners[n + 1]?.y ?? Infinity, warnings)); });
  }
  floors = dedupeFloors(floors, warnings);
  const trims = parseMoldings(pages, floors, warnings);

  const rows = [CANON.slice()];
  const s = (v) => (v == null ? "" : String(v));
  for (const f of floors) {
    rows.push([f.sku, floorName(f), f.collection, f.color, f.width, f.thickness, s(f.sf), s(f.cost), "SF", "hardwood", "", BRAND, "", f.note]);
  }
  for (const t of trims) {
    rows.push([t.sku, t.desc, t.collection, "", "", t.thickness, "", s(t.cost), "EA", "", "trim", BRAND, t.fits.join(" "), ""]);
  }
  if (!floors.length) warnings.push("No Somerset floor rows were recognized — is this the Palmer Donavin Somerset price sheet?");
  return { name, rows, mapping: { ...SOMERSET_MAPPING, columns: { ...SOMERSET_MAPPING.columns } }, warnings, meta: { flooring: floors.length, trims: trims.length } };
}

// Mirage (Ohio Valley Flooring) price book — file detectors + the Product Chart
// parser (ADR 0025 rule 7).
//
// Mirage publishes as FOUR documents, and no three of them are a book:
//
//   Mirage_Product_Chart.pdf   floor SKUs at collection x grade x COLOR x width
//   OVF-Mirage-Hardwood.xls    prices at collection x grade x width
//   OVF-Mirage-Value-Tower.xls the same, for the value tier
//   OVF-Mirage-Trim.xls        trim SKUs by (collection, color) + trim prices
//
// The chart carries identity with no prices; the flooring sheets carry prices
// with no colors. They must be JOINED, not concatenated — which is why Mirage
// needs a parser that consumes several files rather than one sheet at a time.
//
// This module is the chart half: the detectors every file kind needs (so a
// hand-supplied PDF can be told from any other PDF — ADR 0025's manual source
// slots key on the format tag) and the chart parser that produces the book's
// SKU spine.
//
// The chart is a fixed x-band grid, like Mannington's Cartons Detail (ADR 0012),
// and layout-specific by design: a re-format breaks it back to "0 rows
// recognized" rather than to plausible garbage.

const str = (v) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();

// Mirage's own construction names. "TruBalance" is a Mirage trademark and appears
// on every one of its documents, which makes it the cheapest reliable "this is
// Mirage" signal across both the PDF and the workbooks.
const MIRAGE_MARK = /trubalance/i;

const pageText = (page) => (page || []).map((i) => i.str).join(" ");
const sheetText = (sheet, rows = 40) =>
  (sheet?.rows || []).slice(0, rows).map((r) => (r || []).map((c) => str(c)).join(" ")).join(" ");

// ---- detectors -------------------------------------------------------------
// Each Mirage file kind gets its own tag. ADR 0025 needs this: computeFingerprint
// gives PDFs no header signature, so an undetected PDF fingerprints as plain
// "generic" and a manual source slot would accept any unrelated PDF as the
// missing chart.

export function isMirageChart(pages) {
  const head = pageText((pages || [])[0]);
  return MIRAGE_MARK.test(head) && /product\s*chart/i.test(head);
}

export function isMirageTrim(sheets) {
  return (sheets || []).some((s) => {
    const t = sheetText(s);
    return MIRAGE_MARK.test(t) && /mouldings?\s*&\s*stair|moldings?\s*&\s*stair/i.test(t);
  });
}

export function isMirageFlooring(sheets) {
  return (sheets || []).some((s) => {
    const t = sheetText(s);
    if (!MIRAGE_MARK.test(t)) return false;
    if (/mouldings?\s*&\s*stair|moldings?\s*&\s*stair/i.test(t)) return false; // that's the trim sheet
    // Either the Value Tower banner, or the Hardwood sheet's Species/Grades grid.
    return /flooring price list/i.test(t) || (/\bspecies\b/i.test(t) && /\bgrades?\b/i.test(t));
  });
}

export const mirageFileKind = ({ sheets, pages, isPdf }) => {
  if (isPdf) return isMirageChart(pages) ? "mirage-chart" : null;
  if (isMirageTrim(sheets)) return "mirage-trim";
  if (isMirageFlooring(sheets)) return "mirage-flooring";
  return null;
};

// ---- the Product Chart -----------------------------------------------------

const isSku = (s) => /^\d{5}[A-Z]?$/.test(str(s));

// Text fragments on one printed line. The chart splits an inch mark into its own
// item ('5' + '"'), so they are stitched back together by proximity.
function pageRows(page) {
  const items = (page || [])
    .filter((i) => str(i.str))
    .map((i) => ({ s: str(i.str), x: i.x, y: i.y, cx: i.x + (i.w || 0) / 2 }));
  const rows = [];
  for (const it of items.sort((a, b) => a.y - b.y || a.x - b.x)) {
    const r = rows.find((r) => Math.abs(r.y - it.y) <= 3);
    if (r) r.items.push(it); else rows.push({ y: it.y, items: [it] });
  }
  rows.forEach((r) => r.items.sort((a, b) => a.x - b.x));
  return rows;
}

const rowText = (r) => r.items.map((i) => i.s).join(" ");

// Split a page into independently-parsable regions.
//
// Later charts print two unrelated tables side by side, so one printed LINE can
// carry two different products ("Laguna (Natural) … 40193 | Windsor 42900").
// Read as single rows they merge, and a table inherits its neighbour's bands.
//
// A page-wide column split does not work either: the gutter moves down the page
// (x≈470–520 is empty beside the top tables and full of data lower down). What
// makes it tractable is that the page is built from horizontal SECTIONS whose
// bottoms line up even when their tops do not — so: cut into sections on the
// vertical gaps between SKU rows first, then look for a left/right gutter WITHIN
// each section, where it is constant.
export function chartRegions(page) {
  const items = (page || []).filter((i) => str(i.str));
  const skus = items.filter((i) => isSku(i.str));
  if (!skus.length) return [items];
  const ys = [...new Set(skus.map((i) => i.y))].sort((a, b) => a - b);
  const bands = [];
  let run = [ys[0]];
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] - ys[i - 1] > 25) { bands.push(run); run = []; }
    run.push(ys[i]);
  }
  bands.push(run);

  const regions = [];
  let top = -Infinity;
  for (const b of bands) {
    const hi = b[b.length - 1] + 4;
    const zone = items.filter((i) => i.y > top && i.y <= hi);
    top = hi;
    const zoneSkus = zone.filter((i) => isSku(i.str));
    const xs = [...new Set(zoneSkus.map((i) => i.x))].sort((a, b) => a - b);
    let cutIdx = -1, widest = 0;
    for (let i = 1; i < xs.length; i++) {
      const gap = xs[i] - xs[i - 1];
      if (gap > widest) { widest = gap; cutIdx = i; }
    }
    if (widest < 60 || cutIdx < 1) { regions.push(zone); continue; }
    // Cut just past the left table's last column, NOT at the midpoint of the
    // gap: the right table's own labels (species, colour) sit well left of its
    // SKUs, and a midpoint cut hands them to the left table.
    const leftEdge = Math.max(...zoneSkus.filter((i) => i.x <= xs[cutIdx - 1]).map((i) => i.x + (i.w || 0)));
    const cut = leftEdge + 15;
    regions.push(zone.filter((i) => i.x < cut), zone.filter((i) => i.x >= cut));
  }
  return regions;
}

// The chart's columns are grouped under construction bands (TruBalance 3/4" /
// TruBalance Lite 9/16" / Lock 7/16" / Classic). A band label is centred over the
// columns it spans, so the bands partition the widths into contiguous runs: pick
// the partition whose per-band centroid best matches the label centres.
//
// Splitting at the midpoints between label centres looks equivalent and is not —
// it misassigns whenever neighbouring bands span very different widths (a
// 3-column "TruBalance Lite" beside a 1-column "Lock" puts the Lite herringbone
// under Lock).
export function bandRuns(bands, widths) {
  const k = bands.length, n = widths.length;
  const out = new Map();
  if (!k || !n || n < k) return out;
  let best = null;
  const score = (runs) => {
    let err = 0;
    runs.forEach(([a, b], i) => {
      const c = widths.slice(a, b).reduce((s, w) => s + w.cx, 0) / (b - a);
      err += Math.abs(c - bands[i].cx);
    });
    if (!best || err < best.err) best = { err, runs };
  };
  const walk = (bi, start, cuts) => {
    if (bi === k - 1) { score([...cuts, [start, n]]); return; }
    for (let end = start + 1; end <= n - (k - 1 - bi); end++) walk(bi + 1, end, [...cuts, [start, end]]);
  };
  walk(0, 0, []);
  best.runs.forEach(([a, b], i) => { for (let j = a; j < b; j++) out.set(widths[j], bands[i].label); });
  return out;
}

const nearest = (widths, cx) =>
  widths.reduce((b, w) => (Math.abs(w.cx - cx) < Math.abs(b.cx - cx) ? w : b), widths[0]);

// A block's colour list repeats once per sub-section — per grade on most blocks
// (Character then Exclusive, same colours), per species on the cork block. The
// labels for those sub-sections are printed vertically CENTRED beside their
// group, so they land on an arbitrary row and cannot be read by fill-down; the
// colour repeating is what actually marks the boundary. So: split the rows where
// a colour repeats, then hand out the labels in printed order.
function assignGroups(block) {
  const groups = [];
  let seen = new Set(), g = [];
  for (const cr of block.colorRows) {
    if (seen.has(cr.color)) { groups.push(g); g = []; seen = new Set(); }
    seen.add(cr.color); g.push(cr);
  }
  if (g.length) groups.push(g);
  const byY = (list) => list.slice().sort((a, b) => a.y - b.y);
  const grades = byY(block.grades), species = byY(block.speciesLabels || []);
  groups.forEach((grp, i) => grp.forEach((cr) => {
    // One label for the whole block applies to every group (a single grade
    // spanning both species groups); otherwise it is one label per group.
    cr.grade = (grades.length > 1 ? grades[i] : grades[0])?.label || grades[0]?.label || "";
    cr.species = (species.length > 1 ? species[i] : species[0])?.label || "";
  }));
  return groups;
}

// A block's left-hand columns are read off its OWN header row rather than fixed
// in code, because the layout varies: most blocks are "Grades | Colors", but the
// cork collection inserts a species column ("Grade | Species | Colors"), which a
// hardcoded colour window reads as the colour — emitting "Red Oak" as a colour
// name, which is exactly the plausible garbage this parser must not produce.
function headerColumns(row) {
  const at = (re) => row.items.find((i) => re.test(i.s))?.x;
  const grade = at(/^grades?$/i), color = at(/^colou?rs?$/i);
  if (grade == null || color == null) return null;
  return { grade, color, species: at(/^species$/i) ?? null };
}

function parseBlocks(rows) {
  const blocks = [];
  let cur = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], txt = rowText(r);
    // A band row names the constructions and carries the species in column 0.
    // A band row is STRUCTURALLY pure: nothing but band labels, optionally with a
    // species banner to their left. Testing for the words alone was enough while
    // they were distinctive, but "Solid" also appears in prose, and a stray match
    // starts a bogus block that swallows the real one's widths.
    const bandItems = r.items.filter((i) => /TruBalance|Classic|Lock|Solid/.test(i.s));
    const leftmostBand = bandItems.length ? Math.min(...bandItems.map((i) => i.x)) : Infinity;
    const pureBandRow = bandItems.length > 0 && !/thick/i.test(txt) &&
      r.items.every((i) => bandItems.includes(i) || i.x < leftmostBand);
    if (pureBandRow) {
      // Column 0 of a band row usually banners the species ("White Oak"), but on
      // blocks that carry their own species column it is just the first band —
      // taking it blindly files rows under a species called "TruBalance".
      const lead = r.items[0]?.s;
      const banner = lead && !/TruBalance|Classic|Lock|Solid/i.test(lead) ? str(lead) : "";
      cur = { bands: [], widths: [], colorRows: [], grades: [], speciesLabels: [], cols: null, collection: "", species: banner };
      for (const it of bandItems) cur.bands.push({ label: it.s, cx: it.cx });
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    // The header row labels the left-hand axes; the widths sit on the row above.
    const cols = headerColumns(r);
    if (cols) {
      cur.cols = cols;
      // The widths are not reliably ONE printed row. Where a band's columns carry
      // a pattern qualifier, their widths sit on a slightly lower baseline than
      // the plain ones (439.7 vs 443.2 on the 2026 chart) — far enough apart to
      // land in different rows. Reading only the row above then finds 2 widths
      // under 3 bands, and bandRuns rightly refuses to map them, costing the
      // whole block its construction. So collect every row between this header
      // and the thickness/band row above it.
      const above = [];
      for (let j = i - 1; j >= 0 && above.length < 3; j--) {
        const rr = rows[j];
        if (/thick/i.test(rowText(rr))) break;
        if (rr.items.some((it) => isSku(it.s) || /TruBalance|Classic|Lock|Solid/.test(it.s))) break;
        above.push(rr);
      }
      const parts = [];
      const gathered = [];
      for (const rr of above.reverse()) {
        // Stitch the inch mark back onto its number WITHIN a row, never across
        // one — the next row's first item is a new column, not this one's mark.
        let prevPart = null;
        for (const it of rr.items) {
          if (/^["']$/.test(it.s) && prevPart) { prevPart.s += '"'; continue; }
          prevPart = { s: it.s, cx: it.cx, x: it.x };
          parts.push(prevPart);
          gathered.push(prevPart);
        }
      }
      // The 2026 chart moved the species off the band row and onto the texture
      // row, as an ALL-CAPS banner left of the colours ("MAPLE", "RED OAK",
      // then "Smooth | DuraMatt®"). Without it 960 of 968 rows carry no species,
      // and species is the ONLY thing separating some Admiration SKUs — where
      // the price sheets differ by $2.20/sq ft between Red Oak and Maple.
      // Case is what tells the banner from its texture; the width bound keeps
      // the trademark "TM" that trails a texture out of it.
      if (!cur.species) {
        const banner = gathered.find((g) => g.x < cols.color - 10 && /^[A-Z][A-Z ]{2,}$/.test(g.s));
        if (banner) cur.species = titleCase(banner.s);
      }
      // Gathering several rows means non-width text comes along (a species
      // banner, the bare qualifiers), so a width must now LOOK like one rather
      // than merely contain a digit — with the qualifier optional, because the
      // 2025 chart prints it INSIDE the width item ("Herringbone 5") where the
      // 2026 one floats it on its own row.
      //
      // Then sorted by centre, NOT left in the order read: gathering across rows
      // interleaves the baselines, and bandRuns partitions the widths into
      // CONTIGUOUS runs — an out-of-order list maps columns to the wrong
      // construction while still looking fully populated.
      cur.widths = parts.filter((p) => /^(?:(?:herringbone|herr\.?|chevron|chev\.?) )?\d+(?:-\d+\/\d+)?"?\**$/i.test(p.s))
        .map((p) => ({ label: p.s, cx: p.cx }))
        .sort((a, b) => a.cx - b.cx);
      // Later charts moved the pattern qualifier onto its own row above the
      // widths, so a band prints as 5" / 7-3/4" / 5" / 5" with "Herringbone"
      // and "Chevron" floating above the last two. Without folding them back
      // in, three columns of one band all key as plain 5" and collide.
      const quals = parts.filter((q) => /^(herringbone|herr\.?|chevron|chev\.?)$/i.test(q.s));
      for (const q of quals) {
        if (!cur.widths.length) break;
        const w = cur.widths.reduce((b, x) => (Math.abs(x.cx - q.cx) < Math.abs(b.cx - q.cx) ? x : b), cur.widths[0]);
        if (w && Math.abs(w.cx - q.cx) <= 30 && !/herr|chev/i.test(w.label)) w.label = `${q.s} ${w.label}`;
      }
      continue;
    }
    if (!cur.cols) continue;
    const { grade: gx, color: cx, species: sx } = cur.cols;
    const near = (x, target, tol) => target != null && Math.abs(x - target) <= tol;
    const skus = r.items.filter((i) => isSku(i.s));
    // Each label is looked up independently: a grade can share its row with a
    // colour and its SKUs (Escape prints "Character" beside "Cold Springs"), so
    // finding one must not stop us finding the others.
    const firstSkuX = skus.length ? Math.min(...skus.map((s) => s.x)) : Infinity;
    const labels = r.items.filter((i) => !isSku(i.s) && i.x < firstSkuX - 4);
    const collAt = labels.find((i) => i.x < gx - 5);
    const gradeAt = labels.find((i) => near(i.x, gx, 8));
    // Everything from the colour column rightwards is the colour, joined: later
    // charts break one name into several text items ("Bow Valley" "(" "Natural"
    // ")"), so taking a single item yields ")". The window is generous to the
    // LEFT because those charts centre the "Colors" header over a left-aligned
    // column (header x=153, values x=127) — but it still starts well right of
    // the species column, so the two never merge.
    const colorParts = labels.filter((i) => i.x >= cx - 30);
    const color = colorParts.map((i) => i.s).join(" ")
      .replace(/\s*\(\s*/g, " (").replace(/\s+\)/g, ")").replace(/\s+/g, " ").trim();
    const colorAt = colorParts.length ? { s: color } : null;
    const speciesAt = labels.find((i) => i.x < cx - 30 && near(i.x, sx, 14));
    const collParts = labels.filter((i) => i.x < gx - 5).map((i) => i.s).filter((s) => !/^collections?$/i.test(s));
    if (collParts.length) cur.collection = collParts.join(" ");
    if (gradeAt) cur.grades.push({ label: gradeAt.s, y: r.y });
    if (speciesAt) cur.speciesLabels.push({ label: speciesAt.s, y: r.y });
    if (colorAt && skus.length) cur.colorRows.push({ color: colorAt.s, y: r.y, skus });
  }
  return blocks;
}

// The chart -> one row per (collection, grade, color, construction, width) with
// its SKU. This is the book's identity spine: every floor SKU Mirage sells, with
// the axes the flooring sheets price against.
export function parseMirageChart(pages) {
  const out = [];
  const warnings = [];
  for (const page of pages || []) {
    for (const region of chartRegions(page)) {
      for (const b of parseBlocks(pageRows(region))) {
        if (!b.widths.length || !b.colorRows.length) continue;
        assignGroups(b);
        const runs = bandRuns(b.bands, b.widths);
        for (const cr of b.colorRows) {
          for (const it of cr.skus) {
            const w = nearest(b.widths, it.cx);
            out.push({
              collection: b.collection,
              // A per-row species column (the cork collection) is more specific
              // than the block banner's "Red Oak / Brushed Cashmere®".
              species: cr.species || b.species,
              grade: cr.grade, color: cr.color,
              construction: runs.get(w) || "", width: w?.label || "", sku: it.s,
            });
          }
        }
      }
    }
  }
  if (!out.length) warnings.push("No Mirage product-chart rows were recognized — is this the Mirage Product Chart PDF?");
  return { rows: out, warnings };
}

// ---- the flooring price sheets ---------------------------------------------
// Hardwood and Value Tower share a layout: a construction band row, a width row,
// a header row naming Species/Grades, then data rows of $/SF. Both print the
// grid twice — prices on one side, SKUs on the other — so a column only becomes
// a price when it actually parses as one.

// The join keys. The three documents spell the same axis differently, and every
// mismatch here silently costs a floor its price, so both sides are normalized
// to one spelling rather than compared raw.
//
//   chart      Hardwood            Value Tower
//   Classic    Solid 3/4"          Classic 3/4''      <- different WORD, not just thickness
//   Herringbone 5"   Herr. 5"      Herr. 5"
//   7-3/4"     7-3/4"              7 3/4"
export const normConstruction = (v) =>
  str(v).toLowerCase()
    .replace(/\d+\s*[-\/]?\s*\d*\s*\/?\s*\d*\s*["'′]+/g, " ") // drop the thickness
    .replace(/\bsolid\b/, "classic")                          // Hardwood's word for Classic
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

export const normWidth = (v) =>
  str(v).toLowerCase()
    .replace(/\*+/g, "")                       // footnote markers ("9\"**")
    .replace(/["'′]+/g, "")
    .replace(/\bherringbone\b|\bherr\b\.?/g, "herr")
    .replace(/\bchev\b\.?/g, "chevron")
    .replace(/(\d)\s+(\d+\/\d+)/g, "$1-$2")   // "7 3/4" -> "7-3/4"
    .replace(/[^a-z0-9\-\/ ]/g, " ").replace(/\s+/g, " ").trim();

const priceOf = (v) => {
  const m = /\$?\s*([\d,]+(?:\.\d+)?)\s*\/\s*SF/i.exec(str(v));
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
};

const cell = (row, i) => str((row || [])[i]);
const findCol = (row, re) => (row || []).findIndex((c) => re.test(str(c)));

// A flooring sheet prints its grid TWICE — prices in the upper half, the matching
// SKUs in the lower half, under identical headers. So the block walk is shared
// and the caller says which value it wants out of a cell: `priceOf` for the price
// half, `isSku` for the SKU half. A cell only belongs to a block when it actually
// parses as that kind, which is what keeps the two halves apart.
function walkFloorBlocks(sheets, read) {
  const rows = [];
  for (const sh of sheets || []) {
    const grid = sh?.rows || [];
    for (let h = 2; h < grid.length; h++) {
      const gradeCol = findCol(grid[h], /^grades?$/i);
      const speciesCol = findCol(grid[h], /^species?$|^specie$/i);
      if (gradeCol < 0 || speciesCol < 0) continue;
      const widthRow = grid[h - 1] || [], bandRow = grid[h - 2] || [];
      // Merged header cells put the band label in the first column of its span,
      // so it fills right until the next label — unlike the PDF, where the same
      // label is centred over its columns.
      const bandAt = [];
      let band = "";
      for (let c = 0; c < Math.max(bandRow.length, widthRow.length); c++) {
        if (cell(bandRow, c)) band = cell(bandRow, c);
        bandAt[c] = band;
      }
      // This block's price columns, stopping at the gutter. The sheet prints two
      // tables side by side and offset by a row, so the width row carries the
      // NEIGHBOUR's columns too — taking every non-empty cell stretches the block
      // across the gutter, and then the neighbour's header row (which lands on
      // this block's first data row) reads as "this block is over".
      const priceCols = [];
      let gap = 0;
      for (let c = gradeCol + 1; c < widthRow.length; c++) {
        if (cell(widthRow, c)) { priceCols.push(c); gap = 0; continue; }
        if (priceCols.length && ++gap >= 3) break;
      }
      if (!priceCols.length) continue;

      // The collection sits just LEFT of the species column, not in column 0.
      // Column 0 is only the collection for the left-hand table, and the sheet
      // prints a second table beside it (Elemental lives at columns 10-15) —
      // reading column 0 there picks up the left table's cells, so Elemental
      // came through with no collection, matched no chart row, and the entire
      // collection was dropped from the book without a word.
      //
      // Two columns of reach, because the sheets vary: Hardwood puts the
      // collection immediately left of Species, Value Tower leaves a blank
      // column between them.
      const collAt = [speciesCol - 1, speciesCol - 2].filter((c) => c >= 0);
      const collectionOf = (row) => {
        for (const c of collAt) {
          const v = cell(row, c);
          if (v && priceOf(v) == null) return v;
        }
        return "";
      };

      // Where this block's columns stop. The break test below must not look past
      // it: the sheet's side-by-side tables mean the RIGHT table's header row
      // lands on the LEFT table's first data row, so a row-wide test ends the
      // left block before it has read a single price. That is how the whole
      // "Natural" programme (White Oak R&Q, Hickory, Walnut) was being lost.
      const blockEnd = Math.max(...priceCols);

      let collection = "", species = "";
      for (let r = h + 1; r < grid.length; r++) {
        const row = grid[r];
        // A new band/header row ends the block — one belonging to THIS block.
        if (findCol((row || []).slice(0, blockEnd + 1), /^grades?$/i) >= 0) break;
        const coll = collectionOf(row);
        if (coll) collection = coll;
        if (cell(row, speciesCol)) species = cell(row, speciesCol);
        const grade = cell(row, gradeCol);
        let any = false;
        for (const c of priceCols) {
          const value = read(cell(row, c));
          if (value == null) continue;
          any = true;
          rows.push({
            collection, species, grade,
            construction: bandAt[c] || "", width: cell(widthRow, c), value,
            sheet: sh.name || "",
          });
        }
        // Blank spacer rows are fine; a run of them with no values and no labels
        // means the block is over.
        if (!any && !cell(row, 0) && !grade && !(row || []).some((c) => str(c))) break;
      }
    }
  }
  return rows;
}

export function parseMirageFlooring(sheets) {
  const rows = walkFloorBlocks(sheets, priceOf).map(({ value, ...r }) => ({ ...r, price: value }));
  const warnings = rows.length ? [] : ["No Mirage flooring prices were recognized — is this a Mirage flooring price sheet?"];
  return { rows, warnings };
}

// The SKU half of the same grid.
//
// For most collections these SKUs are ONE ARBITRARY COLOUR'S — Blanc/Character/5"
// reads 36180, which is specifically White Mist — so they must never be used as a
// collection's SKUs. The exception is a single-colour programme, where "one
// arbitrary colour" and "the colour" are the same thing. Natural is one: it is the
// clear coat, so the collection has exactly one colour and its name IS the colour.
// That is why the caller gates this on an allowlist rather than taking the lot.
export function parseMirageFloorSkus(sheets) {
  return walkFloorBlocks(sheets, (v) => (isSku(v) ? str(v) : null))
    .map(({ value, ...r }) => ({ ...r, sku: value, color: r.collection }));
}

// ---- Value Tower's own colour grid ------------------------------------------
// Below its price grid, the Value Tower sheet repeats the chart's job: colour
// rows of SKUs under a construction × width header, per species block. Mostly it
// duplicates the chart, but it is the ONLY source for the Escape *Traditional*
// colours, which the chart does not list at all.
//
// Same shape as a chart block, in cells rather than x-bands:
//
//   [ White Oak Brushed DuraMatt® | | | TruBalance 3/4" | | | | TruBalance Lite ]  banner + bands
//   [                            | | | 5" | 7" | Herr. 5" | Chevron 5" | 5"     ]  widths
//   [                            | | Colors | Lengths 20 to 82" | …            ]  header
//   [ Muse | Character | Ada | 75986 | 77929 | 76054 | …                       ]  data

// The species leads its banner and the texture follows it ("White Oak Brushed
// DuraMatt®", "Red Oak Traditional"). Cut at the texture so the species matches
// how the price grid spells it — the join depends on the two agreeing.
const TEXTURE_RE = /\b(brushed|smooth|hand|wire|cork|traditional|distressed)\b/i;
const bannerSpecies = (s) => {
  const v = str(s).replace(/\s+/g, " ");
  const m = TEXTURE_RE.exec(v);
  return (m ? v.slice(0, m.index) : v).replace(/[®*†]/g, "").trim();
};

const looksWidth = (v) => /^(?:(?:herringbone|herr\.?|chevron|chev\.?)\s*)?\d+(?:[-\s]\d+\/\d+)?\s*(?:["'′]{1,2})?\**$/i.test(str(v));

// The colour grid files the Traditional colours under "Escape", but the price
// list sells them as "Lakeside", and Lakeside is the name that goes on the order
// (owner, 2026-07-20). Both sides agree on species, grade, construction and
// width — the collection name is the only difference, which is why the two
// halves look like separate products: Lakeside has a price and no SKUs, Escape
// Traditional has SKUs and no price. Renaming here rejoins them.
const aliasCollection = (r) =>
  (/^escape$/i.test(str(r.collection)) && /^traditional$/i.test(str(r.grade))) ? "Lakeside" : r.collection;

// The collections a flooring sheet — not the chart — is the source for. The chart
// is the spine for everything else; these two it simply does not list.
//
//   lakeside  the Value Tower colour grid's Traditional block (see aliasCollection)
//   natural   the Hardwood sheet's own SKU half, a single-colour programme
//
// Named on purpose rather than inferred as "whatever the chart lacks": the sheets
// carry their own dates, so an inferred rule readmits discontinued product the
// moment a collection is retired. Add the next one here deliberately.
const GRID_ONLY_COLLECTIONS = new Set(["lakeside", "natural"]);

export function parseMirageColorGrid(sheets) {
  const out = [];
  const warnings = [];
  for (const sh of sheets || []) {
    const grid = sh?.rows || [];
    for (let h = 0; h < grid.length; h++) {
      const colorCol = findCol(grid[h], /^colou?rs?$/i);
      if (colorCol < 0) continue;
      // The width row is the nearest row above carrying width-shaped cells to the
      // right of the colour column; the band row is the nearest above THAT naming
      // constructions. Searching upward rather than at fixed offsets is what lets
      // the blocks differ in spacing, which they do (2 blank rows here, 1 there).
      let widthRow = -1, bandRow = -1;
      for (let r = h - 1; r >= 0 && r >= h - 4 && widthRow < 0; r--) {
        if ((grid[r] || []).some((c, i) => i > colorCol && looksWidth(c))) widthRow = r;
      }
      if (widthRow < 0) continue;
      for (let r = widthRow - 1; r >= 0 && r >= widthRow - 4 && bandRow < 0; r--) {
        if ((grid[r] || []).some((c) => /TruBalance|Classic|Lock|Solid/i.test(str(c)))) bandRow = r;
      }
      if (bandRow < 0) continue;

      // Merged header cells put a band label in the first column of its span, so
      // it fills right until the next label (the price grid does the same).
      const bandAt = [];
      let band = "";
      for (let c = 0; c < Math.max((grid[bandRow] || []).length, (grid[widthRow] || []).length); c++) {
        const v = cell(grid[bandRow], c);
        if (v && /TruBalance|Classic|Lock|Solid/i.test(v)) band = v;
        bandAt[c] = band;
      }
      const species = bannerSpecies(cell(grid[bandRow], 0));
      const skuCols = [];
      for (let c = colorCol + 1; c < (grid[widthRow] || []).length; c++) if (looksWidth(cell(grid[widthRow], c))) skuCols.push(c);
      if (!skuCols.length) continue;

      let collection = "", grade = "";
      for (let r = h + 1; r < grid.length; r++) {
        const row = grid[r] || [];
        if (findCol(row, /^colou?rs?$/i) >= 0) break;                    // the next block's header
        if (row.some((c) => /TruBalance|Classic|Lock|Solid/i.test(str(c)))) break; // or its bands
        if (cell(row, 0)) collection = cell(row, 0);
        if (cell(row, 1)) grade = cell(row, 1);
        const color = cell(row, colorCol);
        if (!color) continue;
        for (const c of skuCols) {
          const sku = cell(row, c);
          if (!isSku(sku)) continue;
          const r = { collection, grade, color, species, construction: bandAt[c] || "", width: cell(grid[widthRow], c), sku };
          out.push({ ...r, collection: aliasCollection(r) });
        }
      }
    }
  }
  if (!out.length) warnings.push("No Mirage colour-grid rows were recognized — does this sheet carry the per-colour SKU grid below its prices?");
  return { rows: out, warnings };
}

// ---- the trim sheet ---------------------------------------------------------
// Two tables that must be joined to each other before either is useful:
//
//   prices  (construction group, trim type) x SPECIES        — no SKUs
//   SKUs    (collection, colour) x (construction, trim type) — no prices
//
// and the two halves name a trim differently ("Matchable Square Stair Nosing"
// against "Match. Square Nosing 69\""), so the labels are normalized to one
// spelling the way construction and width already are for floors.

// A trim's identity, reduced to the words both tables agree on. "Stair" goes
// because one side writes "Matchable Square Stair Nosing" and the other
// "Matchable Square Nosing"; plurals go because of "Treads & Risers Planks" vs
// "Tread & Riser Planks"; the footnote markers and inch marks are decoration.
export const normTrimType = (v) =>
  str(v).toLowerCase()
    .replace(/\*+/g, "")
    .replace(/\bmatch\.?\b/g, "matchable")
    .replace(/["'′]/g, "")
    .replace(/\b(\d+)\s*x\s*(\d+)\b/g, "$1x$2")     // 4X10 / 4"x10"
    .replace(/\bstair\s+nosing\b/g, "nosing")
    .replace(/\bnosings\b/g, "nosing")
    .replace(/\btreads\b/g, "tread").replace(/\brisers\b/g, "riser")
    .replace(/\bmoulding\b/g, "molding")
    .replace(/\b\d+(?:-\d+\/\d+)?\b(?=\s*$)/g, "")  // a trailing size ("… 69")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// The construction group, reduced to its THICKNESS. The price table groups trims
// as '3/4" thick (TruBalance, Classic)' while the SKU grid writes
// '3/4"(TruBalance, Classic)' in one block and plain '3/4"(TruBalance)' in the
// next — the parenthetical only lists which constructions share that thickness,
// so comparing it costs the 3/4" TruBalance blocks their prices. Thickness is
// what the vendor actually prices on. "Multifunctions" fits every thickness and
// is its own group.
export const normTrimGroup = (v) => {
  const s = str(v).toLowerCase();
  if (/multifunction/.test(s)) return "multifunctions";
  const m = /(\d+)\s*\/\s*(\d+)/.exec(s);
  return m ? `${m[1]}/${m[2]}` : s.replace(/[^a-z0-9/ ]/g, " ").replace(/\s+/g, " ").trim();
};

// One spelling for a species on both sides of the trim join. R&Q is rift-and-
// quartered, a distinct product — it must survive as one token, and must read
// the same whether it came from a price header or a SKU block's species column.
export const normSpecies = (v) =>
  str(v).toLowerCase().replace(/\br\s*&\s*q\b/g, "rq").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

// A price column can serve several species ("Red Oak & Oak"), so it keys to each.
const speciesOfHeader = (v) =>
  str(v).replace(/\br\s*&\s*q\b/gi, "RQ").split("&").map((s) => normSpecies(s)).filter(Boolean);

// The upper table: price per (group, trim type, species).
export function parseMirageTrimPrices(sheets) {
  const out = new Map();
  for (const sh of sheets || []) {
    const grid = sh?.rows || [];
    for (let h = 0; h < grid.length; h++) {
      const cols = [];
      for (let c = 0; c < (grid[h] || []).length; c++) {
        const sp = speciesOfHeader(cell(grid[h], c));
        if (sp.length && /oak|maple|hickory|walnut|birch|cherry/i.test(cell(grid[h], c))) cols.push({ c, sp });
      }
      if (cols.length < 2) continue;                       // not the species header
      let group = "", type = "";
      for (let r = h + 1; r < grid.length; r++) {
        const row = grid[r] || [];
        if (cell(row, 0)) group = cell(row, 0);
        if (cell(row, 1)) type = cell(row, 1);
        if (!group || !type) continue;
        for (const { c, sp } of cols) {
          const price = priceEach(cell(row, c));
          if (price == null) continue;
          for (const s of sp) {
            const key = `${normTrimGroup(group)}|${normTrimType(type)}|${s}`;
            if (!out.has(key)) out.set(key, price);        // first row wins: 48" before 69"
          }
        }
      }
      break;                                               // one price table per sheet
    }
  }
  return out;
}

const priceEach = (v) => {
  const m = /\$?\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*EA)?\s*$/i.exec(str(v));
  return m && /[\d]/.test(m[1]) ? parseFloat(m[1].replace(/,/g, "")) : null;
};

// The lower grid: a trim SKU per (collection, colour) x (construction, type).
export function parseMirageTrimSkus(sheets) {
  const out = [];
  for (const sh of sheets || []) {
    const grid = sh?.rows || [];
    for (let h = 0; h < grid.length; h++) {
      const colorCol = findCol(grid[h], /^colou?rs?$/i);
      const speciesColHdr = findCol(grid[h], /^species$/i);
      // Two block shapes. Most list colours down a Colors column. The "Natural"
      // programme instead varies by SPECIES and has no Colors column at all,
      // because Natural is not one colour among others — it is the clear coat,
      // the wood's own colour — so the sheet prints it once in column 0 and lets
      // the species column do the work. Its own footnote says as much:
      // "available in a variety of species in our collections". Such a block
      // names no collection either, and fits any collection's Natural floor.
      if (colorCol < 0 && speciesColHdr < 0) continue;
      const naturalBlock = colorCol < 0;
      // Everything right of the label columns is a trim column, whichever shape
      // the block takes.
      const labelFrom = colorCol >= 0 ? colorCol : speciesColHdr;
      // Walk up for the type row and the banner row. Between them can sit a size
      // row (48" / 69") that splits ONE type label across two columns, so the
      // label is composed from both rather than read off a single row.
      let typeRow = -1, bandRow = -1, sizeRow = -1;
      for (let r = h - 1; r >= 0 && r >= h - 7; r--) {
        const row = grid[r] || [];
        // The banner carries the construction groups and tops the block, so it
        // ends the search — anything above belongs to the previous block.
        if (row.some((c) => /TruBalance|Classic|Lock|Multifunction/i.test(str(c)))) { bandRow = r; break; }
        const right = row.filter((c, i) => i > labelFrom && cell(row, i));
        if (!right.length) continue;
        // A row of nothing but sizes is the 48"/69" splitter under one type
        // label; a row of words is the type row itself.
        if (right.every((c) => looksWidth(c))) { if (sizeRow < 0) sizeRow = r; continue; }
        if (typeRow < 0 && right.length >= 2) typeRow = r;
      }
      if (typeRow < 0 || bandRow < 0) continue;

      const width = Math.max(...[bandRow, typeRow, sizeRow, h].filter((r) => r >= 0).map((r) => (grid[r] || []).length));
      const bandAt = [], typeAt = [];
      let band = "", type = "";
      for (let c = 0; c < width; c++) {
        const b = cell(grid[bandRow], c);
        if (b && /TruBalance|Classic|Lock|Multifunction/i.test(b)) band = b;
        bandAt[c] = band;
        const t = cell(grid[typeRow], c);
        if (t) type = t;
        typeAt[c] = c > labelFrom ? type : "";
      }
      // Most blocks banner one species ("Maple Smooth DuraMatt®"). The
      // multi-species collections instead give it its own column and leave the
      // banner as bare texture ("Cork DuraMatt®"), exactly as the chart's cork
      // block does — so a per-row column, where present, outranks the banner.
      const speciesCol = findCol(grid[h], /^species$/i);
      const banner = bannerSpecies(cell(grid[bandRow], 0));

      let collection = "", rowSpecies = "", natural = "";
      for (let r = h + 1; r < grid.length; r++) {
        const row = grid[r] || [];
        if (findCol(row, /^colou?rs?$/i) >= 0) break;
        if (row.some((c) => /TruBalance|Classic|Lock|Multifunction/i.test(str(c)))) break;
        // Column 0 is the collection on a normal block and the colour on a
        // Natural one, where it is printed once and fills down.
        if (cell(row, 0)) { if (naturalBlock) natural = cell(row, 0); else collection = cell(row, 0); }
        if (speciesCol >= 0 && cell(row, speciesCol)) rowSpecies = cell(row, speciesCol);
        const species = (speciesCol >= 0 ? rowSpecies : banner) || banner;
        const color = naturalBlock ? natural : cell(row, colorCol);
        if (!color) continue;
        for (let c = colorCol + 1; c < width; c++) {
          const sku = cell(row, c);
          if (!isSku(sku) || !typeAt[c]) continue;
          const size = sizeRow >= 0 ? cell(grid[sizeRow], c) : "";
          out.push({
            sku, collection, color, species,
            group: bandAt[c] || "",
            type: typeAt[c],
            size,
            label: [typeAt[c], size].filter(Boolean).join(" "),
          });
        }
      }
    }
  }
  return out;
}

// Chart SKUs priced from the flooring sheets. The chart is the spine — it alone
// knows the colours — and a price is looked up per (collection, grade,
// construction, width). Where the two sheets overlap the LATER effective date
// wins, which is why the caller passes the sheets oldest-first (parseMirage
// orders them by their own `Effective:` line).
//
// A chart SKU with no price is DROPPED, not carried at zero: an order item's
// cost drives the quote, so a priceless row would quote $0 rather than fail
// loudly. They come back as `unpriced` so the import can say how many and why.
// Expect some: the chart and the price sheets are published on different dates,
// so a chart older than the current sheet still lists widths that have since
// been dropped.
export function priceChartRows(chartRows, priceRows) {
  // SPECIES IS PART OF THE KEY. Admiration Exclusive sells in both Red Oak and
  // Maple, at $9.29 and $11.49 for the same TruBalance 5" — and 27 chart rows
  // differ by nothing else. Keyed without it, both SKUs silently take whichever
  // sheet row was written last, and one of them quotes ~$2/sq ft wrong.
  // The chart and the sheets spell species identically, so no mapping is needed;
  // construction and width are the only axes that had to be normalized.
  const key = (r) =>
    [str(r.collection).toLowerCase(), str(r.grade).toLowerCase(), str(r.species).toLowerCase(),
      normConstruction(r.construction), normWidth(r.width)].join("|");
  const byKey = new Map();
  for (const p of priceRows || []) byKey.set(key(p), p); // last writer wins
  const rows = [], unpriced = [];
  for (const c of chartRows || []) {
    const p = byKey.get(key(c));
    if (p) rows.push({ ...c, price: p.price, priceSheet: p.sheet });
    else unpriced.push(c);
  }
  return { rows, unpriced };
}

// ---- the whole book, from all four files ------------------------------------
// ADR 0025 rule 7: a parser may consume SEVERAL files and collapse them into one
// canonical sheet + mapping, the same contract parseOvf and parsePdfPages meet
// for one file. Everything downstream — sheet picker, mapping controls, diff,
// apply — is untouched.
//
// Mirage needs it because the chart and the price sheets must be JOINED: the
// chart carries identity with no prices, the sheets carry prices with no colours,
// and the write path is a SKU-keyed upsert, so no sequence of single-file imports
// can express the join.

const MIRAGE_BRAND = "Mirage";

// An ampersand marks an abbreviation the vendor writes in caps ("R&Q", rift and
// quartered), not a word to sentence-case into "R&q".
const titleCase = (s) => str(s).replace(/\w\S*/g, (w) => (/&/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));

// "Effective: July 13th, 2026" -> a sortable timestamp.
//
// WHICH SHEET SUPERSEDES THE OTHER IS A QUESTION OF DATE, not of filename or
// argument order. Hardwood happens to be newer than Value Tower today (2026-07-13
// vs 2025-02-03), which is why the owner's rule reads "Hardwood supersedes Value
// Tower" — but that is an observation about the current editions, not a property
// of the sheets. Reading the date means a freshly published Value Tower wins the
// moment it arrives, with nothing to remember.
export function effectiveDate(sheets) {
  for (const sh of sheets || []) {
    for (const row of (sh?.rows || []).slice(0, 8)) {
      for (const c of row || []) {
        const m = /effective:\s*([A-Za-z]+\s+\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})/i.exec(str(c));
        if (!m) continue;
        const t = Date.parse(`${m[1]}, ${m[2]}`);
        if (!Number.isNaN(t)) return t;
      }
    }
  }
  return null;
}

// The canonical column order, shared with the mapping below. Same shape the OVF
// books emit, so the wizard treats a Mirage bundle like any other pre-resolved
// sheet.
const CANON = ["Item #", "Name", "Collection", "Color", "Size", "SF/Carton", "Cost", "Price U/M", "Type", "Kind", "Brand", "Fits"];

export const MIRAGE_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "productLine", 3: "color", 4: "size", 5: "sfPerUnit", 6: "cost", 7: "priceUnit", 8: "type", 9: "trim", 10: "brand", 11: "fits" },
  headerRow: 0,
  skuPattern: "^\\d{5}[A-Z]?$",
  defaultType: "",
  groupBy: "productLine",
};

// A floor's shelf name: species, colour, grade, construction as one plain
// phrase — no punctuation (owner, 2026-07-20). Width is left out because it
// already prints from the Size column; keeping it here doubled it on every line.
const floorName = (r) =>
  [titleCase(r.species), r.color, r.grade, r.construction].filter(Boolean).join(" ").trim() || r.color;

export function parseMirage(payloads, name = "Mirage price book") {
  const tagged = (payloads || []).map((p) => ({ p, kind: mirageFileKind(p || {}) }));
  // Not a Mirage set at all: the caller falls through to the single-file path,
  // exactly as parseOvf's null does.
  if (!tagged.some((t) => t.kind)) return null;

  const warnings = [];
  const chartAt = tagged.find((t) => t.kind === "mirage-chart");
  const floorAt = tagged.filter((t) => t.kind === "mirage-flooring");
  const trimAt = tagged.filter((t) => t.kind === "mirage-trim");

  const chart = chartAt ? parseMirageChart(chartAt.p.pages) : { rows: [], warnings: [] };
  warnings.push(...chart.warnings);

  const trimSkus = [], trimPrices = new Map();
  for (const t of trimAt) {
    trimSkus.push(...parseMirageTrimSkus(t.p.sheets));
    for (const [k, v] of parseMirageTrimPrices(t.p.sheets)) if (!trimPrices.has(k)) trimPrices.set(k, v);
  }

  // Oldest first, so the newest sheet is the last writer in priceChartRows.
  // A sheet with no readable date sorts oldest — it loses an overlap rather than
  // silently overwriting a sheet we CAN date.
  const priceRows = [];
  const gridRows = [];
  for (const o of floorAt.map((t) => ({ t, at: effectiveDate(t.p.sheets) })).sort((a, b) => (a.at ?? 0) - (b.at ?? 0))) {
    const r = parseMirageFlooring(o.t.p.sheets);
    priceRows.push(...r.rows);
    if (!r.rows.length) warnings.push(...r.warnings);
    // Both places a flooring sheet can carry SKUs the chart doesn't: Value
    // Tower's per-colour grid, and the sheet's own SKU half. Both are filtered to
    // GRID_ONLY_COLLECTIONS below.
    gridRows.push(...parseMirageColorGrid(o.t.p.sheets).rows, ...parseMirageFloorSkus(o.t.p.sheets));
  }

  // The chart is the spine. The colour grid is consulted for ONE thing —
  // Lakeside — because that is the only collection Mirage sells that the chart
  // does not list (owner, 2026-07-20).
  //
  // Deliberately a named collection rather than "anything the chart lacks". The
  // grid carries its own sheet's date (Value Tower is Feb 2025 against a Feb 2026
  // chart), so a general merge readmits 243 items the newer chart has since
  // dropped — discontinued product, resurrected AND priced, which is worse than
  // missing. A "collections the chart doesn't cover" rule would look equivalent
  // today and quietly become that the first time a collection is retired.
  //
  // If Mirage adds another chart-less collection, add it here on purpose.
  const spine = [...chart.rows];
  const known = new Set(spine.map((r) => r.sku));
  let fromGrid = 0;
  for (const r of gridRows) {
    if (!GRID_ONLY_COLLECTIONS.has(str(r.collection).toLowerCase())) continue;
    if (known.has(r.sku)) continue;
    known.add(r.sku); spine.push(r); fromGrid++;
  }

  const { rows: priced, unpriced } = priceChartRows(spine, priceRows);

  const out = [CANON.slice()];
  for (const r of priced) {
    out.push([r.sku, floorName(r), r.collection, r.color, r.width, "",
      r.price != null ? String(r.price) : "", "SF", "hardwood", "", MIRAGE_BRAND, ""]);
  }

  // Trims, keyed to the floors they match. `fits` (ADR/PR #173) is what lets a
  // floor's search surface its own stair nosing, so it is the whole point of
  // importing the trim sheet rather than a list of loose part numbers.
  const floorsAt = new Map();
  for (const r of priced) {
    const k = `${str(r.collection).toLowerCase()}|${str(r.color).toLowerCase()}`;
    if (!floorsAt.has(k)) floorsAt.set(k, []);
    floorsAt.get(k).push(r.sku);
  }
  // The trim sheet sometimes qualifies a collection with its species
  // ("Admiration Maple") where the floors just say "Admiration", so a miss on the
  // full name retries on the leading word. Colour still has to match exactly —
  // that is the part that makes a trim the right trim.
  // The Natural trims name no collection — Natural is the clear coat, sold
  // across collections in whatever species — so they fit by species + colour
  // instead, in any collection that offers it.
  const bySpecies = new Map();
  for (const r of priced) {
    const k = `${normSpecies(r.species)}|${str(r.color).toLowerCase()}`;
    if (!bySpecies.has(k)) bySpecies.set(k, []);
    bySpecies.get(k).push(r.sku);
  }
  const fitsFor = (t) => {
    const color = str(t.color).toLowerCase();
    const full = str(t.collection).toLowerCase();
    if (!full) return bySpecies.get(`${normSpecies(t.species)}|${color}`) || [];
    return floorsAt.get(`${full}|${color}`) || floorsAt.get(`${full.split(" ")[0]}|${color}`) || [];
  };

  // One row per trim SKU, with the fits UNIONED. The vendor lists a few parts
  // under two collections (Maple Platinum's serve both Admiration and Elemental),
  // and the book is a SKU-keyed upsert — so emitting both rows means one wins
  // arbitrarily and takes only half the floors it actually fits.
  const bySku = new Map();
  let trimUnpriced = 0;
  for (const t of trimSkus) {
    const price = trimPrices.get(`${normTrimGroup(t.group)}|${normTrimType(t.label)}|${normSpecies(t.species)}`);
    if (price == null) { trimUnpriced++; continue; }
    const hit = bySku.get(t.sku);
    if (hit) { for (const f of fitsFor(t)) hit.fits.add(f); continue; }
    bySku.set(t.sku, { t, price, fits: new Set(fitsFor(t)) });
  }
  let trimOrphan = 0;
  for (const { t, price, fits } of bySku.values()) {
    if (!fits.size) trimOrphan++;
    const desc = [titleCase(t.species), t.color, t.label].filter(Boolean).join(" ");
    out.push([t.sku, desc, t.collection, t.color, t.size || "", "",
      String(price), "EA", "", "trim", MIRAGE_BRAND, [...fits].join(" ")]);
  }
  const trims = bySku.size;

  // The gaps are stated, not swallowed. A Mirage book silently missing its
  // colours or its prices looks like a working import of a smaller book.
  if (!chartAt) warnings.push("The Mirage Product Chart is missing. It is the only document that carries colours and floor SKUs, so no floors can be built from the price sheets alone.");
  if (!floorAt.length) warnings.push("No Mirage flooring price sheet in this set — every chart SKU would be unpriced, and unpriced rows are dropped.");
  if (unpriced.length) warnings.push(`${unpriced.length} chart SKUs had no price in these sheets and were dropped. Expect some: the chart and the sheets are published on different dates, so an older chart still lists widths the current sheets no longer carry.`);
  if (!trimAt.length) warnings.push("No Mirage trim sheet in this set — the book will have floors but no mouldings or stair parts.");
  if (trimUnpriced) warnings.push(`${trimUnpriced} trim SKUs had no price for their species and were dropped (the sheet leaves some trims priced only in certain species).`);
  if (trimOrphan) warnings.push(`${trimOrphan} trims matched no floor in this import, so they carry no "fits" link — they are still orderable by SKU.`);

  return {
    name, rows: out, mapping: { ...MIRAGE_MAPPING }, warnings,
    meta: { floors: priced.length, unpriced: unpriced.length, chart: chart.rows.length, prices: priceRows.length, fromGrid, trims, trimUnpriced, trimOrphan },
  };
}

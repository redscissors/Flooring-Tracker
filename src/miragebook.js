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
      for (const rr of above.reverse()) {
        // Stitch the inch mark back onto its number WITHIN a row, never across
        // one — the next row's first item is a new column, not this one's mark.
        let prevPart = null;
        for (const it of rr.items) {
          if (/^["']$/.test(it.s) && prevPart) { prevPart.s += '"'; continue; }
          prevPart = { s: it.s, cx: it.cx };
          parts.push(prevPart);
        }
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

export function parseMirageFlooring(sheets) {
  const rows = [];
  const warnings = [];
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
      const priceCols = [];
      for (let c = gradeCol + 1; c < widthRow.length; c++) if (cell(widthRow, c)) priceCols.push(c);
      if (!priceCols.length) continue;

      let collection = "", species = "";
      for (let r = h + 1; r < grid.length; r++) {
        const row = grid[r];
        // A new band/header row ends the block.
        if (findCol(row, /^grades?$/i) >= 0) break;
        if (cell(row, 0)) collection = cell(row, 0);
        if (cell(row, speciesCol)) species = cell(row, speciesCol);
        const grade = cell(row, gradeCol);
        let any = false;
        for (const c of priceCols) {
          const price = priceOf(cell(row, c));
          if (price == null) continue;
          any = true;
          rows.push({
            collection, species, grade,
            construction: bandAt[c] || "", width: cell(widthRow, c), price,
            sheet: sh.name || "",
          });
        }
        // Blank spacer rows are fine; a run of them with no prices and no labels
        // means the block is over.
        if (!any && !cell(row, 0) && !grade && !(row || []).some((c) => str(c))) break;
      }
    }
  }
  if (!rows.length) warnings.push("No Mirage flooring prices were recognized — is this a Mirage flooring price sheet?");
  return { rows, warnings };
}

// Chart SKUs priced from the flooring sheets. The chart is the spine — it alone
// knows the colours — and a price is looked up per (collection, grade,
// construction, width). Where the two sheets overlap the LATER effective date
// wins, which is why the caller passes Value Tower first and Hardwood second.
//
// A chart SKU with no price is DROPPED, not carried at zero: an order item's
// cost drives the quote, so a priceless row would quote $0 rather than fail
// loudly. They come back as `unpriced` so the import can say how many and why.
// Expect some: the chart and the price sheets are published on different dates,
// so a chart older than the current sheet still lists widths that have since
// been dropped.
export function priceChartRows(chartRows, priceRows) {
  const key = (r) =>
    [str(r.collection).toLowerCase(), str(r.grade).toLowerCase(), normConstruction(r.construction), normWidth(r.width)].join("|");
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

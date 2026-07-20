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
    if (/TruBalance|Classic|Lock/.test(txt) && !/thick/.test(txt)) {
      // Column 0 of a band row usually banners the species ("White Oak"), but on
      // blocks that carry their own species column it is just the first band —
      // taking it blindly files rows under a species called "TruBalance".
      const lead = r.items[0]?.s;
      const banner = lead && !/TruBalance|Classic|Lock/i.test(lead) ? str(lead) : "";
      cur = { bands: [], widths: [], colorRows: [], grades: [], speciesLabels: [], cols: null, collection: "", species: banner };
      for (const it of r.items) if (/TruBalance|Classic|Lock/.test(it.s)) cur.bands.push({ label: it.s, cx: it.cx });
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    // The header row labels the left-hand axes; the widths sit on the row above.
    const cols = headerColumns(r);
    if (cols) {
      cur.cols = cols;
      const prev = rows[i - 1];
      if (prev) {
        const parts = [];
        for (const it of prev.items) {
          if (/^["']$/.test(it.s) && parts.length) { parts[parts.length - 1].s += '"'; continue; }
          parts.push({ s: it.s, cx: it.cx });
        }
        cur.widths = parts.filter((p) => /\d/.test(p.s)).map((p) => ({ label: p.s, cx: p.cx }));
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
    const collAt = r.items.find((i) => i.x < gx - 5);
    const gradeAt = r.items.find((i) => near(i.x, gx, 6) && !isSku(i.s));
    const speciesAt = r.items.find((i) => near(i.x, sx, 10) && !isSku(i.s));
    const colorAt = r.items.find((i) => near(i.x, cx, 12) && !isSku(i.s));
    if (collAt) cur.collection = collAt.s;
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
    for (const b of parseBlocks(pageRows(page))) {
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
  if (!out.length) warnings.push("No Mirage product-chart rows were recognized — is this the Mirage Product Chart PDF?");
  return { rows: out, warnings };
}

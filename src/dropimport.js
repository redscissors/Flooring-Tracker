// Multi-file drop routing (ADR 0009 importer upgrades, PR C). Pure detection +
// routing over already-parsed files: each dropped file is read once by the
// component, then fingerprinted and matched to a book here. No I/O — the caller
// hands in parsed sheets (xlsx) or pages (pdf).

import { detectVtcEft, detectStockWorkbook, parseMapped } from "./pricebook.js";
import { isManningtonCartons } from "./manningtonbook.js";
import { isHallmarkWood, isTarkettLvt, isOvfSundries } from "./ovfbook.js";
import { isMirageChart, mirageFileKind } from "./miragebook.js";

// The strongest format tag we can read straight off the file. Priority follows
// the spec: stock signature → VTC EFT → OVF books → Mannington PDF → generic.
// The OVF banded flooring lists are tested before the sundries section-table,
// mirroring parseOvf's own routing order.
export function fileFormat({ sheets, pages, isPdf }) {
  // Mirage ships one hand-supplied PDF (its product chart). It needs its own tag
  // or it fingerprints as plain "generic", and ADR 0025's manual source slots —
  // which key on the format tag, PDFs having no header signature — would accept
  // any unrelated PDF as the missing chart.
  if (isPdf) return isManningtonCartons(pages || []) ? "mannington" : isMirageChart(pages || []) ? "mirage-chart" : "generic";
  if (detectStockWorkbook(sheets || [])) return "stock";
  if (detectVtcEft(sheets || [])) return "vtc-eft";
  if (isHallmarkWood(sheets || [])) return "ovf-hallmark";
  if (isTarkettLvt(sheets || [])) return "ovf-tarkett";
  if (isOvfSundries(sheets || [])) return "ovf-sundries";
  const mirage = mirageFileKind({ sheets: sheets || [] });
  if (mirage) return mirage;
  return "generic";
}

// A vendor whose files must be parsed TOGETHER rather than one after another
// (ADR 0025 rule 7). Mirage is the first: its chart carries identity with no
// prices and its sheets prices with no colours, so they must be JOINED — no
// sequence of single-file passes can express that, because the write path is a
// SKU-keyed upsert.
//
// Its files also all belong to ONE book, which is why the family matters twice:
// bundleByBook collapses the group into a single review pass, and routeFile
// treats a book stamped with any `mirage-*` fingerprint as the home for all of
// them (a book stores one fingerprint, but this vendor's files each carry their
// own tag, so an exact match would route the chart and leave the price sheets
// asking which book they belong to).
const JOINED_FAMILIES = ["mirage"];
export const formatFamily = (format) =>
  JOINED_FAMILIES.find((f) => String(format || "").startsWith(`${f}-`)) || format || "generic";
export const joinedFamily = (formats) =>
  JOINED_FAMILIES.find((f) => (formats || []).some((x) => String(x || "").startsWith(`${f}-`))) || null;

// A short, order-independent signature of the file's header, so a book can
// remember "what a file it imports looks like" and match the next drop even
// before a saved mapping exists. VTC files fingerprint off their detected header
// row; other xlsx files off the best data sheet's first non-empty row. PDFs get
// no header signature (their layout is grid-driven, matched by format tag).
//
// EFT files also get a title signature: Virginia Tile reuses the exact same
// template for every brand it distributes (VTC Core, Anatolia, Home
// Collection…), so the format tag and header are identical across brands. The
// one cell that names the price list is the title line just above the header
// row ("Virginia Tile Core" / "Anatolia Tile" / "VTC Home Collection") —
// that's what tells the sibling files apart.
export function computeFingerprint({ sheets, pages, isPdf }) {
  const format = fileFormat({ sheets, pages, isPdf });
  let header = [], title = "";
  if (!isPdf) {
    const eft = detectVtcEft(sheets || []);
    if (eft) {
      const rows = sheets.find((s) => s.name === eft.sheet)?.rows || [];
      header = rows[eft.headerRow] || [];
      for (let r = eft.headerRow - 1; r >= 0; r--) {
        const text = (rows[r] || []).map((c) => String(c ?? "").trim()).filter(Boolean).join(" ");
        if (text) { title = text; break; }
      }
    } else {
      for (const s of sheets || []) {
        const row = (s.rows || []).find((r) => (r || []).some((c) => c != null && String(c).trim()));
        if (row) { header = row; break; }
      }
    }
  }
  const headerSig = header.map((c) => String(c ?? "").toLowerCase().replace(/\s+/g, "")).filter(Boolean).sort().join("|");
  return { format, headerSig, title, titleSig: title.toLowerCase().replace(/\s+/g, " ") };
}

// Does a book's saved mapping actually parse this file? A cheap "would the
// existing mapping work" probe — the strongest signal for books imported before
// PR C stamped fingerprints. PDFs get a canonical sheet name derived from the
// file name, so their saved sheet name rarely matches a fresh drop; guard on
// the sheet being present.
export function mappingMatchesFile(mapping, sheets) {
  if (!mapping?.sheet) return false;
  const rows = (sheets || []).find((s) => s.name === mapping.sheet)?.rows;
  if (!rows) return false;
  try { return parseMapped(rows, mapping).items.length > 0; }
  catch { return false; }
}

const FORMAT_NAMES = { mannington: "Mannington cartons", "ovf-hallmark": "OVF Hallmark wood", "ovf-tarkett": "OVF Tarkett LVT", "ovf-sundries": "OVF sundries", "mirage-chart": "Mirage product chart", "mirage-flooring": "Mirage flooring list", "mirage-trim": "Mirage trim list" };
const labelFor = (format, b, title) =>
  format === "vtc-eft" ? `Virginia Tile EFT${title ? ` · ${title}` : ""} → ${b?.name || "book"}`
    : FORMAT_NAMES[format] ? `${FORMAT_NAMES[format]} → ${b?.name || "book"}`
      : `Matches ${b?.name || "book"}'s saved layout`;
const reasonFor = (format, title) =>
  format === "vtc-eft" ? `Virginia Tile EFT${title ? ` · ${title}` : ""} — pick which book`
    : FORMAT_NAMES[format] ? `${FORMAT_NAMES[format]} — pick which book`
      : "Unrecognized layout — pick a book";

// Route one parsed file to a target book. Stock is deterministic; registry
// formats match a book by stored fingerprint format OR a saved mapping that
// parses the file (so pre-PR-C books, which have a saved mapping but no
// fingerprint, still match). Exactly one candidate ⇒ confident target; zero or
// several ⇒ null target and the routing UI asks.
//
// Sibling-template rule: when both the file and a book's fingerprint carry a
// title (the EFT brand line), a matching title outranks every other signal and
// a mismatched title is a definite "not this book" — including the mapping
// probe, since Virginia Tile's shared template parses under every sibling
// book's mapping. Books stamped before titles existed keep matching by format
// alone until their next import stamps one.
export function routeFile({ format, headerSig, titleSig, title, sheets }, books) {
  if (format === "stock") return { target: "stock", candidates: [], reason: "Shop workbook (sheet names matched)" };
  const byTitle = new Set(), cand = new Set();
  for (const b of books || []) {
    const fp = b.data?.importFingerprint;
    // Family, not exact tag: a multi-file vendor's files carry different tags
    // ("mirage-chart" / "mirage-flooring" / "mirage-trim") but share one book,
    // which stores only one fingerprint. Every other format is its own family,
    // so this is an identity comparison for them.
    const sameFormat = format !== "generic" && !!fp?.format && formatFamily(fp.format) === formatFamily(format);
    if (sameFormat && fp?.titleSig && titleSig) {
      if (fp.titleSig === titleSig) byTitle.add(b.id);
      continue;
    }
    if (sameFormat) cand.add(b.id);
    else if (fp?.headerSig && headerSig && fp.headerSig === headerSig) cand.add(b.id);
    else if (mappingMatchesFile(b.data?.mapping, sheets)) cand.add(b.id);
  }
  const candidates = byTitle.size ? [...byTitle] : [...cand];
  if (candidates.length === 1) {
    const b = (books || []).find((x) => x.id === candidates[0]);
    return { target: candidates[0], candidates, reason: labelFor(format, b, title) };
  }
  return { target: null, candidates, reason: candidates.length ? "More than one book could take this file" : reasonFor(format, title) };
}

// Walk order for a routed drop, grouped so that every file heading for the same
// book is visited back to back as one bundle (ADR 0025).
//
// This exists because importing a book's files one after another is silently
// destructive: each apply diffs against the WHOLE book, so the second file reads
// the first file's rows as missing and retires them, leaving only the last file's
// contents active. Bundling lets the caller accumulate items across a book's
// files and write once, on the last step.
//
// Input rows are the routed drop rows ({ target, ... }); output preserves the
// order books were first seen, and stamps each step with its position in its
// book's bundle plus the bundle's files (so the last step can report them all).
export function bundleByBook(rows) {
  const groups = [];
  for (const row of rows || []) {
    const g = groups.find((x) => x.target === row.target);
    if (g) g.rows.push(row); else groups.push({ target: row.target, rows: [row] });
  }
  return groups.flatMap((g) => {
    const files = g.rows.map((r) => r.file);
    // A joined vendor is ONE step holding every payload, not one step per file:
    // its parser has to see the whole set at once. Accumulating items across
    // separate steps — what the else-branch does — cannot join them, because by
    // then each file has already been reduced to rows of its own.
    const joined = joinedFamily(g.rows.map((r) => r.format));
    if (joined) return [{ row: g.rows[0], bundle: { index: 0, total: 1 }, files, rows: g.rows, joined }];
    return g.rows.map((row, index) => ({
      row,
      bundle: { index, total: g.rows.length },
      files,
      rows: g.rows,
      joined: null,
    }));
  });
}

// ---- the book's source manifest (ADR 0025) ---------------------------------
// What files a book is made of. Recorded by use — importing a bundle stamps each
// file it contained as a slot — so nothing has to be configured up front, and a
// book fed by one file has a one-slot manifest that never surfaces.
//
// A slot is matched by HOW THE FILE WAS OBTAINED, never by its name. Vendors date
// their filenames and those dates move between releases ("AOT EFT 26 02 19" ->
// "AOT EFT 26 05 20"), so a name match would read every new release as a missing
// file. Fetched sheets match on recordKey (vendor:host:uid:user, which excludes
// the filename by design); hand-supplied files match on their content
// fingerprint, the same signal routeFile already uses. `label` is the filename as
// last seen — display only, refreshed on every match.
export function sourceSlot({ recordKey, fingerprint, name } = {}) {
  const fp = fingerprint || {};
  const label = String(name || "").trim();
  if (recordKey) return { id: `fetch:${recordKey}`, kind: "fetch", label, recordKey };
  const f = { format: fp.format || "generic", headerSig: fp.headerSig || "", titleSig: fp.titleSig || "" };
  return { id: `manual:${f.format}:${f.headerSig}:${f.titleSig}`, kind: "manual", label, fingerprint: f };
}

// The book's manifest after an import that contained `slots`: known slots refresh
// their label and lastSeen, unknown ones are appended in the order they arrived.
// Never drops a slot — a file absent from this import is the whole point of the
// completeness gate, and silently forgetting it would defeat that.
export function mergeSources(prev, slots, at = Date.now()) {
  const out = (prev || []).map((s) => ({ ...s }));
  for (const slot of slots || []) {
    if (!slot?.id) continue;
    const hit = out.find((s) => s.id === slot.id);
    if (hit) { hit.label = slot.label || hit.label; hit.lastSeen = at; }
    else {
      // A declared slot is a promise with no fingerprint yet — nobody has seen
      // the file. The first hand-supplied file that isn't already a known slot
      // redeems the oldest outstanding promise, so the manifest converges on
      // what the document actually looks like instead of accumulating a
      // placeholder beside its own fulfilment.
      const promise = slot.kind === "manual" ? out.find((s) => s.pending) : null;
      if (promise) Object.assign(promise, { ...slot, declaredAs: promise.label, lastSeen: at, pending: false });
      else out.push({ ...slot, lastSeen: at });
    }
  }
  return out;
}

// Slots the book expects that this import does not have. Empty for a one-slot
// book, and empty whenever every known slot is present — the gate only appears
// when something the book has been fed before is absent.
//
// A declared slot has no fingerprint to match, so it is satisfied by ANY manual
// file in the pass that isn't accounted for by a fingerprinted slot. That is the
// whole point of declaring one: the gate can ask for a file BEFORE the book has
// ever seen it, which is the only way a book fed by fetched sheets plus a
// hand-supplied document can be assembled on its first import rather than its
// second.
export function missingSources(manifest, slots) {
  const have = new Set((slots || []).map((s) => s?.id).filter(Boolean));
  const known = (manifest || []).filter((s) => s?.id && !s.pending);
  const missing = known.filter((s) => !have.has(s.id));
  let spare = (slots || []).filter((s) => s?.kind === "manual" && !known.some((k) => k.id === s.id)).length;
  for (const p of (manifest || []).filter((s) => s?.id && s.pending)) {
    if (spare > 0) spare--; else missing.push(p);
  }
  return missing;
}

// ---- declaring a file the book is fed by hand ------------------------------
// Recording sources by use cannot describe a file the book has never had. A book
// whose other sheets arrive by fetch would have to be imported once, wrongly and
// incompletely, before the gate could learn that a hand-supplied document was
// ever part of it. Declaring the slot up front is that missing statement.
export const declareManualSource = (sources, label) => {
  const used = (sources || []).map((s) => String(s?.id || ""));
  let n = 1;
  while (used.includes(`manual:pending:${n}`)) n++;
  return [...(sources || []), { id: `manual:pending:${n}`, kind: "manual", label: String(label || "").trim() || "a file added by hand", pending: true }];
};
export const undeclareManualSource = (sources, id) => (sources || []).filter((s) => s?.id !== id);

// ---- what the review step is fed ------------------------------------------
// The payload(s) BookImportWizard parses for one step of the walk. A joined
// vendor's step hands over EVERY file's payload at once (its parser has to see
// the set); every other step is its single file.
//
// This lives here, next to bundleByBook which decides `joined`, because the two
// have to agree. When the caller rebuilt this from hand-copied step fields it
// dropped `joined`, quietly reducing a joined bundle to its first file — and a
// joined step reports total:1, so that partial parse counted as the last of its
// bundle and would have applied, retiring everything the other files hold.
export const payloadOf = (r) => (r?.isPdf ? { pages: r.pages, isPdf: true } : { sheets: r?.sheets });
export const stepPayloads = (step) =>
  step?.joined
    ? { payloads: (step.rows || []).map(payloadOf), format: step.row?.format }
    : payloadOf(step?.row);

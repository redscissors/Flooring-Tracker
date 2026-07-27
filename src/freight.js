// Vendor freight programs (ADR 0030) — the shipping a special-order book
// charges on top of its item costs, and the rules that turn a job's rows into
// that charge.
//
// Two things shape this file. First, every rule on a real freight sheet is
// scoped to an ORDER, not a line: a minimum charge, a dollar threshold that
// switches the whole shipment onto pallet pricing, a per-piece rate with its own
// floor. A per-row calculation would bill three minimums for three rows off the
// same truck. So a row's chip is only an OPT-IN, and the charge is computed once
// per book over the rows that opted in — the attachedList shape, one book to a
// line.
//
// Second, freight is a settings-grade RATE, not a price-book value: it computes
// at calc time and follows the job's square footage as the quote is edited,
// exactly like a grout coverage or the waste percent. Nothing here is
// snapshotted onto a row (ADR 0003's snapshot doctrine guards against a VENDOR
// re-import rewriting a saved quote; retyping a freight sheet is the team
// deliberately restating what shipping costs today).
//
// Pure — no React, no Supabase — so `node --test` covers the math.

import { num, ceilQty, getCarton, getPieceCarton } from "./catalog.js";
import { miscQty } from "./model.js";
import { orderDescription, orderCopyText } from "./orderentry.js";

const str = (v) => String(v ?? "").trim();
const round2 = (n) => Math.round(n * 100) / 100;
const pos = (v, dflt = 0) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : dflt; };

// A book's freight program, stored in price_books.data.freight (the slot ADR
// 0009 §3 reserved). "none" is every book that has never been configured, so an
// absent program is the default and nothing changes until the team types rates.
//
// The fields are the shape a distributor's shipping sheet actually takes:
// area material priced by the foot until it's cheaper by the pallet, oversized
// material priced by the pallet outright, and pieces (trims, mouldings) priced
// per piece. A rate left at 0 switches its rule off rather than charging zero —
// a program with no piece rate simply doesn't bill trims.
export const normFreight = (raw) => ({
  mode: raw?.mode === "program" ? "program" : "none",
  // Where these rates ship TO. Nominal — it names the column someone read off
  // the vendor's state table, and prints with the line so a quote says which
  // destination it was priced for. Nothing resolves from it.
  destination: str(raw?.destination),
  palletSf: pos(raw?.palletSf),
  perSqft: pos(raw?.perSqft),
  minCharge: pos(raw?.minCharge),
  // The dollar figure at which the per-foot rate gives way to flat-rate pallets
  // (0 = never — the per-foot rate runs all the way up).
  palletAt: pos(raw?.palletAt),
  palletRate: pos(raw?.palletRate),
  largeRate: pos(raw?.largeRate),
  // A piece with a side at or over this many inches is "large format" and ships
  // on the large-format table. 15" is the trade's line and the one Glazzio's
  // sheet draws (its Harmonic 12x24 sits on the large table).
  largeFormatIn: pos(raw?.largeFormatIn, 15),
  perPiece: pos(raw?.perPiece),
  pieceMin: pos(raw?.pieceMin),
  effective: str(raw?.effective),
});

export const bookFreight = (book) => normFreight(book?.data?.freight);
export const hasFreightProgram = (book) => bookFreight(book).mode === "program";

// The rates a freshly switched-on program starts with: Glazzio's 2026 shipping
// sheet read down the Ohio column, which is the only destination the shop ships
// to and the only real program anyone has typed. Every distributor's sheet has
// this shape, and most of the figures (the pallet size, the 15" large-format
// line) are the shop's own facts rather than Glazzio's — so seeding beats nine
// empty boxes even for a different vendor. It is a STARTING POINT, not a
// default: the card says where the numbers came from until someone edits one.
export const FREIGHT_SEED = Object.freeze({
  mode: "program", destination: "Ohio", effective: "2026", palletSf: 496,
  perSqft: 0.99, minCharge: 14.85, palletAt: 149, palletRate: 149,
  largeRate: 79, largeFormatIn: 15, perPiece: 0.33, pieceMin: 14.85,
});

const RATE_FIELDS = ["palletSf", "perSqft", "minCharge", "palletAt", "palletRate", "largeRate", "perPiece", "pieceMin"];
// A program nobody has given rates to — every chargeable figure still zero.
export const freightIsBlank = (f) => RATE_FIELDS.every((k) => !(normFreight(f)[k] > 0));
// Still carrying the seed verbatim, so the card can say so and then stop saying
// it the moment a rate is touched.
export const freightIsSeed = (f) => {
  const n = normFreight(f);
  return RATE_FIELDS.every((k) => n[k] === FREIGHT_SEED[k]) && n.largeFormatIn === FREIGHT_SEED.largeFormatIn;
};

// A row rides the shipment unless someone unchecked it. Default-on (rather than
// a stored `checked` like grout) is deliberate: the freight is real the moment
// the material is ordered, so the quote should carry it without anyone
// remembering to ask — including on rows saved before the program existed. Only
// the explicit "off" is stored.
export const rowFreightOn = (p) => p?.freight !== "off";

// The book a row's freight comes from: its own special-order book, and only when
// that book carries a program. A stock row (the shop's own shelf) never ships
// from a vendor, so stock-kind books are excluded by the caller passing only
// order books — but a stock book with no program falls out here anyway.
export const freightBookFor = (p, books) => {
  const id = str(p?.bookId); if (!id) return null;
  const book = (books || []).find((b) => b.id === id);
  return book && hasFreightProgram(book) ? book : null;
};

// A size like "12x24" / "2 x 10" / `12" × 24"` → the larger side in inches.
// Falls back through the row's own L/W first, since a picked tile row carries
// them parsed; sizeText is the mosaic-sheet / free-text case.
const SIZE_RE = /(\d+(?:\.\d+)?)\s*["”]?\s*[x×]\s*(\d+(?:\.\d+)?)/i;
export function rowLongestSide(p) {
  const l = num(p?.L), w = num(p?.W);
  if (l > 0 || w > 0) return Math.max(l, w);
  const m = SIZE_RE.exec(str(p?.sizeText));
  return m ? Math.max(parseFloat(m[1]), parseFloat(m[2])) : 0;
}

// Which of a program's three tables a row ships on. A counted line is pieces
// whatever its size (a trim is a trim); an area line is large-format when a side
// reaches the threshold. A row whose size is unknown falls to "small": the
// per-foot rate is the sheet's default, and guessing "large" would invent a
// whole pallet.
export function freightBasis(p, f) {
  if (!p) return null;
  if (p.type === "misc" || p.qtyType !== "sqft") return "piece";
  const side = rowLongestSide(p);
  return f.largeFormatIn > 0 && side >= f.largeFormatIn ? "large" : "small";
}

// What each opted-in row contributes, in the units its table bills: ORDERED
// square footage for area rows (whole cartons where the row is carton-sold —
// the same number the estimate bills, so freight and material can't disagree
// about what shipped) and pieces for counted rows.
export function freightTally(proj, s, books) {
  const byBook = new Map();
  for (const area of (proj?.categories || [])) for (const p of (area.products || [])) {
    const book = freightBookFor(p, books); if (!book) continue;
    if (!rowFreightOn(p)) continue;
    const f = bookFreight(book);
    const t = byBook.get(book.id) || { book, f, smallSf: 0, largeSf: 0, pieces: 0, rows: 0 };
    const basis = freightBasis(p, f);
    if (basis === "piece") {
      const PC = getPieceCarton(p);
      t.pieces += PC ? PC.pieces : miscQty(p);
    } else {
      const C = getCarton(p, s);
      const sf = C ? C.order * C.sf : num(p.qty);
      if (sf <= 0) continue;
      t[basis === "large" ? "largeSf" : "smallSf"] += sf;
    }
    t.rows += 1;
    byBook.set(book.id, t);
  }
  return [...byBook.values()];
}

const pallets = (sf, palletSf) => (palletSf > 0 ? Math.max(1, ceilQty(sf / palletSf)) : 1);

// One book's tally → the charge, broken into the parts the sheet itself charges
// in. Parts are kept separate rather than summed to a single number because they
// bill in different units (pallets vs. feet vs. pieces) and the desk keys them
// that way; `freightCharge` is the total.
//
// The three rules, each independent:
//   large  — always by the pallet, whatever the footage.
//   small  — by the foot, floored at the minimum, UNTIL the per-foot figure
//            reaches the threshold, at which point the whole lot ships on
//            flat-rate pallets.
//   piece  — by the piece, floored at its own minimum.
// A program with no large-format rate ships oversized material on the per-foot
// table with everything else; that's the honest reading of a sheet that doesn't
// name a large-format price.
export function freightParts(t) {
  const f = t.f, out = [];
  let smallSf = t.smallSf;
  if (t.largeSf > 0) {
    if (f.largeRate > 0) {
      const n = pallets(t.largeSf, f.palletSf);
      out.push({ basis: "large", label: "Large format", qty: n, unit: "pallets", rate: f.largeRate, sf: t.largeSf, cost: round2(n * f.largeRate) });
    } else smallSf += t.largeSf;
  }
  if (smallSf > 0 && (f.perSqft > 0 || f.minCharge > 0)) {
    const base = smallSf * f.perSqft;
    if (f.palletAt > 0 && f.palletRate > 0 && base >= f.palletAt) {
      const n = pallets(smallSf, f.palletSf);
      out.push({ basis: "pallet", label: "Flat-rate pallet program", qty: n, unit: "pallets", rate: f.palletRate, sf: smallSf, cost: round2(n * f.palletRate) });
    } else {
      const cost = Math.max(base, f.minCharge);
      out.push({ basis: "small", label: "Small format", qty: round2(smallSf), unit: "sf", rate: f.perSqft, sf: smallSf, cost: round2(cost), atMin: cost > base });
    }
  }
  if (t.pieces > 0 && (f.perPiece > 0 || f.pieceMin > 0)) {
    const base = t.pieces * f.perPiece;
    const cost = Math.max(base, f.pieceMin);
    out.push({ basis: "piece", label: "Trims", qty: t.pieces, unit: "pieces", rate: f.perPiece, cost: round2(cost), atMin: cost > base });
  }
  return out;
}

// The job's freight, one entry per book: the parts, their total, and enough
// identity for the summary, the estimate, and the order panel to label the line.
// Empty when the project's master switch is off — the switch is the whole
// answer, so nothing downstream has to ask twice.
export function freightList(proj, s, books) {
  if (proj?.freight === false) return [];
  return freightTally(proj, s, books).map((t) => {
    const parts = freightParts(t);
    return {
      bookId: t.book.id,
      book: t.book.name || "Vendor",
      destination: t.f.destination,
      parts,
      cost: round2(parts.reduce((n, x) => n + x.cost, 0)),
    };
  }).filter((l) => l.parts.length > 0);
}

export const freightTotal = (lines) => round2((lines || []).reduce((n, l) => n + l.cost, 0));

// A one-line reading of what the charge is made of — "1 pallet · 148 sf" — for
// the row chip and the summary, where there's no room for the parts table.
export const freightSummary = (line) =>
  (line?.parts || []).map((x) => `${x.unit === "sf" ? Math.round(x.qty) : x.qty} ${x.qty === 1 ? x.unit.replace(/s$/, "") : x.unit}`).join(" · ");

// Freight as printable rows, in the shape printMatList produces so the estimate
// can render them through the same breakdown it renders materials through. The
// unit is spelled "sq ft" rather than "sf" because the print singularizes units
// by dropping a trailing s (u1), which would leave "f".
export function freightPrintRows(lines) {
  const out = [];
  for (const line of (lines || [])) for (const x of line.parts) {
    out.push({
      kind: "Freight",
      name: `${line.book} — ${x.label}`,
      spec: line.destination,
      sku: "",
      detail: x.atMin ? `${x.unit === "pieces" ? "piece" : "order"} minimum applied` : "",
      unit: x.unit === "sf" ? "sq ft" : x.unit,
      order: x.qty,
      exact: 0,
      price: x.rate,
      cost: x.cost,
    });
  }
  return out;
}

// Freight rows for the order-entry panel. They file as SPECIAL ORDER: freight is
// billed by the vendor whose book carries the program, on the same order as the
// material, and it has no SKU the desk can key — so it reads like a Sheoga line,
// by description. One row per part, because each part bills in its own unit and
// at its own rate.
//
// No markup: `perSell` mirrors `perCost`. The customer is charged what the
// vendor charges, so the panel's two columns agree on purpose (ADR 0030).
export function freightOrderRows(line, descLimit) {
  return (line.parts || []).map((x, i) => {
    const qty = x.qty > 0 ? x.qty : 1;
    // Every part names its table: a book can bill two or three of them on one
    // order, and "Freight — Glazzio Tiles" three times over is unkeyable.
    const name = `Freight — ${line.book} ${x.label.toLowerCase()}`;
    const r = {
      id: `freight|${line.bookId}|${x.basis}|${i}`,
      special: true, byDesc: true, freight: true, area: "whole order",
      tag: "", sizePlain: "", name, sku: "",
      coverage: [x.label, line.destination].filter(Boolean).join(" · "),
      qty, qtyAssumed: false,
      unitCode: x.unit === "sf" ? "SF" : x.unit === "pallets" ? "PLT" : "PC",
      qtyText: `${qty} ${x.unit}`,
      perCost: x.cost / qty,
      perSell: x.cost / qty,
    };
    const desc = orderDescription(r, descLimit);
    return { ...r, desc, copy: orderCopyText({ ...r, desc }) };
  });
}

// Sample-ordering pure logic (spec 2026-08-28): request rows are the ONE
// source — shared sample_requests rows (snapshot + live ids, the claude-issues
// doctrine), never a field on the product row. This file owns the request
// shape, the vendor grouping the panel and browser read, and the rep email.
// Split from samples.jsx so `node --test` can cover it.

import { areaLabel, uid } from "./model.js";
import { TLBL } from "./uiconst.js";

export const SAMPLE_STATUSES = ["need", "ordered"];
export const SAMPLE_LABEL = { need: "To order", ordered: "Ordered" };

// Status colors, shared by the panel chips, the grid's row indicator, and the
// browser column: amber = on you (order it), moss = in flight/done. Inline
// hexes like the order panel's ASSUMED palette — the theme's amber utilities
// don't all render in this build.
export const SAMPLE_COLOR = { need: "#b45309", ordered: "var(--ft-brand)" };
export const SAMPLE_CHIP = {
  need: { background: "#fef6e2", color: "#b45309", borderColor: "#f0c96f" },
  ordered: { background: "var(--ft-brand)", color: "#fff", borderColor: "var(--ft-brand)" },
};

const OTHER = "Other / hand-entered";
const str = (v) => (typeof v === "string" ? v : "");

export const normSampleRequest = (r) => {
  if (!r || typeof r !== "object" || !r.id) return null;
  return {
    id: r.id,
    status: SAMPLE_STATUSES.includes(r.status) ? r.status : "need",
    createdBy: str(r.createdBy), createdAt: r.createdAt || null,
    orderedBy: str(r.orderedBy), orderedAt: r.orderedAt || null,
    projectId: str(r.projectId), custName: str(r.custName),
    areaName: str(r.areaName), productId: str(r.productId),
    bookId: str(r.bookId), bookName: str(r.bookName) || OTHER,
    item: {
      name: str(r.item?.name), sku: str(r.item?.sku),
      size: str(r.item?.size), type: str(r.item?.type),
    },
  };
};

// A new request: the line frozen at request time. Vendor resolves once, here —
// the book's brand label over its name, Sheoga-configurator lines under
// Sheoga, everything else (hand rows, wedi's table-based lines) under Other.
export const requestFrom = ({ project, custName, area, areaIndex, product: p, books = [], by = "" }) => {
  const book = p.bookId ? books.find((b) => b.id === p.bookId) : null;
  const bookName = book ? ((book.data?.brandLabel || "").trim() || book.name || "Price book")
    : p.sheoga ? "Sheoga Hardwood" : OTHER;
  return normSampleRequest({
    id: uid(), status: "need", createdBy: by, createdAt: Date.now(),
    projectId: project.id, custName: custName || project.name || "",
    areaName: areaLabel(area, areaIndex), productId: p.id,
    bookId: book ? book.id : "", bookName,
    item: {
      name: (p.brandColor || "").trim() || p.sku || TLBL[p.type] || "This line",
      sku: p.sku || "",
      size: p.sizeText || (p.L && p.W ? `${p.L}×${p.W}` : ""),
      type: p.type || "",
    },
  });
};

// Vendor groups in encounter order, Other always last — a sample order is
// placed per vendor, so that's the unit the panel and the email work in.
export const sampleGroups = (requests) => {
  const groups = new Map();
  for (const r of requests || []) {
    const key = r.bookId || r.bookName;
    if (!groups.has(key)) groups.set(key, { key, bookId: r.bookId, name: r.bookName, rows: [] });
    groups.get(key).rows.push(r);
  }
  const out = [...groups.values()];
  const oi = out.findIndex((g) => g.name === OTHER);
  if (oi >= 0) out.push(out.splice(oi, 1)[0]);
  return out;
};

export const sampleCounts = (requests) => {
  const c = { need: 0, ordered: 0, total: 0 };
  for (const r of requests || []) { c[r.status]++; c.total++; }
  return c;
};

// Per-project roll-up for the customer browser's samples column/filter.
export const projectSampleTally = (requests) => {
  const m = new Map();
  for (const r of requests || []) {
    const t = m.get(r.projectId) || { need: 0, ordered: 0 };
    t[r.status]++;
    m.set(r.projectId, t);
  }
  return m;
};

// Who a sample request is emailed to. A book carries two contacts (owner call
// 2026-09-01): the rep, and a separate sample-request address for vendors whose
// samples go to a company inbox rather than a person. The samples address wins
// when it can be mailed; the rep is the fallback, so a book where they are the
// same person needs nothing typed twice.
export const sampleContactFor = (bookData) => {
  for (const [from, c] of [["sample", bookData?.sampleContact], ["rep", bookData?.rep]]) {
    const email = str(c?.email).trim();
    if (email) return { name: str(c?.name).trim(), email, from };
  }
  return null;
};

export const contactLabel = (contact) => {
  const first = str(contact?.name).trim().split(/\s+/)[0];
  return first ? `Email ${first}` : "Email samples";
};

// The rep email. Ship-to is the CUSTOMER (samples ship direct — owner call),
// read live from the project by the caller. No salesperson info (owner call
// 2026-08-28).
export const repEmail = ({ rows, custName, address, phone, repName }) => {
  const items = rows.map((r) =>
    "- " + [r.item.size, r.item.name].filter(Boolean).join(" ") + (r.item.sku ? ` — ${r.item.sku}` : ""));
  const ship = [custName, address, phone].filter(Boolean);
  const body = [
    repName ? `Hi ${repName.trim().split(/\s+/)[0]},` : "Hi,",
    "", "Could you send samples of the following?", "",
    ...items,
    "", "Ship to:", ...ship,
    "", "Thank you",
  ].join("\n");
  return { subject: `Sample request — ${custName || "our customer"}`, body };
};

export const mailtoHref = (email, subject, body) =>
  `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

// ERP 1 order numbers on a project (spec 2026-09-19): `erpOrders` (the
// numbers the desk keyed the job under) and `erpKeyed` (one stamp per
// order-entry line, keyed by the line's stable id). Pure — model.js imports
// the normalizers, so this file must never import model.js.

export const normErpNo = (v) => String(v ?? "").replace(/\D/g, "").slice(0, 10);

export const normErpOrders = (list) => {
  const out = [];
  const seen = new Set();
  for (const o of Array.isArray(list) ? list : []) {
    const no = normErpNo(o?.no);
    if (!no || seen.has(no)) continue;
    seen.add(no);
    out.push({ no, addedBy: String(o?.addedBy || ""), addedAt: Number(o?.addedAt) || 0 });
  }
  return out;
};

export const normErpKeyed = (map, orders) => {
  const nos = new Set((orders || []).map((o) => o.no));
  const out = {};
  if (map && typeof map === "object") {
    for (const [id, k] of Object.entries(map)) {
      const no = normErpNo(k?.no);
      if (!id || !no || !nos.has(no)) continue;
      out[id] = { no, at: Number(k?.at) || 0, by: String(k?.by || "") };
    }
  }
  return out;
};

// The copy gate applies to NUMBERED projects only (owner, round 4): no
// N-number means no customer and no real project name — a quick price or an
// unnamed draft — and the desk keys those without an ERP order.
export const gated = (proj) => !!proj?.projectNo && !(Array.isArray(proj?.erpOrders) && proj.erpOrders.length);

// A full record carries erpOrders; a boot light row carries the projected
// erpNos (bootload LIST_SELECT). The live orders win when both are present.
export const erpNosOf = (p) => (Array.isArray(p?.erpOrders) ? p.erpOrders.map((o) => o.no) : Array.isArray(p?.erpNos) ? p.erpNos : []);

export const erpHit = (p, q) => {
  const d = String(q || "").replace(/\D/g, "");
  return !!d && erpNosOf(p).some((no) => no.includes(d));
};

export const orderCounts = (erpKeyed) => {
  const out = {};
  for (const k of Object.values(erpKeyed || {})) if (k?.no) out[k.no] = (out[k.no] || 0) + 1;
  return out;
};

// --- patch builders: each returns { erpOrders, erpKeyed } for ONE
// updateProject call, or null when there is nothing to write ----------------

export const addErpOrder = (proj, no, who, at = Date.now()) => {
  const n = normErpNo(no);
  const orders = normErpOrders(proj?.erpOrders);
  if (!n || orders.some((o) => o.no === n)) return null;
  const erpOrders = [...orders, { no: n, addedBy: String(who || ""), addedAt: at }];
  return { erpOrders, erpKeyed: normErpKeyed(proj?.erpKeyed, erpOrders) };
};

export const removeErpOrder = (proj, no) => {
  const n = normErpNo(no);
  const erpOrders = normErpOrders(proj?.erpOrders).filter((o) => o.no !== n);
  return { erpOrders, erpKeyed: normErpKeyed(proj?.erpKeyed, erpOrders) };
};

export const stampErpLines = (proj, ids, no, who, at = Date.now()) => {
  const n = normErpNo(no);
  const erpOrders = normErpOrders(proj?.erpOrders);
  if (!n || !erpOrders.some((o) => o.no === n)) return null;
  const erpKeyed = { ...normErpKeyed(proj?.erpKeyed, erpOrders) };
  for (const id of ids || []) if (id) erpKeyed[id] = { no: n, at, by: String(who || "") };
  return { erpOrders, erpKeyed };
};

export const clearErpStamps = (proj, ids) => {
  const erpOrders = normErpOrders(proj?.erpOrders);
  const erpKeyed = { ...normErpKeyed(proj?.erpKeyed, erpOrders) };
  for (const id of ids || []) delete erpKeyed[id];
  return { erpOrders, erpKeyed };
};

// --- line helpers over the panel's row objects ------------------------------

export const lineIds = (row) => (row?.from ? row.from.map((f) => f.id) : [row?.id]);

export const lineStamp = (row, erpKeyed) => (erpKeyed && erpKeyed[lineIds(row)[0]]) || null;

// A merged line is keyed only when EVERY source is; "mixed" when the sources
// sit on different orders.
export const keyedNo = (row, erpKeyed) => {
  if (!erpKeyed) return null;
  const nos = lineIds(row).map((id) => erpKeyed[id]?.no || null);
  if (!nos.length || nos.some((n) => !n)) return null;
  return nos.every((n) => n === nos[0]) ? nos[0] : "mixed";
};

export const copyable = (row) => !!row?.special || !!row?.sku;

export const remainingRows = (rows, erpKeyed) => (rows || []).filter((r) => copyable(r) && keyedNo(r, erpKeyed) === null);

export const erpCounts = (rows, erpKeyed) => {
  const list = (rows || []).filter(copyable);
  const byNo = {};
  let keyed = 0;
  for (const r of list) {
    const no = keyedNo(r, erpKeyed);
    if (!no) continue;
    keyed++;
    byNo[no] = (byNo[no] || 0) + 1;
  }
  return { keyed, total: list.length, byNo };
};

// A merged line whose sources sit on different orders tallies under the
// "mixed" key (erpCounts); it reads as "N across orders", trailing the
// per-order counts rather than sitting wherever Object.entries happened to
// place it, so a scan of the note lands on a real order number first.
export const keyedNote = (rows, erpKeyed) => {
  const { keyed, total, byNo } = erpCounts(rows, erpKeyed);
  if (!keyed) return "";
  const entries = Object.entries(byNo);
  const parts = [
    ...entries.filter(([no]) => no !== "mixed").map(([no, n]) => `${n} on ${no}`),
    ...entries.filter(([no]) => no === "mixed").map(([, n]) => `${n} across orders`),
  ];
  return `${keyed} of ${total} keyed · ${parts.join(", ")}`;
};

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

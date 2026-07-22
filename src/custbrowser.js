// Customer browser pure logic (issue 040): the ERP-style directory grid —
// one compact row per customer, grouped by salesperson, sortable and
// searchable — assembled from the boot's light rows only (people + light
// projects + builders), so opening it never fetches anything.

// A project's salesperson name, whichever shape the row is in: a full record
// carries the ADR 0008 snapshot object, a light row the projected `sales`
// string (bootload LIST_SELECT).
export const salesNameOf = (p) => ((p.salesperson && p.salesperson.name) || "").trim() || (p.sales || "").trim();

export const NO_SALES = "No salesperson";

// One grid row per customer. `activity` bubbles on any edit — the customer's
// own or any of their projects' (same rule as the sidebar's "Newest" sort).
// `sales` is the salesperson of the most recently touched project that has
// one: a customer is "whose" by whoever last worked their jobs.
export function browserRows({ people = [], projects = [], builders = [] }) {
  const builderName = (id) => builders.find((b) => b.id === id)?.name || "";
  const byCust = new Map();
  for (const p of projects) {
    if (!p.customerId || p.quick) continue;
    const list = byCust.get(p.customerId);
    if (list) list.push(p); else byCust.set(p.customerId, [p]);
  }
  return people.map((c) => {
    const projs = [...(byCust.get(c.id) || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const sales = projs.map(salesNameOf).find(Boolean) || "";
    return {
      id: c.id,
      name: c.name || "",
      builderName: builderName(c.builderId),
      phone: c.phone || "", email: c.email || "", address: c.address || "",
      createdAt: c.createdAt || 0,
      activity: Math.max(c.updatedAt || 0, 0, ...projs.map((p) => p.updatedAt || 0)),
      sales,
      projs,
    };
  });
}

// Substring search over the row's own contact fields, its builder, and its
// project names — the same span as the sidebar search (ADR 0005).
export function filterRows(rows, q) {
  const s = (q || "").trim().toLowerCase();
  if (!s) return rows;
  const has = (f) => (f || "").toLowerCase().includes(s);
  return rows.filter((r) =>
    [r.name, r.phone, r.email, r.address, r.builderName].some(has) ||
    r.projs.some((p) => has(p.name)));
}

// Each key carries its natural direction: dates newest-first, names A–Z.
export const SORTS = [["created", "Created"], ["modified", "Modified"], ["name", "A–Z"]];
export function sortRows(rows, key) {
  const cmp = key === "name"
    ? (a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    : key === "modified"
      ? (a, b) => b.activity - a.activity
      : (a, b) => b.createdAt - a.createdAt;
  return [...rows].sort(cmp);
}

// Salesperson groups, A–Z, customers with no salesperson-carrying project
// last. Row order inside each group is the caller's (sortRows) order.
export function groupBySales(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = r.sales || NO_SALES;
    const g = groups.get(key);
    if (g) g.push(r); else groups.set(key, [r]);
  }
  return [...groups.entries()]
    .map(([sales, list]) => ({ sales, rows: list }))
    .sort((a, b) => a.sales === NO_SALES ? 1 : b.sales === NO_SALES ? -1
      : a.sales.localeCompare(b.sales, undefined, { sensitivity: "base" }));
}

export const shortDate = (ms) => {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
};

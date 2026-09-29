// Grout base options (ADR 0006 amendment 2026-09-29): a catalog grout carries
// its ★ default `base` plus `altBases`; a product row names which one it uses
// in `grout.base` ("" = the ★), and the project remembers the last grout type
// and, per grout type, the last base picked (`project.groutMemory`).

export const baseKey = (b) => (b ? String(b.sku || b.name || "") : "");

export const groutBases = (g) => [g?.base, ...(g?.altBases || [])].filter(Boolean);

// An unknown key (a base since removed in Settings) falls back to the ★.
export const resolveGroutBase = (g, key) => {
  const all = groutBases(g);
  return (key && all.find((b) => baseKey(b) === key)) || all[0] || null;
};

export const rowBaseKey = (g, key) => {
  const b = resolveGroutBase(g, key);
  return b && b !== g.base ? baseKey(b) : "";
};

export const normGroutMemory = (raw) => {
  const product = typeof raw?.product === "string" ? raw.product : "";
  const bases = {};
  if (raw?.bases && typeof raw.bases === "object") for (const [k, v] of Object.entries(raw.bases)) if (typeof v === "string") bases[k] = v;
  return { product, bases };
};

export const rememberGroutProduct = (mem, product) => ({ ...normGroutMemory(mem), product });

export const rememberGroutBase = (mem, product, key) => { const m = normGroutMemory(mem); return { ...m, bases: { ...m.bases, [product]: key } }; };

export const memoryBaseFor = (mem, product, g) => {
  const key = mem?.bases?.[product];
  return key ? rowBaseKey(g, key) : "";
};

// Ticking Grout on a row: a row that already names an offered grout keeps it;
// otherwise the project's remembered grout, else the catalog default.
export const tickGroutChoice = (row, offered, mem, catalogDefault, grouts) => {
  const list = offered || [];
  const product = list.includes(row.product) ? row.product
    : list.includes(mem?.product) ? mem.product
      : list.includes(catalogDefault) ? catalogDefault : list[0] || "";
  const base = product === row.product && row.base ? rowBaseKey(grouts[product], row.base) : memoryBaseFor(mem, product, grouts[product]);
  return { product, base };
};

export const pickGroutProductChoice = (product, mem, grouts) => ({
  base: memoryBaseFor(mem, product, grouts[product]),
  memory: rememberGroutProduct(mem, product),
});

export const pickGroutBaseChoice = (product, key, mem, grouts) => {
  const base = rowBaseKey(grouts[product], key);
  return { base, memory: rememberGroutBase(mem, product, base) };
};

// The chip reads the kind of base, not the price book's long description.
export const baseLabel = (b) => {
  const t = String(b?.name || "");
  if (/unsanded/i.test(t)) return "Unsanded";
  if (/sanded/i.test(t)) return "Sanded";
  if (/\bcomm(\.|ercial\b)/i.test(t)) return "Commercial unit";
  if (/\bfull\b/i.test(t)) return "Full unit";
  return t || String(b?.sku || "");
};

export const baseOptionLabel = (b, isDefault) =>
  baseLabel(b) + (Number(b?.per) > 1 ? ` (1 per ${b.per} kits)` : "") + (isDefault ? " ★" : "");

// The Settings base-list edits: index 0 is the ★ `base`, the rest `altBases`.
// Each returns the `{ base, altBases }` patch for the grout.
const fromList = (list) => ({ base: list[0] || null, altBases: list.slice(1) });
export const editBaseAt = (g, i, patch) => fromList(groutBases(g).map((b, j) => (j === i ? { ...b, ...patch } : b)));
export const starBaseAt = (g, i) => { const l = groutBases(g); return fromList([l[i], ...l.filter((_, j) => j !== i)]); };
export const removeBaseAt = (g, i) => fromList(groutBases(g).filter((_, j) => j !== i));
export const addBaseTo = (g, b) => fromList([...groutBases(g), b]);
